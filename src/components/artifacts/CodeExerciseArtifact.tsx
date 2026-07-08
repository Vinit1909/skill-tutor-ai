"use client"

import { useState, useCallback, useEffect } from "react"
import dynamic from "next/dynamic"
import { Play, Loader2, RotateCcw, Check, X, MessageSquare, Cloud } from "lucide-react"
import { Button } from "@/components/ui/button"
import { runPythonOnce } from "@/hooks/usePyodide"
import { runJSOnce } from "@/hooks/useJSSandbox"
import { runCode, transpileTypeScript } from "@/lib/codeRunner"
import { resolveLanguage } from "@/lib/execLanguages"
import { useChatActions } from "@/context/chatActions"
import { parseExerciseSpec, isRunnableLanguage } from "@/lib/artifactParse"

// CodeMirror + language modes load lazily — keeps the chat bundle lean.
const CodeEditor = dynamic(() => import("./CodeEditor"), {
  ssr: false,
  loading: () => (
    <div className="p-3 text-xs font-mono text-neutral-400 animate-pulse min-h-[120px]">
      Loading editor…
    </div>
  ),
})

interface CodeExerciseArtifactProps {
  content: string // JSON-encoded CodeExerciseSpec
}

interface TestResult {
  pass: boolean
  actual: string
  error?: string
}

/** Normalize so "[0, 1]" / "[0,1]" and 'foo' / "foo" compare equal. */
function norm(s: string): string {
  return s.trim().replace(/\s+/g, "").replace(/^['"]|['"]$/g, "")
}

/** Reduce a Python traceback to its final, meaningful line. */
function lastLine(s: string): string {
  const lines = s.trim().split("\n").filter(Boolean)
  return lines[lines.length - 1] || s.trim()
}

/** djb2 — tiny stable hash of the spec so a learner's edits survive reloads.
 *  (Message IDs change between live-session and Firestore-loaded messages,
 *  but the spec content is identical, so it makes a reliable storage key.) */
function specStorageKey(content: string): string {
  let h = 5381
  const s = content.replace(/\s+/g, "")
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return `exercise-code:${(h >>> 0).toString(36)}`
}

function loadSavedCode(key: string): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(key) : null
  } catch {
    return null
  }
}

export function CodeExerciseArtifact({ content }: CodeExerciseArtifactProps) {
  const chatActions = useChatActions()

  const spec = parseExerciseSpec(content)
  const parseError = spec === null
  const canRun = spec ? isRunnableLanguage(spec.language) : false

  const storageKey = specStorageKey(content)
  // Restore the learner's last edit if they've worked on this exercise before —
  // losing in-progress code to a page reload is brutal mid-exercise.
  const [code, setCode] = useState(
    () => loadSavedCode(storageKey) ?? spec?.starterCode ?? ""
  )
  const [results, setResults] = useState<TestResult[] | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null)
  // Free-run output for server-tier languages (no auto-grading harness there —
  // the learner runs their program as-is and grades with the tutor via Review).
  const [freeRunOutput, setFreeRunOutput] = useState<{ text: string; isError: boolean } | null>(null)

  const langInfo = spec ? resolveLanguage(spec.language) : null
  const canFreeRun = !canRun && langInfo?.tier === "server"

  // Debounced autosave of edits (skip when it's still pristine starter code).
  useEffect(() => {
    if (!spec) return
    const t = setTimeout(() => {
      try {
        if (code !== spec.starterCode) window.localStorage.setItem(storageKey, code)
        else window.localStorage.removeItem(storageKey)
      } catch {
        /* storage full/blocked — non-critical */
      }
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, storageKey])

  const runTests = useCallback(async () => {
    if (!spec || isRunning) return
    setIsRunning(true)
    setResults(null)

    const langId = resolveLanguage(spec.language)?.id ?? spec.language.toLowerCase()
    const isPython = langId === "python"
    if (isPython) {
      setLoadingMsg("Loading Python… (first run ~10s)")
    } else {
      setLoadingMsg("Running…")
    }

    // TypeScript: strip types once up front, then grade through the JS harness.
    let jsCode = code
    if (langId === "typescript") {
      try {
        jsCode = await transpileTypeScript(code)
      } catch (err) {
        setLoadingMsg(null)
        setResults(
          spec.tests.map(() => ({
            pass: false,
            actual: "",
            error: `TypeScript syntax error: ${err instanceof Error ? err.message : err}`,
          }))
        )
        setIsRunning(false)
        return
      }
    }

    const out: TestResult[] = []
    for (const test of spec.tests) {
      try {
        if (isPython) {
          // try/except so a runtime error in one test is reported cleanly
          // (and never crashes the whole run). Parens are already balanced by
          // the parser, so the call won't cause a SyntaxError.
          const program =
            `${code}\n` +
            `import json as _json\n` +
            `try:\n` +
            `    print(_json.dumps(${test.call}))\n` +
            `except Exception as _e:\n` +
            `    print("__EXC__" + type(_e).__name__ + ": " + str(_e))`
          const r = await runPythonOnce(program)
          if (r.error) {
            out.push({ pass: false, actual: "", error: lastLine(r.error) })
          } else {
            const lines = (r.stdout || "").trim().split("\n").filter(Boolean)
            const actual = lines[lines.length - 1] ?? ""
            if (actual.startsWith("__EXC__")) {
              out.push({ pass: false, actual: "", error: actual.slice(7) })
            } else {
              out.push({ pass: norm(actual) === norm(test.expected), actual })
            }
          }
        } else {
          const program =
            `${jsCode}\n` +
            `try { console.log(JSON.stringify(${test.call})) } ` +
            `catch (_e) { console.log("__EXC__" + (_e && _e.message ? _e.message : String(_e))) }`
          const lines = await runJSOnce(program)
          const last = (lines[lines.length - 1] ?? "").trim()
          const errLine = lines.find((l) => l.startsWith("Error:"))
          if (last.startsWith("__EXC__")) {
            out.push({ pass: false, actual: "", error: last.slice(7) })
          } else if (errLine) {
            out.push({ pass: false, actual: "", error: errLine.replace(/^Error:\s*/, "") })
          } else {
            out.push({ pass: norm(last) === norm(test.expected), actual: last })
          }
        }
      } catch (err) {
        out.push({
          pass: false,
          actual: "",
          error: err instanceof Error ? err.message : "Execution failed",
        })
      }
    }

    setLoadingMsg(null)
    setResults(out)
    setIsRunning(false)
  }, [spec, code, isRunning])

  // Server-tier languages (Java, C++, Go, …) run the learner's program as-is
  // via /api/execute — no grading harness, output shown below the editor.
  const freeRun = useCallback(async () => {
    if (!spec || isRunning) return
    setIsRunning(true)
    setFreeRunOutput(null)
    setLoadingMsg("Running on the execution server…")
    const result = await runCode(spec.language, code)
    setLoadingMsg(null)
    if (result.error) {
      setFreeRunOutput({
        text: [result.error, result.stderr, result.stdout].filter(Boolean).join("\n"),
        isError: true,
      })
    } else {
      setFreeRunOutput({
        text: result.stdout || result.stderr || "(no output)",
        isError: false,
      })
    }
    setIsRunning(false)
  }, [spec, code, isRunning])

  const askTutorToReview = useCallback(() => {
    if (!spec || !chatActions) return
    const passed = results?.filter((r) => r.pass).length ?? 0
    const total = spec.tests.length

    // Give the tutor the exact per-test outcomes — it can't see the sandbox.
    let summary: string
    if (!results) {
      summary = "I haven't run the tests yet."
    } else if (passed === total) {
      summary = `All ${total} tests passed.`
    } else {
      const failures = results
        .map((r, i) =>
          r.pass
            ? null
            : `- ${spec.tests[i].call} → ${
                r.error ? `error: ${r.error}` : `got ${r.actual || "(nothing)"}, expected ${spec.tests[i].expected}`
              }`
        )
        .filter(Boolean)
        .join("\n")
      summary = `${passed}/${total} tests passed. Failing:\n${failures}`
    }

    chatActions.sendUserMessage(
      `Here's my attempt at the exercise. ${summary}\n\n` +
        "```" +
        spec.language +
        "\n" +
        code +
        "\n```\n" +
        "Please review: point out bugs, edge cases, and improvements. " +
        "Reply with feedback only — do not generate a new exercise."
    )
  }, [spec, code, results, chatActions])

  if (parseError || !spec) {
    return (
      <div className="text-sm text-red-500 dark:text-red-400 p-2">
        Could not load this exercise.
      </div>
    )
  }

  const passedCount = results?.filter((r) => r.pass).length ?? 0
  const allPass = results !== null && passedCount === spec.tests.length

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
      {/* Problem statement */}
      <div className="px-3 py-2 bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-700">
        <p className="text-sm text-neutral-700 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed">
          {spec.prompt}
        </p>
        {spec.tests.length > 0 && (
          <div className="mt-2 space-y-0.5">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Examples
            </p>
            {spec.tests.slice(0, 3).map((t, i) => (
              <div key={i} className="text-xs font-mono text-neutral-600 dark:text-neutral-300">
                <span className="text-neutral-400">{t.call}</span> →{" "}
                <span className="text-neutral-700 dark:text-neutral-200">{t.expected}</span>
                {t.explanation && (
                  <span className="text-neutral-400 italic"> ({t.explanation})</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
          {spec.language}
        </span>
        <div className="flex gap-1 items-center">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            onClick={() => {
              setCode(spec!.starterCode)
              setResults(null)
            }}
            title="Reset to starter code"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
          {chatActions && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-[#6c63ff] hover:text-[#5a52e0] dark:text-[#7a83ff] font-medium"
              onClick={askTutorToReview}
              title="Send your code to the tutor for review"
            >
              <MessageSquare className="h-3 w-3 mr-1" /> Review
            </Button>
          )}
          {canRun && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 font-medium"
              onClick={runTests}
              disabled={isRunning}
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Running…
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 mr-1" /> Run tests
                </>
              )}
            </Button>
          )}
          {canFreeRun && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 font-medium"
              onClick={freeRun}
              disabled={isRunning}
              title="Run your program on the execution server"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Running…
                </>
              ) : (
                <>
                  <Cloud className="h-3 w-3 mr-1" /> Run
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Editor — CodeMirror: highlighting, auto-indent, bracket close */}
      <CodeEditor
        value={code}
        onChange={setCode}
        language={spec.language}
        minHeight="140px"
        ariaLabel={`${spec.language} solution editor`}
      />

      {/* Server-tier languages: free-run + tutor review (no auto-grade harness) */}
      {canFreeRun && (
        <div className="border-t border-neutral-200 dark:border-neutral-700 px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800/60">
          {langInfo?.label} runs on the execution server (<span className="font-medium">Run</span>).
          Tests aren&apos;t auto-graded for this language — click{" "}
          <span className="font-medium">Review</span> for tutor feedback when you&apos;re done.
        </div>
      )}

      {/* Loading */}
      {loadingMsg && (
        <div className="border-t border-neutral-200 dark:border-neutral-700 px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800 flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          {loadingMsg}
        </div>
      )}

      {/* Free-run output (server-tier languages) */}
      {freeRunOutput && !loadingMsg && (
        <div className="border-t border-neutral-200 dark:border-neutral-700">
          <div className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Output
          </div>
          <pre
            className={`px-3 py-2 text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto ${
              freeRunOutput.isError
                ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20"
                : "text-neutral-800 dark:text-neutral-200 bg-neutral-50 dark:bg-neutral-900"
            }`}
          >
            {freeRunOutput.text}
          </pre>
        </div>
      )}

      {/* Results */}
      {results && !loadingMsg && (
        <div className="border-t border-neutral-200 dark:border-neutral-700">
          <div
            className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 ${
              allPass
                ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
            }`}
          >
            {allPass ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
            {passedCount}/{spec.tests.length} tests passed
            {allPass && " — nice work!"}
          </div>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {results.map((r, i) => (
              <div key={i} className="px-3 py-1.5 text-xs font-mono flex items-start gap-2">
                {r.pass ? (
                  <Check className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <X className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {spec.tests[i].call}
                  </span>
                  {r.error ? (
                    <div className="text-red-500 dark:text-red-400 whitespace-pre-wrap">
                      {r.error}
                    </div>
                  ) : (
                    !r.pass && (
                      <div className="text-neutral-600 dark:text-neutral-300">
                        got <span className="text-red-500">{r.actual || "(nothing)"}</span>,
                        expected{" "}
                        <span className="text-green-600 dark:text-green-400">
                          {spec.tests[i].expected}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
