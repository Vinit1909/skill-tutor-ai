/**
 * Server-side code execution for languages the browser can't run (compiled
 * languages, JVM, etc.). JavaScript/TypeScript/Python do NOT come through
 * here — they run in-browser.
 *
 * Provider failover (same philosophy as the LLM router):
 *  1. Judge0 CE via RapidAPI — when JUDGE0_API_KEY is configured. Covers every
 *     server language incl. Kotlin/Swift.
 *  2. Wandbox — keyless public fallback, verified live (see execLanguages.ts).
 *
 * Why a proxy instead of calling providers from the browser:
 *  - auth-gating + per-user rate limiting on OUR side (shared public services;
 *    an abusive client would get the app's IP banned)
 *  - providers can be swapped/added without touching client code
 *    (the public Piston API going whitelist-only proved this matters)
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyAuth } from "@/lib/serverAuth"
import { checkRateLimit } from "@/lib/usage"
import {
  resolveLanguage,
  pickWandboxCompiler,
  adaptJavaForWandbox,
  type ExecLanguage,
} from "@/lib/execLanguages"

export const runtime = "nodejs"
export const maxDuration = 45

const MAX_CODE_CHARS = 50_000
const MAX_OUTPUT_CHARS = 10_000

interface ExecOutcome {
  stdout: string
  stderr: string
  exitCode: number | null
  error?: string
}

// ─── Wandbox (keyless) ────────────────────────────────────────────────────────

// Compiler list cached per instance — names drift across Wandbox updates,
// so we discover at runtime instead of hardcoding versions.
let _wandboxList: Array<{ name: string; language: string }> | null = null
let _wandboxListAt = 0

async function wandboxCompilers() {
  if (_wandboxList && Date.now() - _wandboxListAt < 60 * 60 * 1000) return _wandboxList
  const res = await fetch("https://wandbox.org/api/list.json", {
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Wandbox list ${res.status}`)
  _wandboxList = (await res.json()) as Array<{ name: string; language: string }>
  _wandboxListAt = Date.now()
  return _wandboxList
}

async function runOnWandbox(lang: ExecLanguage, code: string): Promise<ExecOutcome> {
  const compiler = pickWandboxCompiler(lang, await wandboxCompilers())
  if (!compiler) throw new Error(`No Wandbox compiler for ${lang.id}`)

  const body = {
    compiler,
    code: lang.id === "java" ? adaptJavaForWandbox(code) : code,
  }
  const res = await fetch("https://wandbox.org/api/compile.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(35_000),
  })
  if (!res.ok) throw new Error(`Wandbox ${res.status}`)
  const data = await res.json()

  const compileError = String(data.compiler_error ?? "")
  const exitCode = Number.isFinite(Number(data.status)) ? Number(data.status) : null
  return {
    stdout: String(data.program_output ?? ""),
    stderr: String(data.program_error ?? "") || compileError,
    exitCode,
    error: compileError && !data.program_output ? "Compilation failed" : undefined,
  }
}

// ─── Judge0 (optional key) ────────────────────────────────────────────────────

async function runOnJudge0(lang: ExecLanguage, code: string): Promise<ExecOutcome> {
  const key = process.env.JUDGE0_API_KEY
  if (!key || !lang.judge0Id) throw new Error("Judge0 not configured")

  const res = await fetch(
    "https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Key": key,
        "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
      },
      body: JSON.stringify({ language_id: lang.judge0Id, source_code: code }),
      signal: AbortSignal.timeout(35_000),
    }
  )
  if (!res.ok) throw new Error(`Judge0 ${res.status}`)
  const data = await res.json()

  return {
    stdout: String(data.stdout ?? ""),
    stderr: String(data.stderr ?? "") || String(data.compile_output ?? ""),
    exitCode: typeof data.exit_code === "number" ? data.exit_code : null,
    error:
      data.status?.id === 6
        ? "Compilation failed"
        : data.status?.id === 5
        ? "Execution timed out"
        : undefined,
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { uid, language, code } = await req.json()

    if (!uid || typeof language !== "string" || typeof code !== "string") {
      return NextResponse.json({ error: "Missing uid, language, or code" }, { status: 400 })
    }
    if (code.length > MAX_CODE_CHARS) {
      return NextResponse.json({ error: "Code is too large to execute (50KB limit)" }, { status: 413 })
    }

    const auth = await verifyAuth(req, uid)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const rateError = checkRateLimit(uid)
    if (rateError) {
      return NextResponse.json({ error: rateError }, { status: 429 })
    }

    const lang = resolveLanguage(language)
    if (!lang || lang.tier !== "server") {
      return NextResponse.json(
        { error: `Language "${language}" is not supported for server execution.` },
        { status: 400 }
      )
    }

    // Provider chain: Judge0 (if configured) → Wandbox (when it supports the language).
    const providers: Array<{ name: string; run: () => Promise<ExecOutcome> }> = []
    if (process.env.JUDGE0_API_KEY && lang.judge0Id) {
      providers.push({ name: "judge0", run: () => runOnJudge0(lang, code) })
    }
    if (lang.wandboxLanguage) {
      providers.push({ name: "wandbox", run: () => runOnWandbox(lang, code) })
    }
    if (providers.length === 0) {
      return NextResponse.json(
        {
          error: `${lang.label} execution requires the Judge0 provider — set JUDGE0_API_KEY to enable it.`,
        },
        { status: 501 }
      )
    }

    let lastErr: unknown
    for (const provider of providers) {
      try {
        const outcome = await provider.run()
        console.log(`🏃 [execute] uid=${uid} lang=${lang.id} via=${provider.name} exit=${outcome.exitCode ?? "?"}`)
        return NextResponse.json({
          stdout: outcome.stdout.slice(0, MAX_OUTPUT_CHARS),
          stderr: outcome.stderr.slice(0, MAX_OUTPUT_CHARS),
          exitCode: outcome.exitCode,
          error: outcome.error,
        })
      } catch (err) {
        lastErr = err
        console.error(`❌ [execute] ${provider.name} failed:`, err instanceof Error ? err.message : err)
      }
    }

    console.error("❌ [execute] all providers failed:", lastErr)
    return NextResponse.json(
      { error: "The execution service is temporarily unavailable. Please try again." },
      { status: 502 }
    )
  } catch (err) {
    console.error("❌ [execute] route error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
