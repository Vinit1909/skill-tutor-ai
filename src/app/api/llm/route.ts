import { NextRequest, NextResponse } from "next/server";
import { callGroqLLM } from "@/lib/llm";

export async function POST(req: NextRequest) {
    try{
        const {messages} = await req.json();
        if (!Array.isArray(messages)) {
            return NextResponse.json({error: "No messages array provided."}, {status: 400})
        }
        const content = await callGroqLLM(messages);
        return NextResponse.json({content});
    } catch (err: unknown) {
        console.error("LLM API error:", err)
        const errorMessage = err instanceof Error ? err.message : "Failed to process request"
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}