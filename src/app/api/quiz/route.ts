import { NextRequest, NextResponse } from "next/server"
import { generateObject } from "ai"
import { routeToProviders } from "@/lib/llm-router"
import { buildQuizPrompt } from "@/lib/prompts"
import { QuizResponseSchema, QuizQuestion } from "@/lib/schemas"
import { verifyAuth } from "@/lib/serverAuth"
import { checkRateLimit } from "@/lib/usage"

export const runtime = "nodejs"
export const maxDuration = 30

// Server-side input bounds — context comes from the client and must be clamped.
const MAX_CHAT_CONTEXT_CHARS = 12_000
const MAX_NODE_TITLES_CHARS = 600

export async function POST(req: NextRequest) {
  try {
    // The authenticated client supplies the topic titles and chat context — the
    // server never reads Firestore (locked rules reject unauthenticated
    // client-SDK reads, and the browser already has this data loaded).
    const { uid, skillId, skillName, nodeTitles, chatContext } = await req.json()
    if (!uid || !skillId || typeof skillName !== "string" || typeof nodeTitles !== "string" || !nodeTitles.trim()) {
      return NextResponse.json({ error: "Missing or invalid parameters" }, { status: 400 })
    }

    // Identity check — quiz generation runs on this user's behalf and quota.
    const auth = await verifyAuth(req, uid)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const rateError = checkRateLimit(uid)
    if (rateError) {
      return NextResponse.json({ error: rateError }, { status: 429 })
    }

    const chatHistory =
      typeof chatContext === "string" && chatContext.trim()
        ? chatContext.slice(0, MAX_CHAT_CONTEXT_CHARS)
        : "No chat history available."

    const prompt = buildQuizPrompt({
      skillName: skillName.slice(0, 200),
      nodeTitles: nodeTitles.slice(0, MAX_NODE_TITLES_CHARS),
      chatHistory,
    })

    // ── Try each provider in routing order (STRUCTURED task → Groq 70b preferred) ─
    const { providers, rationale } = routeToProviders({ taskType: "STRUCTURED" })
    console.log(`🧭 [quiz] ${rationale}`)
    let questions: QuizQuestion[] | null = null

    for (const provider of providers) {
      try {
        console.log(`🎯 [quiz] ${provider.name} — generating for: ${nodeTitles}`)

        const { object } = await generateObject({
          model: provider.model,
          schema: QuizResponseSchema,
          prompt,
          maxRetries: 0, // fail fast — we handle failover ourselves
          // Per-provider deadline so a queued provider fails over instead of
          // hanging the request (see roadmapAI.ts for the measured incident).
          abortSignal: AbortSignal.timeout(45_000),
        })

        // Post-parse quality filter (same as before, but now type-safe)
        const valid = object.questions.filter((q) => {
          if (q.type === "multiple-choice") {
            return (
              q.options &&
              q.options.length === 4 &&
              ["a", "b", "c", "d"].includes(q.correctAnswer as string)
            )
          }
          if (q.type === "fill-in-the-blank") {
            return typeof q.correctAnswer === "string" && q.correctAnswer.length > 0
          }
          if (q.type === "matching") {
            return (
              q.pairs &&
              q.pairs.length >= 2 &&
              Array.isArray(q.correctAnswer)
            )
          }
          return false
        })

        if (valid.length < 5) {
          console.warn(`⚠️ [quiz] ${provider.name} — only ${valid.length} valid questions, trying next provider`)
          continue
        }

        console.log(`✅ [quiz] ${provider.name} — ${valid.length} questions`)
        questions = valid
        break
      } catch (err) {
        console.error(`❌ [quiz] ${provider.name} failed:`, err)
        // Try next provider
      }
    }

    if (!questions) {
      // Honest failure beats filler questions ("What is a key feature of X? →
      // All of the above" teaches nothing and erodes trust). The client shows
      // an error state with a retry button.
      console.warn("⚠️ [quiz] All providers failed — returning error (no filler fallback)")
      return NextResponse.json(
        { error: "Quiz generation is temporarily unavailable. Please try again in a moment." },
        { status: 503 }
      )
    }

    return NextResponse.json(questions)
  } catch (err: unknown) {
    console.error("Quiz API error:", err)
    const errorMessage = err instanceof Error ? err.message : "Failed to generate exercises"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
