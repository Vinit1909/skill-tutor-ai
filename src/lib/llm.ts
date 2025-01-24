import { ChatGroq } from "@langchain/groq"

export async function callGroqLLM(
    messages: {role: "user" | "assistant"; content: string}[]
): Promise<any> {
    if (!process.env.GROQ_API_KEY) {
        throw new Error("Missing GROQ_API_KEY in environment");
    }

    const llm = new ChatGroq({
        model: "llama-3.3-70b-versatile",
        temperature: 0.7, 
        maxTokens: undefined,
        maxRetries: 2,
    });

    const aiMsg = await llm.invoke(messages);

    // return Array.isArray(aiMsg.content) ? aiMsg.content.join(' ') : aiMsg.content.toString();
    return aiMsg.content;
}