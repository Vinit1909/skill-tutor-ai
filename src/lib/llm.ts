import { ChatGroq } from "@langchain/groq"
import { db } from "./firebase"
import { doc, getDoc } from "firebase/firestore"

export async function callGroqLLM(
    messages: {role: "user" | "assistant"; content: string}[]
): Promise<any> {
    if (!process.env.GROQ_API_KEY) {
        throw new Error("Missing GROQ_API_KEY");
    }

    const llm = new ChatGroq({
        model: "llama-3.3-70b-versatile",
        temperature: 0.7, 
        maxTokens: undefined,
        maxRetries: 2,
    });

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
        console.log("LLM fetched roadmap:", roadmap) // Debugging
        // Optionally enhance response logic here if needed
        }
    }

    const aiMsg = await llm.invoke(messages);
    // return Array.isArray(aiMsg.content) ? aiMsg.content.join(' ') : aiMsg.content.toString();
    return aiMsg.content;
}