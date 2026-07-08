/**
 * Robustly extracts code-exercise specs from an assistant message — by SHAPE,
 * not by fence tag. Weak models tag the block inconsistently (```code-exercise,
 * ```json, ```code, or none) and sometimes fragment it, so we never depend on
 * the tag. Instead we scan for a JSON object that parses as an exercise.
 *
 * The raw spec is removed from the displayed text and rendered as an interactive
 * sandbox instead. During streaming, an incomplete spec is hidden behind a
 * placeholder so the learner never sees raw JSON.
 */
import { parseExerciseSpec } from "./artifactParse"

export interface ExtractResult {
  /** Message text with exercise specs (and their wrapping fences) removed. */
  cleaned: string
  /** Raw JSON strings of the extracted exercises, in order. */
  exercises: string[]
  /** True if an exercise is still being streamed (incomplete) — show a placeholder. */
  preparing: boolean
}

/** Whitespace-insensitive identity for an exercise spec — used to dedupe the
 *  same exercise re-emitted across turns (e.g. the tutor echoing the spec
 *  while reviewing a solution). */
export function exerciseKey(raw: string): string {
  return raw.replace(/\s+/g, "")
}

/**
 * Finds top-level {...} regions, respecting double-quoted strings so braces
 * inside string values don't break balancing. (Backtick code bodies have
 * balanced braces, so they balance out correctly too.)
 */
function findBraceRegions(text: string): Array<{ start: number; end: number }> {
  const regions: Array<{ start: number; end: number }> = []
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue
    let depth = 0
    let inStr = false
    let esc = false
    let j = i
    for (; j < text.length; j++) {
      const c = text[j]
      if (inStr) {
        if (esc) esc = false
        else if (c === "\\") esc = true
        else if (c === '"') inStr = false
      } else if (c === '"') inStr = true
      else if (c === "{") depth++
      else if (c === "}") {
        depth--
        if (depth === 0) break
      }
    }
    if (depth === 0 && j < text.length) {
      regions.push({ start: i, end: j + 1 })
      i = j // skip past this object
    }
  }
  return regions
}

// JSON keys that strongly signal "this is an exercise" (used for streaming detection).
const EXERCISE_SIGNAL = /"starterCode"|"tests"\s*:/

export function extractExercises(content: string, isStreaming: boolean): ExtractResult {
  if (!content || (!content.includes('"starterCode"') && !content.includes('"tests"'))) {
    return { cleaned: content, exercises: [], preparing: false }
  }

  const exercises: string[] = []
  const regions = findBraceRegions(content)

  // Build the cleaned text by removing exercise regions (back-to-front so
  // earlier indices stay valid).
  let cleaned = content
  for (let k = regions.length - 1; k >= 0; k--) {
    const { start, end } = regions[k]
    const raw = content.slice(start, end)
    if (parseExerciseSpec(raw)) {
      exercises.unshift(raw)
      cleaned = cleaned.slice(0, start) + cleaned.slice(end)
    }
  }

  // Remove now-empty wrapping fences left behind (```code-exercise\n\n```), and
  // tidy whitespace.
  cleaned = cleaned.replace(/```[a-zA-Z0-9_-]*\s*```/g, "")

  let preparing = false
  if (isStreaming && EXERCISE_SIGNAL.test(cleaned)) {
    // An exercise is mid-stream (signal present but not yet a complete object).
    // Hide everything from where it starts so the learner doesn't see raw JSON.
    const sig = cleaned.search(EXERCISE_SIGNAL)
    // Back up to the start of the enclosing fence or JSON object.
    const fenceIdx = cleaned.lastIndexOf("```", sig)
    const braceIdx = cleaned.lastIndexOf("{", sig)
    const cut = Math.max(fenceIdx === -1 ? 0 : fenceIdx, braceIdx === -1 ? 0 : braceIdx)
    cleaned = cleaned.slice(0, cut)
    // Drop a dangling fence opener (```code, ```json…) left just before the spec.
    cleaned = cleaned.replace(/```[a-zA-Z0-9_-]*\s*$/, "")
    preparing = true
  }

  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim()
  return { cleaned, exercises, preparing }
}
