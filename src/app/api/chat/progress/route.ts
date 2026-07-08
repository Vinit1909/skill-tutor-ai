/**
 * Progression-only chat route.
 * Runs in parallel with /api/chat (which handles text generation).
 * Its sole job: call markNodeInProgress / markNodeComplete / suggestNextNode
 * based on the conversation. No text response is generated.
 *
 * Optimisations:
 * - maxSteps: 2 → tool call + optional follow-up (suggestNextNode after markNodeComplete)
 * - maxRetries: 0 → fail fast; progression failure is non-critical
 * - No maxTokens cap needed — tools generate no text output
 * - On any failure: returns { toolInvocations: [] } silently — never blocks UI
 *
 * Server-side guardrails (before the LLM is even called):
 * - Requires at least 2 user messages — greetings and opening messages are ignored
 * - The latest user message must be longer than 10 characters (filters "hi", "hello", "ok")
 */

import { generateText } from "ai"
import { getOrderedProviders } from "@/lib/ai-providers"
import { buildProgressionSystemPrompt, type ChatSkillContext } from "@/lib/prompts"
import { createProgressionTools, type ToolInvocationResult } from "@/lib/progression"
import { verifyAuth } from "@/lib/serverAuth"

export const runtime = "nodejs"
export const maxDuration = 30

/** Pure greeting strings that alone should never trigger progression */
const PURE_GREETINGS = new Set([
  "hello", "hi", "hey", "hiya", "howdy",
])

/**
 * Returns false only for pure greeting-only messages.
 * Everything else (including short engagement like "I'm on Windows",
 * "yes", "ok sounds good") is treated as substantive by the server —
 * the LLM makes the final call on whether to update progression.
 */
function isSubstantiveMessage(content: string): boolean {
  const trimmed = content.trim().toLowerCase().replace(/[!.,?]+$/, "")
  if (trimmed.length < 3) return false                    // empty or 1-2 chars
  if (PURE_GREETINGS.has(trimmed)) return false           // exact pure greeting
  return true
}

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
      return Response.json({ toolInvocations: [] }, { status: 400 })
    }
    if (!uid || !skillId || !activeNodeId) {
      // No active node → nothing to track
      return Response.json({ toolInvocations: [] })
    }

    // Identity check — progression writes are attributed to this uid client-side.
    const auth = await verifyAuth(req, uid)
    if (!auth.ok) {
      return Response.json({ toolInvocations: [], error: auth.error }, { status: auth.status })
    }

    // ── Server-side guardrails ─────────────────────────────────────────────
    const userMessages = messages.filter((m) => m.role === "user")
    const userMessageCount = userMessages.length

    const latestUserMsg = userMessages[userMessages.length - 1]?.content ?? ""
    console.log(`📊 [progress] ${userMessageCount} user msg(s), latest: "${latestUserMsg.slice(0, 60)}"`)

    // Guard 1: require at least 2 user messages (first message is always a greeting/opener)
    if (userMessageCount < 2) {
      console.log(`⏭️ [progress] Skipped — only ${userMessageCount} user message(s)`)
      return Response.json({ toolInvocations: [] })
    }

    // Guard 2: latest user message must not be a pure greeting
    if (!isSubstantiveMessage(latestUserMsg)) {
      console.log(`⏭️ [progress] Skipped — pure greeting: "${latestUserMsg}"`)
      return Response.json({ toolInvocations: [] })
    }

    // ── Build prompt & call LLM ────────────────────────────────────────────
    // Context comes from the authenticated client; the server never reads Firestore.
    const skill = skillContext ?? null
    const systemPrompt = buildProgressionSystemPrompt(skill, activeNodeId, userMessageCount)

    const providers = getOrderedProviders()
    if (providers.length === 0) {
      return Response.json({ toolInvocations: [] })
    }

    const tools = createProgressionTools(uid, skillId)

    for (const provider of providers) {
      try {
        console.log(`🔄 [progress] ${provider.name} — ${userMessageCount} user messages`)

        const result = await generateText({
          model: provider.model,
          system: systemPrompt,
          // Recent window only — progression decisions don't need deep history,
          // and the payload must stay bounded server-side.
          messages: messages.slice(-12),
          tools,
          maxSteps: 2,    // 1 tool call + possible suggestNextNode after markNodeComplete
          maxRetries: 0,  // fail fast — progression is background, not critical
        })

        // Collect all tool results from every step
        const toolInvocations: ToolInvocationResult[] = []
        for (const step of result.steps) {
          for (const toolResult of step.toolResults) {
            toolInvocations.push({
              toolName: toolResult.toolName,
              result: toolResult.result,
            })
          }
        }

        console.log(
          `✅ [progress] ${provider.name} — ${toolInvocations.length} tool(s) called`
        )
        return Response.json({ toolInvocations })
      } catch (err) {
        console.error(`❌ [progress] ${provider.name} failed:`, err)
        // Try next provider
      }
    }

    // All providers failed — return empty (non-critical path)
    console.warn("⚠️ [progress] All providers failed — returning empty tool invocations")
    return Response.json({ toolInvocations: [] })
  } catch (err) {
    console.error("❌ [progress] Route error:", err)
    return Response.json({ toolInvocations: [] })
  }
}
