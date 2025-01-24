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
    } catch (err: any) {
        console.error("LLM error:", err );
        return NextResponse.json({error: err.message}, {status: 500});
    }
}