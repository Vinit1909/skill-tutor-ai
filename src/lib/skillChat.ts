import {
    collection,
    addDoc,
    deleteDoc,
    doc, 
    getDocs,
    query,
    orderBy,
    serverTimestamp
} from "firebase/firestore"
import {db} from "./firebase"

export interface ChatMessageData {
    id?: string,
    role: string | "user" | "assistant",
    content: string,
    createdAt?: any;
    nodeId?: string;
    skillId?: string;
}

export async function loadChatMessages(uid: string, skillId: string): Promise<ChatMessageData[]> {
    const ref = collection(db, "users", uid, "skillspaces", skillId, "chats");
    const q = query(ref, orderBy("createdAt", "asc"));
    const snap = await getDocs(q);

    const messages: ChatMessageData[] = [];
    snap.forEach((docSnap) => {
        const data = docSnap.data();
        messages.push({
            id: docSnap.id, 
            role: data.role,
            content: data.content,
            createdAt: data.createdAt,
        });
    });
    return messages;
}

export async function addChatMessage(
    uid: string,
    skillId: string,
    role: "user" | "assistant",
    content: string,
) {
    const ref = collection(db, "users", uid, "skillspaces", skillId, "chats");
    await addDoc(ref, {
        role, 
        content, 
        createdAt: serverTimestamp(),
    });
}

export async function clearChatmessages(uid: string, skillId: string) {
    const ref = collection(db, "users", uid, "skillspaces", skillId, "chats");
    const snap = await getDocs(ref);
    const batchDeletes: Promise<void>[] = [];

    snap.forEach((docSnap) => {
        const msgRef = doc(db, "users", uid, "skillspaces", skillId, "chats", docSnap.id);
        batchDeletes.push(deleteDoc(msgRef));
    });
    await Promise.all(batchDeletes);
}