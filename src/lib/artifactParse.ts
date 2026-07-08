/**
 * Tolerant parsing + grading guardrails for code-exercise artifacts.
 *
 * ASSUME A WEAK MODEL. It produces *almost*-valid specs in many ways:
 *  - backtick-delimited strings for starterCode (not valid JSON)
 *  - Python literals None / True / False instead of null / true / false
 *  - test "call" strings with unbalanced parens/brackets (e.g. "f([1,2,3]" )
 *  - "expected" written as a JSON value (number, null, string) rather than a string
 *
 * Every one of these would otherwise break the sandbox or fail a CORRECT solution.
 * We repair them so the learner's experience never depends on the model getting
 * the JSON perfect.
 */
import type { CodeExerciseSpec } from "./tools/artifacts"
import { isClientRunnable } from "./execLanguages"

function tryJson(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return undefined
  }
}

/** Convert `...` backtick strings to properly-escaped JSON strings. */
function repairBackticks(raw: string): string {
  return raw.replace(/`([\s\S]*?)`/g, (_m, inner) => JSON.stringify(inner))
}

/**
 * Replace Python literals with JSON ones, but ONLY in value positions (after
 * ':', '[' or ',') so we don't corrupt the word inside ordinary string text.
 */
function repairPythonLiterals(raw: string): string {
  return raw
    .replace(/([:[,]\s*)None\b/g, "$1null")
    .replace(/([:[,]\s*)True\b/g, "$1true")
    .replace(/([:[,]\s*)False\b/g, "$1false")
}

/**
 * Balance trailing parens/brackets in a test call so it never produces a syntax
 * error when embedded in the run harness. Brackets (inner) are closed before
 * parens (outer), which matches how calls like "f([1,2,3]" should close.
 */
export function balanceCall(call: string): string {
  let s = call.trim()
  const fix = (open: string, close: string) => {
    const o = s.split(open).length - 1
    const c = s.split(close).length - 1
    if (o > c) s += close.repeat(o - c)
  }
  fix("[", "]")
  fix("(", ")")
  return s
}

/**
 * Render an "expected" value (which may arrive as number/bool/null/string) into
 * the canonical string the grader compares against. JSON null → "null" (matches
 * json.dumps(None) and JSON.stringify(null)).
 */
function expectedToString(v: unknown): string {
  if (v === null || v === undefined) return "null"
  if (typeof v === "string") return v
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

export function parseExerciseSpec(raw: string): CodeExerciseSpec | null {
  // Try progressively more aggressive repairs.
  let obj = tryJson(raw)
  if (obj === undefined) obj = tryJson(repairBackticks(raw))
  if (obj === undefined) obj = tryJson(repairPythonLiterals(repairBackticks(raw)))

  if (!obj || typeof obj !== "object") return null
  const o = obj as Record<string, unknown>

  if (
    typeof o.prompt !== "string" ||
    typeof o.starterCode !== "string" ||
    !Array.isArray(o.tests)
  ) {
    return null
  }

  const language = typeof o.language === "string" ? o.language : "python"

  const tests = (o.tests as unknown[])
    .map((t) => {
      if (!t || typeof t !== "object") return null
      const tt = t as Record<string, unknown>
      if (typeof tt.call !== "string") return null
      return {
        call: balanceCall(tt.call),
        expected: expectedToString(tt.expected),
        explanation: typeof tt.explanation === "string" ? tt.explanation : undefined,
      }
    })
    .filter((t): t is NonNullable<typeof t> => t !== null)

  if (tests.length === 0) return null
  return { prompt: o.prompt, language, starterCode: o.starterCode, tests }
}

/** Languages whose exercises can be auto-run/graded in-browser.
 *  Delegates to the execution registry (single source of truth):
 *  javascript, typescript (transpiled), and python. */
export function isRunnableLanguage(language: string): boolean {
  return isClientRunnable(language)
}
