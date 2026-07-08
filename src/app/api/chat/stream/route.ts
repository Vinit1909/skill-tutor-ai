/**
 * Streaming chat route.
 *
 * Tools included: renderArtifact (always) + webSearch (when TAVILY_API_KEY is set).
 * Progression tools (markNodeInProgress etc.) are deliberately excluded — they caused
 * the model to call a tool BEFORE generating text, making streaming appear broken.
 * Progression is handled by /api/chat/progress, called as a background fetch from
 * the client's onFinish callback.
 *
 * Routing: classifyChatTask() → routeToProviders() → tries providers in order.
 * Vision fallback: if GOOGLE_API_KEY is absent, the image is stripped and the
 * request continues as text-only rather than returning a hard error.
 */

import { streamText, type CoreMessage } from "ai"
import { buildChatSystemPrompt, type ChatSkillContext } from "@/lib/prompts"
import { buildToolSet } from "@/lib/tools/index"
import { routeToProviders, classifyChatTask } from "@/lib/llm-router"
import type { AIProvider } from "@/lib/ai-providers"
import { verifyAuth } from "@/lib/serverAuth"
import { checkRateLimit, recordUsage } from "@/lib/usage"

// Server-side input caps — the client is never trusted to bound its own payload.
const MAX_HISTORY_MESSAGES = 20
const MAX_MESSAGE_CHARS = 8_000
const MAX_IMAGE_DATA_URL_CHARS = 4_200_000 // ≈3MB binary after base64 overhead

export const runtime = "nodejs"
export const maxDuration = 60

// Data-stream protocol part codes (AI SDK v1 wire format):
//   f: start_step   0: text   9: tool_call   a: tool_result
//   2: data   8: annotations   g: reasoning   e: finish_step   d: finish_message
//   3: error
// A line beginning with any of these "content" codes means the provider has
// successfully started producing output. A "3:" line means it errored.
const CONTENT_PART = /^(?:0|2|8|9|a|g|e|d):/
const ERROR_PART = /^3:/

/**
 * Reduces a message's content to plain text. Content may be a string or a
 * multipart array (text + image parts from a prior image turn). Image parts are
 * dropped — only text-only providers see flattened history, and they reject
 * non-string content. The current turn's image is re-attached separately.
 */
function flattenContentToText(content: unknown): string {
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content
      .filter(
        (p): p is { type: "text"; text: string } =>
          !!p &&
          typeof p === "object" &&
          (p as { type?: unknown }).type === "text" &&
          typeof (p as { text?: unknown }).text === "string"
      )
      .map((p) => p.text)
      .join(" ")
      .trim()
  }
  return ""
}

/**
 * Streams from the first healthy provider, with REAL fallback on failure.
 *
 * Why this exists: streamText() returns before the upstream request resolves,
 * so provider errors (429 quota, 401 auth, 5xx) surface DURING stream
 * consumption — after a normal `return result.toDataStreamResponse()` has
 * already handed the response to the client. A plain try/catch around
 * streamText therefore never catches these, and fallback to the next provider
 * never happens.
 *
 * The fix: for each provider we "peek" the formatted data stream until the
 * first content part (success) or error part (failure) appears. Only once a
 * provider is confirmed healthy do we commit its Response — replaying the few
 * peeked bytes, then piping the rest live. Peeking costs only the time-to-
 * first-token, so real-time streaming is preserved.
 */
/**
 * Watches data-stream lines for the finish part (`d:{"finishReason":...,"usage":{...}}`)
 * and reports token usage — the metering hook for cost visibility and, later, billing.
 */
function makeUsageScanner(onUsage: (u: { promptTokens?: number; completionTokens?: number }) => void) {
  const decoder = new TextDecoder()
  let buf = ""
  return (chunk: Uint8Array) => {
    buf += decoder.decode(chunk, { stream: true })
    let nl: number
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl)
      buf = buf.slice(nl + 1)
      if (line.startsWith("d:")) {
        try {
          const parsed = JSON.parse(line.slice(2))
          if (parsed?.usage) onUsage(parsed.usage)
        } catch {
          /* malformed finish part — ignore */
        }
      }
    }
  }
}

async function streamFirstHealthyProvider(
  providers: AIProvider[],
  build: (model: AIProvider["model"]) => ReturnType<typeof streamText>,
  onUsage?: (u: { promptTokens?: number; completionTokens?: number }) => void
): Promise<Response> {
  const decoder = new TextDecoder()
  let lastErrorMsg = "All AI services are currently unavailable. Please try again."

  for (const provider of providers) {
    console.log(`🤖 [stream] ${provider.name}`)

    let dataStream: ReadableStream<Uint8Array>
    try {
      const result = build(provider.model)
      dataStream = result.toDataStream({
        getErrorMessage: (err) => (err instanceof Error ? err.message : String(err)),
      })
    } catch (err) {
      // Synchronous construction failure (rare) — try the next provider.
      lastErrorMsg = err instanceof Error ? err.message : String(err)
      console.error(`❌ [stream] ${provider.name} construct failed:`, lastErrorMsg)
      continue
    }

    const reader = dataStream.getReader()
    const buffered: Uint8Array[] = []
    let textBuffer = ""
    let decision: "ok" | "error" | null = null

    // Peek until the first content or error part is observed.
    while (decision === null) {
      let chunk: ReadableStreamReadResult<Uint8Array>
      try {
        chunk = await reader.read()
      } catch (err) {
        decision = "error"
        lastErrorMsg = err instanceof Error ? err.message : String(err)
        break
      }
      if (chunk.done) {
        // Stream ended during peek with neither content nor error → empty but OK.
        decision = "ok"
        break
      }

      buffered.push(chunk.value)
      textBuffer += decoder.decode(chunk.value, { stream: true })

      // Inspect only COMPLETE lines (the trailing element may be partial).
      const lines = textBuffer.split("\n")
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i]
        if (ERROR_PART.test(line)) {
          decision = "error"
          try {
            lastErrorMsg = JSON.parse(line.slice(2))
          } catch {
            lastErrorMsg = line.slice(2)
          }
          break
        }
        if (CONTENT_PART.test(line)) {
          decision = "ok"
          break
        }
        // "f:" (start_step) is neutral — keep reading.
      }
    }

    if (decision === "error") {
      console.error(`❌ [stream] ${provider.name} failed: ${lastErrorMsg}`)
      try {
        await reader.cancel()
      } catch {
        /* ignore */
      }
      continue // → next provider
    }

    // Provider is healthy. Replay the peeked bytes, then pipe the remainder live.
    console.log(`✅ [stream] ${provider.name} streaming`)
    const scanUsage = onUsage ? makeUsageScanner(onUsage) : null
    const responseStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        for (const b of buffered) {
          scanUsage?.(b)
          controller.enqueue(b)
        }
        try {
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            scanUsage?.(value)
            controller.enqueue(value)
          }
        } catch (err) {
          // Error after content already started — can't switch providers now;
          // emit a data-stream error part so the client surfaces it.
          const msg = err instanceof Error ? err.message : String(err)
          controller.enqueue(new TextEncoder().encode(`3:${JSON.stringify(msg)}\n`))
        } finally {
          controller.close()
        }
      },
      cancel() {
        reader.cancel().catch(() => {})
      },
    })

    return new Response(responseStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Vercel-AI-Data-Stream": "v1",
      },
    })
  }

  // Every provider errored before producing any content.
  console.error("❌ [stream] All providers failed:", lastErrorMsg)
  return Response.json({ error: lastErrorMsg }, { status: 503 })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      messages: rawMessages,
      skillId,
      uid,
      activeNodeId,
      skillContext,
    }: {
      // UIMessages from useChat — the last user message may carry
      // experimental_attachments (uploaded images as data URLs).
      messages: Array<
        CoreMessage & {
          experimental_attachments?: Array<{
            url: string
            contentType?: string
            name?: string
          }>
        }
      >
      skillId: string
      uid: string
      activeNodeId: string | null
      skillContext?: ChatSkillContext
    } = body

    if (!rawMessages || !Array.isArray(rawMessages)) {
      return Response.json({ error: "Invalid messages format" }, { status: 400 })
    }
    if (!uid || !skillId) {
      return Response.json({ error: "Missing uid or skillId" }, { status: 400 })
    }

    // Identity check: the caller must hold a valid Firebase ID token for this uid.
    // Without this, anyone could stream completions on this deployment's quota.
    const auth = await verifyAuth(req, uid)
    if (!auth.ok) {
      return Response.json({ error: auth.error }, { status: auth.status })
    }

    // Per-user rate cap — generous for a human, hostile to a runaway loop.
    const rateError = checkRateLimit(uid)
    if (rateError) {
      return Response.json({ error: rateError }, { status: 429 })
    }

    // Server-side payload bounds: useChat sends the FULL message list each turn,
    // which grows without limit over a long session. Keep the recent window and
    // clamp each message so prompts (and provider bills) stay bounded.
    const bounded = rawMessages.slice(-MAX_HISTORY_MESSAGES)

    // Normalize the whole history to clean { role, content:string } messages.
    // useChat sends rich UIMessages (parts, toolInvocations, and — for prior image
    // turns — multipart array content). Text-only providers (Groq/Together)
    // reject array content with "content must be a string", so we flatten everything
    // to text first. Prior-turn images don't need re-sending for context.
    let messages: CoreMessage[] = bounded.map(
      (m) =>
        ({
          role: m.role,
          content: flattenContentToText(m.content).slice(0, MAX_MESSAGE_CHARS),
        } as CoreMessage)
    )

    // Upgrade ONLY the final user message to multipart when it carries a fresh image.
    //
    // IMPORTANT: pass the RAW base64 string (no "data:...;base64," prefix) to the
    // image part — AI SDK's convertDataContentToUint8Array() runs it through atob()
    // in one call; the full data URL would corrupt it.
    let hasImages = false
    const lastRaw = bounded[bounded.length - 1]
    const imageAtts = (lastRaw?.experimental_attachments ?? []).filter(
      (a) =>
        a.contentType?.startsWith("image/") &&
        typeof a.url === "string" &&
        a.url.length <= MAX_IMAGE_DATA_URL_CHARS // oversized images are dropped, not fatal
    )
    if (lastRaw?.role === "user" && imageAtts.length > 0) {
      const imageParts: Array<{ type: "image"; image: string; mimeType: string }> = []
      for (const att of imageAtts) {
        const m = att.url.match(/^data:([^;]+);base64,(.+)$/)
        if (m) imageParts.push({ type: "image", image: m[2], mimeType: m[1] })
      }
      if (imageParts.length > 0) {
        hasImages = true
        const lastText = flattenContentToText(lastRaw.content)
        messages[messages.length - 1] = {
          role: "user",
          content: [{ type: "text", text: lastText }, ...imageParts],
        } as CoreMessage
      }
    }

    // Route to the appropriate provider(s) based on task type.
    const messagesForClassification = messages as { role: string; content: string | unknown[] }[]
    let routingDecision
    try {
      routingDecision = routeToProviders({
        taskType: classifyChatTask(messagesForClassification, hasImages),
      })
    } catch (err) {
      if (hasImages) {
        // VISION task requested but no multimodal provider is configured.
        // Strip the image parts and fall back to text-only rather than hard-erroring.
        console.warn("⚠️ [stream] No vision provider configured — processing text only")
        messages = messages.map((m) => {
          if (m.role === "user" && Array.isArray(m.content)) {
            const text = (m.content as Array<{ type: string; text?: string }>)
              .filter((p) => p.type === "text")
              .map((p) => p.text ?? "")
              .join(" ")
              .trim()
            return { role: "user" as const, content: text || "(image attached — no vision model configured)" } as CoreMessage
          }
          return m
        })
        routingDecision = routeToProviders({ taskType: "CHAT_SIMPLE" })
      } else {
        return Response.json({ error: (err as Error).message }, { status: 400 })
      }
    }

    console.log(`🧭 [stream] ${routingDecision.rationale}`)

    // skillContext comes from the (authenticated) client. The server never reads
    // Firestore — locked security rules reject unauthenticated client-SDK reads,
    // and the client already has this data loaded anyway.
    const skill = skillContext ?? null
    // Use the base tutor prompt — progression instructions are no longer needed
    // here because progression tools are not in the streaming tool set.
    const systemPrompt = buildChatSystemPrompt(skill, activeNodeId)
    const tools = buildToolSet(uid, skillId)

    const runStream = (msgs: CoreMessage[], providers: typeof routingDecision.providers) =>
      streamFirstHealthyProvider(
        providers,
        (model) =>
          streamText({
            model,
            system: systemPrompt,
            messages: msgs,
            tools,
            maxSteps: 2,    // text response + optional single renderArtifact call
            // Task-aware budget: exercises/diagrams need far more room than chat —
            // the old flat 800 truncated JSON specs and diagrams mid-stream.
            maxTokens: routingDecision.maxTokens,
            maxRetries: 0,  // fail fast → try next provider
          }),
        // Metering: token usage per uid, harvested from the stream finish part.
        (usage) => recordUsage(uid, usage)
      )

    // Stream from the first healthy provider, with real mid-stream fallback.
    const response = await runStream(messages, routingDecision.providers)

    // Graceful degradation: if this was a vision request and every multimodal
    // provider failed (e.g. model unavailable / quota), retry text-only so the
    // user still gets an answer instead of a hard error.
    if (hasImages && !response.ok) {
      console.warn("⚠️ [stream] vision providers failed — retrying text-only")
      const textOnly: CoreMessage[] = messages.map((m) => {
        if (m.role === "user" && Array.isArray(m.content)) {
          const text = (m.content as Array<{ type: string; text?: string }>)
            .filter((p) => p.type === "text")
            .map((p) => p.text ?? "")
            .join(" ")
            .trim()
          return {
            role: "user",
            content: text || "(an image was attached but vision is unavailable)",
          } as CoreMessage
        }
        return m
      })
      return await runStream(textOnly, routeToProviders({ taskType: "CHAT_SIMPLE" }).providers)
    }

    return response
  } catch (err) {
    console.error("❌ [stream] Route error:", err)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
