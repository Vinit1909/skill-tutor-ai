/**
 * Pyodide in-browser Python execution via a Web Worker.
 *
 * Architecture:
 *  - Module-level singleton worker (created lazily, lives for the session)
 *  - Worker script inlined as a string, loaded via Blob URL — no webpack config
 *  - Pyodide WASM (~9MB) loads once; subsequent runs are fast
 *  - No COEP/COOP headers required (async Pyodide, no SharedArrayBuffer)
 *
 * Correctness guarantees (these fixed real grading bugs):
 *  1. HERMETIC RUNS — every execution gets a fresh Python namespace, so
 *     variables/functions from one sandbox can never leak into another
 *     (previously, exercise B's tests could pass using exercise A's leftover
 *     definitions in the shared global namespace).
 *  2. SERIALIZED QUEUE — runs execute one at a time through a promise chain,
 *     so there is never more than one pending run. A timeout can therefore
 *     never orphan some *other* sandbox's callback.
 *  3. GENERATION-SAFE TIMEOUTS — a timed-out run terminates only the worker
 *     generation it started on. A stale timeout can never kill the replacement
 *     worker that later runs someone else's code.
 */

"use client"

import { useState } from "react"

export interface RunResult {
  stdout: string
  stderr: string
  error?: string
}

// ─── Worker script (inlined) ─────────────────────────────────────────────────

const PYODIDE_VERSION = "0.27.5"
const EXECUTION_TIMEOUT_MS = 8000
const MAX_OUTPUT_CHARS = 10000

const WORKER_SCRIPT = `
const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/';

let pyodide = null;

async function init() {
  try {
    importScripts(PYODIDE_CDN + 'pyodide.js');
    pyodide = await loadPyodide({ indexURL: PYODIDE_CDN });
    self.postMessage({ type: 'ready' });
  } catch (err) {
    self.postMessage({ type: 'init_error', message: String(err) });
  }
}

init();

self.onmessage = async (e) => {
  if (e.data.type !== 'run') return;
  const { code, id } = e.data;

  if (!pyodide) {
    self.postMessage({ type: 'result', id, stdout: '', stderr: '', error: 'Pyodide not loaded yet.' });
    return;
  }

  // Per-run output capture via setStdout/setStderr (worker is single-threaded
  // and runs are serialized by the client, so no interleaving is possible).
  const outLines = [];
  const errLines = [];
  pyodide.setStdout({ batched: (s) => outLines.push(s) });
  pyodide.setStderr({ batched: (s) => errLines.push(s) });

  // HERMETIC NAMESPACE: a fresh dict per run. CPython's exec() injects
  // __builtins__ automatically, so imports and builtins work normally —
  // but nothing defined here survives into the next run.
  let ns = null;
  try {
    ns = pyodide.globals.get('dict')();
    await pyodide.runPythonAsync(code, { globals: ns });
    self.postMessage({
      type: 'result', id,
      stdout: outLines.join('\\n').slice(0, ${MAX_OUTPUT_CHARS}),
      stderr: errLines.join('\\n').slice(0, ${MAX_OUTPUT_CHARS}),
    });
  } catch (err) {
    self.postMessage({
      type: 'result', id,
      stdout: outLines.join('\\n').slice(0, ${MAX_OUTPUT_CHARS}),
      stderr: errLines.join('\\n').slice(0, ${MAX_OUTPUT_CHARS}),
      error: String(err),
    });
  } finally {
    if (ns) { try { ns.destroy(); } catch {} }
    pyodide.setStdout();
    pyodide.setStderr();
  }
};
`

// ─── Module-level singleton + run queue ──────────────────────────────────────

let _worker: Worker | null = null
let _workerGeneration = 0
let _readyPromise: Promise<void> | null = null
// Serializes all runs: at most one is ever in flight.
let _queue: Promise<unknown> = Promise.resolve()

function createWorker(): Worker {
  const blob = new Blob([WORKER_SCRIPT], { type: "application/javascript" })
  const url = URL.createObjectURL(blob)
  const worker = new Worker(url)
  URL.revokeObjectURL(url)
  _workerGeneration++
  return worker
}

function ensureWorker(): { worker: Worker; generation: number; ready: Promise<void> } {
  if (!_worker) {
    const worker = createWorker()
    _worker = worker
    _readyPromise = new Promise<void>((resolve, reject) => {
      const onMessage = (e: MessageEvent) => {
        if (e.data?.type === "ready") {
          worker.removeEventListener("message", onMessage)
          resolve()
        } else if (e.data?.type === "init_error") {
          worker.removeEventListener("message", onMessage)
          reject(new Error(e.data.message))
        }
      }
      worker.addEventListener("message", onMessage)
      worker.addEventListener("error", (e) => reject(new Error(e.message || "Worker error")), { once: true })
    })
  }
  return { worker: _worker, generation: _workerGeneration, ready: _readyPromise! }
}

/** Terminate + discard the worker, but only if `generation` still owns it. */
function teardownWorker(generation: number) {
  if (generation !== _workerGeneration || !_worker) return
  try {
    _worker.terminate()
  } catch {
    /* ignore */
  }
  _worker = null
  _readyPromise = null
}

function executeRun(code: string): Promise<RunResult> {
  const { worker, generation, ready } = ensureWorker()

  return new Promise<RunResult>((resolve) => {
    ready
      .then(() => {
        const id = `run-${Date.now()}-${Math.random().toString(36).slice(2)}`

        const timeout = setTimeout(() => {
          worker.removeEventListener("message", onMessage)
          // Generation guard: never kill a worker we don't own.
          teardownWorker(generation)
          resolve({
            stdout: "",
            stderr: "",
            error: "Execution timed out (8s limit). If you have an infinite loop, add a break condition.",
          })
        }, EXECUTION_TIMEOUT_MS)

        const onMessage = (e: MessageEvent) => {
          const data = e.data
          if (data?.type !== "result" || data.id !== id) return
          clearTimeout(timeout)
          worker.removeEventListener("message", onMessage)
          resolve({ stdout: data.stdout ?? "", stderr: data.stderr ?? "", error: data.error })
        }

        worker.addEventListener("message", onMessage)
        worker.postMessage({ type: "run", code, id })
      })
      .catch((err) => {
        teardownWorker(generation)
        resolve({
          stdout: "",
          stderr: "",
          error: `Failed to load Python environment: ${err instanceof Error ? err.message : err}`,
        })
      })
  })
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run Python code once, hermetically. Runs are serialized — concurrent calls
 * from different sandboxes queue up rather than interleave.
 * First call loads Pyodide (~5–10s); subsequent runs are fast.
 */
export function runPythonOnce(code: string): Promise<RunResult> {
  if (typeof window === "undefined") {
    return Promise.resolve({ stdout: "", stderr: "", error: "Python sandbox is not available server-side." })
  }

  const result = _queue.then(() => executeRun(code))
  // Keep the chain alive regardless of outcome (executeRun never rejects).
  _queue = result.catch(() => {})
  return result
}

// ─── React hook ───────────────────────────────────────────────────────────────

export interface UsePyodideReturn {
  runCode: (code: string) => Promise<RunResult>
  /** True while Pyodide WASM is loading (first use only) */
  isLoading: boolean
  /** True while code is actively executing */
  isRunning: boolean
}

export function usePyodide(): UsePyodideReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [isRunning, setIsRunning] = useState(false)

  const runCode = async (code: string): Promise<RunResult> => {
    if (typeof window === "undefined") {
      return { stdout: "", stderr: "", error: "Python sandbox unavailable." }
    }
    const needsLoad = !_worker
    if (needsLoad) setIsLoading(true)
    setIsRunning(true)
    try {
      return await runPythonOnce(code)
    } finally {
      setIsLoading(false)
      setIsRunning(false)
    }
  }

  return { runCode, isLoading, isRunning }
}
