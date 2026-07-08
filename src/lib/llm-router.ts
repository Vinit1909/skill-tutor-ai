/**
 * LLM routing layer — intelligently selects provider candidates based on task type.
 *
 * Routing is heuristic-based: synchronous, zero-cost, zero-latency.
 * The result is an ordered provider list; the caller iterates it using the same
 * fail-fast pattern as today (maxRetries: 0, try next on error).
 *
 * Every decision also carries a task-appropriate output token budget — exercises
 * and diagrams need far more room than chat (truncated JSON specs and diagrams
 * were a recurring source of breakage at a flat 800).
 *
 * Extensibility:
 *  - Add a new provider → add to getOrderedProviders() in ai-providers.ts
 *  - Add routing rules → extend PREFERENCE_ORDER / RATIONALES / MAX_TOKENS below
 */

import { getOrderedProviders, type AIProvider } from "./ai-providers"

export type TaskType =
  | "CHAT_SIMPLE"    // short Q&A → fast/cheap model
  | "CHAT_COMPLEX"   // multi-step reasoning → strong model
  | "CODE_ANALYSIS"  // code explanation/debugging → strong model
  | "VISION"         // image in message → multimodal model only
  | "DIAGRAM"        // mermaid/diagram request → model strongest at syntax
  | "EXERCISE"       // coding-exercise request → strong model + big budget (JSON spec)
  | "STRUCTURED"     // generateObject/JSON schema → reliable JSON-mode model
  | "PROGRESSION"    // tool dispatch only (no prose) → smallest model

export interface RoutingDecision {
  providers: AIProvider[]
  /** Logged server-side for observability; never sent to the client. */
  rationale: string
  /** Output token budget appropriate for this task. */
  maxTokens: number
}

// Provider names match the strings in ai-providers.ts exactly.
//
// MEASURED LATENCY VERDICT (2026-06-11, live through the AI SDK):
//   Groq 70b:        TTFT 0.3s, ~420 tok/s
//   NIM 675B:        TTFT 120–260s (free-tier queue), ~9 tok/s — unusable
//   NIM mid-size:    reasoning-hybrid models, empty text channel — incompatible
// Therefore Groq leads every interactive chain. NVIDIA NIM models are kept as
// LAST-RESORT fallbacks only: when every fast provider is down, a slow answer
// (minutes) still beats a hard error. Do not promote them without re-measuring.
const PREFERENCE_ORDER: Record<TaskType, string[]> = {
  CHAT_SIMPLE: [
    "Groq (llama-3.1-8b)",   // fast, cheap, sufficient for simple Q&A
    "Groq (llama-3.3-70b)",  // fallback if 8b is rate-limited
    "Google Gemini",
    "Together AI",
  ],
  CHAT_COMPLEX: [
    "Groq (llama-3.3-70b)",
    "Google Gemini",
    "Together AI",
    "NVIDIA (mistral-large-3-675b)", // last resort: slow but high quality
    // skip 8b — not reliable for deep reasoning
  ],
  CODE_ANALYSIS: [
    "Groq (llama-3.3-70b)",
    "Google Gemini",
    "Together AI",
    "NVIDIA (mistral-large-3-675b)",
  ],
  VISION: [
    "Groq (llama-4-scout vision)",   // fastest multimodal, renewable limits
    "Google Gemini",
    "NVIDIA (llama-3.2-90b-vision)", // last resort (slow free-tier queue)
    // If none are available, routeToProviders throws and the stream route
    // strips the image and answers text-only.
  ],
  DIAGRAM: [
    "Google Gemini",          // strongest fast option for Mermaid syntax
    "Groq (llama-3.3-70b)",
    "Together AI",
    "NVIDIA (mistral-large-3-675b)",
  ],
  EXERCISE: [
    "Groq (llama-3.3-70b)",   // strict JSON spec; sanitizer guardrails cover the gaps
    "Google Gemini",
    "NVIDIA (mistral-large-3-675b)",
  ],
  STRUCTURED: [
    "Groq (llama-3.3-70b)",  // measured 2.0s for a full roadmap (NIM 675B: 262.8s)
    "Google Gemini",
    "Together AI",
    "NVIDIA (mistral-large-3-675b)",
  ],
  PROGRESSION: [
    "Groq (llama-3.1-8b)",   // tool dispatch only — no prose needed
    "Groq (llama-3.3-70b)",
    "Google Gemini",
  ],
}

const RATIONALES: Record<TaskType, string> = {
  CHAT_SIMPLE:   "Short Q&A → Groq 8b (fast, cheap); 70b+ as fallback",
  CHAT_COMPLEX:  "Multi-step reasoning → Groq 70b (NIM only as last resort — latency)",
  CODE_ANALYSIS: "Code explanation → Groq 70b (NIM only as last resort — latency)",
  VISION:        "Image input → multimodal (Groq Scout → Gemini → NVIDIA 90b-vision)",
  DIAGRAM:       "Diagram request → Gemini; Groq 70b fallback",
  EXERCISE:      "Coding exercise → Groq 70b (strict JSON spec; 8b excluded)",
  STRUCTURED:    "JSON schema output → Groq 70b (2s measured; NIM 675B took 263s)",
  PROGRESSION:   "Tool dispatch only → Groq 8b (no prose needed)",
}

// Output budgets. Exercises carry a full JSON spec + explanation; diagrams carry
// classDef styling blocks. A flat 800 caused mid-spec truncation bugs.
const MAX_TOKENS: Record<TaskType, number> = {
  CHAT_SIMPLE: 800,
  CHAT_COMPLEX: 1000,
  CODE_ANALYSIS: 1000,
  VISION: 800,
  DIAGRAM: 1400,
  EXERCISE: 1600,
  STRUCTURED: 4000,
  PROGRESSION: 200,
}

/**
 * Returns an ordered provider list optimized for the given task.
 * Providers not explicitly preferred are appended at the end as extra fallbacks.
 *
 * Throws if task is VISION and no vision-capable provider is configured.
 */
export function routeToProviders(context: { taskType: TaskType }): RoutingDecision {
  const all = getOrderedProviders()
  const preferredNames = PREFERENCE_ORDER[context.taskType]

  const ordered: AIProvider[] = []
  const seen = new Set<string>()

  // Add preferred providers in order (only if available in current env)
  for (const name of preferredNames) {
    const found = all.find((p) => p.name === name)
    if (found && !seen.has(found.name)) {
      ordered.push(found)
      seen.add(found.name)
    }
  }

  // Vision requires a multimodal provider — fail fast rather than silently route wrong
  if (context.taskType === "VISION" && ordered.length === 0) {
    throw new Error(
      "Vision task requires a multimodal provider — none is configured."
    )
  }

  // Append any remaining providers as extra fallbacks — EXCEPT for VISION, where
  // text-only models can't process image content and would just error out. Vision
  // is restricted to the explicitly multimodal providers above.
  if (context.taskType !== "VISION") {
    for (const provider of all) {
      if (!seen.has(provider.name)) {
        ordered.push(provider)
        seen.add(provider.name)
      }
    }
  }

  return {
    providers: ordered,
    rationale: RATIONALES[context.taskType],
    maxTokens: MAX_TOKENS[context.taskType],
  }
}

/**
 * Classifies a chat request based on synchronous heuristics.
 * Zero cost — no LLM call. Covers ~90% of cases correctly.
 *
 * Classification logic:
 * - Has image parts → VISION
 * - Asks for a coding exercise/practice → EXERCISE (strong model, big budget)
 * - Asks for a diagram/visual → DIAGRAM (strongest-syntax model)
 * - Contains code AND is non-trivial length → CODE_ANALYSIS
 * - Long message → CHAT_COMPLEX
 * - Default → CHAT_SIMPLE
 */
// Diagram-intent keywords. Kept tight to avoid false positives: "architecture"
// or "explain" alone don't qualify, but explicit visual-construction requests do.
const DIAGRAM_INTENT =
  /\b(diagram|flow ?chart|mermaid|visuali[sz]e|sketch (out|a|the)|draw (me )?(a|the|out)|graph (it|this|the)|sequence diagram|flow ?graph)\b/i

// Short iteration/edit phrases that refer back to a diagram the tutor just drew
// ("color code the same", "make it simpler", "redo it", "add a node"). These
// carry no diagram keyword themselves, so we only treat them as DIAGRAM when a
// recent assistant turn actually produced a diagram (see recentTurnHadDiagram).
const DIAGRAM_FOLLOWUP =
  /\b(colou?r[ -]?cod|the same|same (diagram|thing|one|chart)|do it again|try again|re-?do|re-?make|re-?draw|re-?generate|regenerate|make it|simplif|expand it|add (a|an|the|more|another)|remove (the|a|that)|bigger|smaller|cleaner)\b/i

// Exercise-intent keywords. "Give me an exercise on arrays" is only 6 words, so
// without this it routed to CHAT_SIMPLE → Groq 8b — the root cause of broken
// exercise specs. Exercises must always go to a strong model.
const EXERCISE_INTENT =
  /\b(exercise|practice problem|coding (problem|challenge|question)|leetcode|kata|quiz me|test me|challenge me|problem (to|for me to) (solve|practice))\b/i

// Follow-ups that iterate on an exercise ("another one", "harder", "easier one").
const EXERCISE_FOLLOWUP =
  /\b(another (one|exercise|problem)|one more|harder|easier|next (one|problem|exercise)|different (one|problem|exercise))\b/i

// Detects whether one of the last few assistant turns produced a diagram —
// either a ```mermaid fence, a flowchart header, or text introducing one.
function recentTurnHadDiagram(
  messages: { role: string; content: string | unknown[] }[]
): boolean {
  for (const m of messages.slice(-4)) {
    if (m.role !== "assistant") continue
    const c = typeof m.content === "string" ? m.content : ""
    if (/```mermaid|graph\s+(TD|LR|RL|BT|TB)|flowchart\s|sequenceDiagram|\bmermaid\b/i.test(c))
      return true
  }
  return false
}

// Detects whether one of the last few assistant turns produced a coding exercise.
function recentTurnHadExercise(
  messages: { role: string; content: string | unknown[] }[]
): boolean {
  for (const m of messages.slice(-4)) {
    if (m.role !== "assistant") continue
    const c = typeof m.content === "string" ? m.content : ""
    if (/"starterCode"|```code-exercise/i.test(c)) return true
  }
  return false
}

export function classifyChatTask(
  messages: { role: string; content: string | unknown[] }[],
  hasImages = false
): TaskType {
  if (hasImages) return "VISION"

  const lastUser = [...messages].reverse().find((m) => m.role === "user")
  if (!lastUser) return "CHAT_SIMPLE"

  const text = typeof lastUser.content === "string" ? lastUser.content : ""
  const wordCount = text.split(/\s+/).filter(Boolean).length

  // Coding-exercise requests → strong model + big budget (strict JSON spec).
  if (EXERCISE_INTENT.test(text)) return "EXERCISE"
  if (wordCount <= 20 && EXERCISE_FOLLOWUP.test(text) && recentTurnHadExercise(messages))
    return "EXERCISE"

  // Explicit diagram request → model best at producing valid Mermaid syntax.
  if (DIAGRAM_INTENT.test(text)) return "DIAGRAM"

  // Follow-up iteration on a diagram the tutor just drew. Routing these to the
  // strong model (not Groq 8b) is what makes diagram rendering CONSISTENT —
  // 8b frequently produces malformed or prose-only "diagrams".
  if (wordCount <= 30 && DIAGRAM_FOLLOWUP.test(text) && recentTurnHadDiagram(messages))
    return "DIAGRAM"

  // Heuristic: code-like content in a non-trivial message → CODE_ANALYSIS
  const hasCode =
    /```[\s\S]|`[^`\n]+`|function\s+\w|\bclass\s+\w|import\s+\w|const\s+\w\s*=|def\s+\w+\(/.test(
      text
    )

  if (hasCode && wordCount > 25) return "CODE_ANALYSIS"
  if (wordCount > 75) return "CHAT_COMPLEX"
  return "CHAT_SIMPLE"
}
