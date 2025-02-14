import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, updateDoc, DocumentData, DocumentReference } from "firebase/firestore"
import { db } from "./firebase"

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
        nodes: Array<{
            id: string
            title: string
            status?: string
            weight?: number
            children?: any[]
        }>
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

// update node's status
export async function updateRoadmapNodeStatus(
    uid: string,
    skillId: string,
    nodeId: string,
    newStauts: string
) {
    const skillRef = doc(db, "users", uid, "skillspaces", skillId)
    const snap = await getDoc(skillRef)
    if (!snap.exists()) {
        throw new Error("Skill doc does not exist")
    }

    const skillData = snap.data() as SkillSpaceData
    if (!skillData.roadmapJSON || !skillData.roadmapJSON.nodes) {
        throw new Error("No roadmap found in skill doc")
    }

    const nodes = skillData.roadmapJSON.nodes
    const nodeIndex = nodes.findIndex((n) => n.id === nodeId)
    if (nodeIndex === -1) {
        throw new Error(`Node with id ${nodeId} not found`)
    }

    nodes[nodeIndex].status = newStauts

    let newValue = 0
    let maxValue = 0

    for (const n of nodes) {
        const w = n.weight || 1
        maxValue += w
        if (n.status === "COMPLETED") {
            newValue += w
        }
    }

    await updateDoc(skillRef, {
        "roadmapJSON.nodes": nodes, 
        value: newValue,
        max: maxValue,
    })

    return nodes[nodeIndex].id;
}