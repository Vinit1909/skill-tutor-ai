import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore"
import { db } from "./firebase"

export interface RoadmapNode {
    id: string
    title: string
    status: NodeStatus
    weight?: number
    children?: RoadmapNode[]
}

export type NodeStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"

export interface SkillSpaceData {
    id?: string
    name: string
    description?: string
    value: number
    max: number
    createdAt?: any
    // new fields for roadmap
    roadmapContext?: {
        level?: string
        goals?: string
        priorKnowledge?: string
    }
    roadmapJSON?: {
        title: string
        nodes: RoadmapNode[]
    }
}

export async function createSkillSpace(uid: string, name: string, description: string) {
    const ref = collection(db, "users", uid, "skillspaces")
    const docRef = await addDoc(ref, {
        name,
        description,
        value: 1,
        max: 100, 
        createdAt: serverTimestamp(),
    })
    return docRef.id
}

export async function getAllSkillSpaces(uid: string): Promise<SkillSpaceData[]> {
    const ref = collection(db, "users", uid, "skillspaces")
    const q = query(ref, orderBy("createdAt", "asc"))
    const snap = await getDocs(q)

    const results: SkillSpaceData[] = []
    snap.forEach((docSnap) => {
        const data = docSnap.data()
        // debugging:
        console.log("DOC DATA:", docSnap.id, data)

        results.push({
            id: docSnap.id,
            name: data.name,
            description: data.description,
            value: data.value,
            max: data.max,
            createdAt: data.createdAt,
        })
    })
    
    // debugging:
    console.log("getAllSkillSpaces => results:", results)
    return results
}

export async function updateSkillSpace(uid: string, docId: string, data: Partial<SkillSpaceData>)  {
    const docRef = doc(db, "users", uid, "skillspaces", docId)
    await updateDoc(docRef, data)
}

export async function deleteSkillSpace(uid: string, docId: string) {
    const docRef = doc(db, "users", uid, "skillspaces", docId)
    await deleteDoc(docRef)
}

// handle deletion of subcollections when skillspace is deleted
export async function deleteSkillSpaceDeep(
    uid: string,
    skillId: string
) : Promise<void> {
    const subCollections = ["chats", "questions"];
    const skillRef = doc(db, "users", uid, "skillspaces", skillId);

    for (const subCol of subCollections) {
        const subColRef = collection(skillRef, subCol);
        const snap = await getDocs(subColRef);

        const deletePromises: Promise<void>[] = [];
        snap.forEach((docSnap) => {
            deletePromises.push(deleteDoc(docSnap.ref));
        });

        await Promise.all(deletePromises);
    }
    await deleteDoc(skillRef);
}

// GET a single skill doc
export async function getSkillSpace(uid: string, docId: string): Promise<SkillSpaceData | null> {
    const docRef = doc(db, "users", uid, "skillspaces", docId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
        return null;
    }
    const data = snap.data();
    return {
        id: snap.id,
        name: data.name, 
        description: data.description,
        value: data.value,
        max: data.max,
        createdAt: data.createdAt,
        roadmapContext: data.roadmapContext,
        roadmapJSON: data.roadmapJSON, 
    };
}

function calculateSkillProgress(nodes: RoadmapNode[]): {value: number, max: number} {
    let value = 0;
    let totalMax = 0;

    function updateParentStatus(node: RoadmapNode): NodeStatus {
        if (!node.children || node.children.length === 0) {
            return node.status
        }
        const childStatuses = node.children.map(child => updateParentStatus(child))
        if (childStatuses.every(s => s === "COMPLETED")) {
            return "COMPLETED"
        }
        if (childStatuses.some(s => s === "IN_PROGRESS" || s === "COMPLETED")) {
            return "IN_PROGRESS"
        }
        return "NOT_STARTED"
    }

    const flattenNodes = (node: RoadmapNode) => {
        if (!node.children || node.children.length === 0) {
            const weight = node.weight || 1
            totalMax += weight
            if (node.status === "COMPLETED") value += weight
        } else {
            node.children.forEach(flattenNodes)
            node.status = updateParentStatus(node)
        }
    }

    nodes.forEach(flattenNodes)
    return {value, max: totalMax}    
}

export async function updateNodeStatus(uid: string, skillId: string, nodeId: string, newStatus: NodeStatus) {
    const skillRef = doc(db, "users", uid, "skillspaces", skillId)
    const snap = await getDoc(skillRef)
    if (!snap.exists()) throw new Error("Skill not found")
    
    const skillData = snap.data() as SkillSpaceData
    if (!skillData.roadmapJSON?.nodes) throw new Error("No roadmap found")
    
    console.log("Before update - Nodes:", JSON.stringify(skillData.roadmapJSON.nodes))

    function updateNode(nodes: RoadmapNode[], targetId:string, newStatus: NodeStatus) {
        return nodes.map(node => {
            const updatedNode = {...node}
            if (updatedNode.id === targetId && (!updatedNode.children || updatedNode.children.length === 0)) {
                updatedNode.status = newStatus
            }
            if (updatedNode.children) {
                updatedNode.children = updateNode(updatedNode.children, targetId, newStatus)
            }
            return updatedNode
        })
    }
    
    const updatedNodes = updateNode(skillData.roadmapJSON.nodes, nodeId, newStatus)
    const {value, max} = calculateSkillProgress(updatedNodes)

    console.log("After update - Nodes:", JSON.stringify(updatedNodes))
    console.log("Value/Max:", {value, max})

    await updateDoc(skillRef, {
        "roadmapJSON.nodes": updatedNodes,
        value,
        max,
    })

    return {updatedNodes, value, max}
}