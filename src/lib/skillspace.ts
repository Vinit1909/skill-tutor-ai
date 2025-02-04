import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore"
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
    roadmapJSON?: any
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