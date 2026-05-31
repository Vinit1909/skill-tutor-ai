/**
 * Text-only chat route.
 * Generates the AI teaching response with NO tool calls.
 * Runs in parallel with /api/chat/progress (which handles node progression).
 *
 * Optimisations vs. the old combined route:
 * - No tools → single LLM call, no multi-step overhead
 * - maxRetries: 0 → fail fast to next provider (no 12-15s retry loops)
 * - maxTokens: 800 → focused responses, faster generation
 * - history.slice(-10) enforced client-side → fixed token ceiling
 */

import { generateText } from "ai"
import { getOrderedProviders } from "@/lib/ai-providers"
import { buildChatSystemPrompt, type ChatSkillContext } from "@/lib/prompts"
import { getSkillSpace } from "@/lib/skillspace"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      messages,
      skillId,
      uid,
      activeNodeId,
      skillContext,
    }: {
      messages: { role: "user" | "assistant"; content: string }[]
      skillId: string
      uid: string
      activeNodeId: string | null
      skillContext?: ChatSkillContext
    } = body

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: "Invalid messages format" }, { status: 400 })
    }
    if (!uid || !skillId) {
      return Response.json({ error: "Missing uid or skillId" }, { status: 400 })
    }

    const systemPrompt = skillContext
      ? buildChatSystemPrompt(skillContext, activeNodeId)
      : buildChatSystemPrompt(await getSkillSpace(uid, skillId), activeNodeId)

    const providers = getOrderedProviders()
    if (providers.length === 0) {
      return Response.json({ error: "No AI providers configured." }, { status: 503 })
    }

    let lastError: unknown
    for (const provider of providers) {
      try {
        console.log(`🤖 [chat] ${provider.name}`)

        const result = await generateText({
          model: provider.model,
          system: systemPrompt,
          messages,
          maxSteps: 1,      // single LLM call — no tool overhead
          maxTokens: 800,   // focused responses generate faster
          maxRetries: 0,    // fail fast → move to next provider immediately
        })

        console.log(`✅ [chat] ${provider.name} — ${result.usage.totalTokens} tokens`)
        return Response.json({ content: result.text })
      } catch (err) {
        console.error(`❌ [chat] ${provider.name} failed:`, err)
        lastError = err
      }
    }

    console.error("❌ [chat] All providers failed:", lastError)
    return Response.json(
      { error: "All AI services are currently unavailable. Please try again." },
      { status: 503 }
    )
  } catch (err) {
    console.error("❌ [chat] Route error:", err)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
