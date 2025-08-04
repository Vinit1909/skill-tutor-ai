// import { ChatGroq } from "@langchain/groq"
// import { db } from "./firebase"
// import { doc, getDoc } from "firebase/firestore"

// interface ChatMessage {
//   role: "user" | "assistant"
//   content: string
// }

// export async function callGroqLLM(
//     messages: ChatMessage[]
// ): Promise<string> {
//     if (!process.env.GROQ_API_KEY) {
//         throw new Error("Missing GROQ_API_KEY")
//     }

//     const llm = new ChatGroq({
//         model: "qwen/qwen3-32b",
//         temperature: 0.7, 
//         maxTokens: undefined,
//         maxRetries: 2,
//     })

//     const systemMessage = messages.find(m => m.role === "assistant")?.content || ""
//     const skillIdMatch = systemMessage.match(/skillspaces\/([^ ]+)/)
//     if (skillIdMatch) {
//         const skillId = skillIdMatch[1]
//         const uidMatch = systemMessage.match(/users\/([^\/]+)/)
//         const uid = uidMatch ? uidMatch[1] : ""
//         const skillRef = doc(db, "users", uid, "skillspaces", skillId)
//         const snap = await getDoc(skillRef)
//         if (snap.exists()) {
//             const roadmap = snap.data().roadmapJSON
//             console.log("LLM fetched roadmap:", roadmap) // Debugging
//             // Optionally enhance response logic here if needed
//         }
//     }

//     // Convert ChatMessage[] to BaseMessageLike[]
//     const baseMessages = messages.map(m => ({
//         type: m.role, // 'user' or 'assistant'
//         content: m.content
//     }))

//     const aiMsg = await llm.invoke(baseMessages)
    
//     // Handle different types of content that might be returned
//     if (typeof aiMsg.content === "string") {
//         return aiMsg.content
//     } else if (Array.isArray(aiMsg.content)) {
//         return aiMsg.content.join(" ")
//     } else {
//         return String(aiMsg.content)
//     }
// }


import { multiLLM } from "./llm-providers"
import { db } from "./firebase"
import { doc, getDoc } from "firebase/firestore"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export async function callGroqLLM(
    messages: ChatMessage[]
): Promise<string> {
    console.log("⚠️ callGroqLLM is deprecated, using multi-LLM system instead...")
    
    // Extract skill context if available
    const systemMessage = messages.find(m => m.role === "assistant")?.content || ""
    const skillIdMatch = systemMessage.match(/skillspaces\/([^ ]+)/)
    if (skillIdMatch) {
        const skillId = skillIdMatch[1]
        const uidMatch = systemMessage.match(/users\/([^\/]+)/)
        const uid = uidMatch ? uidMatch[1] : ""
        const skillRef = doc(db, "users", uid, "skillspaces", skillId)
        const snap = await getDoc(skillRef)
        if (snap.exists()) {
            const roadmap = snap.data().roadmapJSON
            console.log("LLM fetched roadmap:", roadmap)
        }
    }

    // Use the multi-LLM system
    const result = await multiLLM.callLLM(messages)
    return result.content
}