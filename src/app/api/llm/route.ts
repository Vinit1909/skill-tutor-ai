// import { NextRequest, NextResponse } from "next/server";
// import { callGroqLLM } from "@/lib/llm";

// export async function POST(req: NextRequest) {
//     try{
//         const {messages} = await req.json();
//         if (!Array.isArray(messages)) {
//             return NextResponse.json({error: "No messages array provided."}, {status: 400})
//         }
//         const content = await callGroqLLM(messages);
//         return NextResponse.json({content});
//     } catch (err: unknown) {
//         console.error("LLM API error:", err)
//         const errorMessage = err instanceof Error ? err.message : "Failed to process request"
//         return NextResponse.json({ error: errorMessage }, { status: 500 })
//     }
// }

import { NextRequest, NextResponse } from "next/server"
import { multiLLM } from "@/lib/llm-providers"

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid messages format" },
        { status: 400 }
      )
    }

    console.log("🤖 Starting multi-LLM call with", messages.length, "messages")

    // This will automatically handle provider switching without throwing errors
    const result = await multiLLM.callLLM(messages)

    if (result.switched) {
      console.log(`✅ LLM Response successful via ${result.provider} after switching (attempt ${result.attempt})`)
    } else {
      console.log(`✅ LLM Response successful via ${result.provider} (attempt ${result.attempt})`)
    }

    return NextResponse.json({
      content: result.content,
      provider: result.provider,
      attempt: result.attempt,
      switched: result.switched
    })

  } catch (error: unknown) {
    console.error("❌ All LLM providers failed:", error)
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
    
    // Determine appropriate HTTP status code
    let statusCode = 500
    let userMessage = "AI services are temporarily unavailable. Please try again in a moment."
    
    if (errorMessage.includes("No LLM providers available")) {
      statusCode = 503
      userMessage = "AI services are currently offline. Please try again later."
    } else if (errorMessage.includes("All") && errorMessage.includes("providers failed")) {
      statusCode = 503
      userMessage = "All AI services are experiencing issues. Please try again in a few minutes."
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        userMessage,
        retryable: true
      },
      { status: statusCode }
    )
  }
}