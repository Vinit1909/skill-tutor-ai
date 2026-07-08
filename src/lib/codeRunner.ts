/**
 * Unified code execution — one call site for every language.
 *
 * Dispatch:
 *  - javascript → sandboxed iframe (in-browser, instant)
 *  - typescript → sucrase transpile → sandboxed iframe (in-browser, instant)
 *  - python     → Pyodide worker (in-browser, hermetic per run)
 *  - everything else → /api/execute (auth-gated server proxy with
 *    Judge0→Wandbox failover)
 */

"use client"

import { runPythonOnce } from "@/hooks/usePyodide"
import { runJSOnce } from "@/hooks/useJSSandbox"
import { resolveLanguage } from "@/lib/execLanguages"
import { getAuthHeaders } from "@/lib/clientAuth"
import { auth } from "@/lib/firebase"

export interface ExecResult {
  stdout: string
  stderr: string
  error?: string
  /** True when this ran remotely (server tier) — UI can hint at latency. */
  remote: boolean
}

/**
 * Strip TypeScript types so the code runs in the JS sandbox. Sucrase is
 * type-stripping only (no type CHECKING) — same model as ts-node/swc dev runs.
 * Lazily imported so non-TS users never pay for it.
 */
export async function transpileTypeScript(code: string): Promise<string> {
  const { transform } = await import("sucrase")
  return transform(code, { transforms: ["typescript"] }).code
}

export async function runCode(language: string, code: string): Promise<ExecResult> {
  const lang = resolveLanguage(language)

  if (!lang) {
    return {
      stdout: "",
      stderr: "",
      error: `Running ${language || "this language"} isn't supported yet.`,
      remote: false,
    }
  }

  if (lang.id === "javascript" || lang.id === "typescript") {
    let js = code
    if (lang.id === "typescript") {
      try {
        js = await transpileTypeScript(code)
      } catch (err) {
        return {
          stdout: "",
          stderr: "",
          error: `TypeScript syntax error: ${err instanceof Error ? err.message : err}`,
          remote: false,
        }
      }
    }
    const lines = await runJSOnce(js)
    const errLine = lines.find((l) => l.startsWith("Error:"))
    return {
      stdout: lines.filter((l) => !l.startsWith("Error:")).join("\n"),
      stderr: "",
      error: errLine?.replace(/^Error:\s*/, ""),
      remote: false,
    }
  }

  if (lang.id === "python") {
    const r = await runPythonOnce(code)
    return { stdout: r.stdout, stderr: r.stderr, error: r.error, remote: false }
  }

  // Server tier — compiled/JVM/etc. languages execute via our proxy.
  const uid = auth.currentUser?.uid
  if (!uid) {
    return {
      stdout: "",
      stderr: "",
      error: "Please sign in to run code in this language.",
      remote: true,
    }
  }

  try {
    const res = await fetch("/api/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify({ uid, language: lang.id, code }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        stdout: "",
        stderr: "",
        error: data.error || "Execution failed. Please try again.",
        remote: true,
      }
    }
    return {
      stdout: data.stdout ?? "",
      stderr: data.stderr ?? "",
      // Non-zero exit with stderr is the normal "my code has a bug" case —
      // surface stderr itself rather than a generic label.
      error: data.error ?? (data.exitCode !== 0 && !data.stderr ? `Exited with code ${data.exitCode}` : undefined),
      remote: true,
    }
  } catch {
    return {
      stdout: "",
      stderr: "",
      error: "Couldn't reach the execution service. Check your connection and try again.",
      remote: true,
    }
  }
}
