import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  limit,
  limitToLast,
  endBefore,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore"
import { db } from "./firebase"

export interface ChatMessageData {
  id?: string
  role: string | "user" | "assistant"
  content: string
  createdAt?: Timestamp
  nodeId?: string
  skillId?: string
}

export interface PaginatedMessages {
  messages: ChatMessageData[]
  /** Pass this cursor to the next loadChatMessages call to load older messages */
  oldestCursor: QueryDocumentSnapshot<DocumentData> | null
  hasMore: boolean
}

const PAGE_SIZE = 20

/**
 * Loads the most recent chat messages (paginated).
 *
 * @param uid - Firebase user ID
 * @param skillId - Skill space ID
 * @param beforeCursor - Optional cursor from a previous call to load older messages
 * @param pageSize - Number of messages per page (default 20)
 */
export async function loadChatMessages(
  uid: string,
  skillId: string,
  beforeCursor?: QueryDocumentSnapshot<DocumentData> | null,
  pageSize: number = PAGE_SIZE
): Promise<PaginatedMessages> {
  const ref = collection(db, "users", uid, "skillspaces", skillId, "chats")

  let q
  if (beforeCursor) {
    // Load older messages before the cursor
    q = query(
      ref,
      orderBy("createdAt", "asc"),
      endBefore(beforeCursor),
      limitToLast(pageSize)
    )
  } else {
    // Initial load: get the most recent N messages, ordered oldest-first for display
    // We fetch descending limited, then reverse to get ascending order
    q = query(ref, orderBy("createdAt", "desc"), limit(pageSize))
  }

  const snap = await getDocs(q)

  let docs = snap.docs

  if (!beforeCursor) {
    // Reverse so oldest is first (for correct chat display order)
    docs = [...docs].reverse()
  }

  const messages: ChatMessageData[] = docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      role: data.role,
      content: data.content,
      createdAt: data.createdAt,
      nodeId: data.nodeId,
      skillId: data.skillId,
    }
  })

  // The oldest cursor is the first doc in the result set (after reversal for initial load)
  const oldestCursor = docs.length > 0 ? docs[0] : null
  const hasMore = snap.docs.length === pageSize

  return { messages, oldestCursor, hasMore }
}

export async function addChatMessage(
  uid: string,
  skillId: string,
  role: "user" | "assistant",
  content: string,
  nodeId?: string
) {
  const ref = collection(db, "users", uid, "skillspaces", skillId, "chats")
  await addDoc(ref, {
    role,
    content,
    createdAt: serverTimestamp(),
    ...(nodeId ? { nodeId } : {}),
  })
}

export async function clearChatmessages(uid: string, skillId: string) {
  const ref = collection(db, "users", uid, "skillspaces", skillId, "chats")
  const snap = await getDocs(ref)
  const batchDeletes: Promise<void>[] = []

  snap.forEach((docSnap) => {
    const msgRef = doc(db, "users", uid, "skillspaces", skillId, "chats", docSnap.id)
    batchDeletes.push(deleteDoc(msgRef))
  })
  await Promise.all(batchDeletes)
}
