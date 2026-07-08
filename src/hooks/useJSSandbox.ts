/**
 * Sandboxed JavaScript execution via a hidden iframe.
 *
 * Architecture:
 *  - Creates a temporary hidden iframe with sandbox="allow-scripts" (no allow-same-origin)
 *  - Injects the user's code wrapped in a console.log interceptor
 *  - Receives output via postMessage (parent ← iframe)
 *  - Cleans up the iframe after execution or on timeout
 *  - 5-second timeout protection for infinite loops
 *  - Output truncated to 500 lines to prevent flooding
 */

"use client"

import { useState } from "react"

const MAX_OUTPUT_LINES = 500
const EXECUTION_TIMEOUT_MS = 5000

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run JavaScript code once in a sandboxed iframe.
 * Returns an array of console.log output lines.
 */
export async function runJSOnce(code: string): Promise<string[]> {
  if (typeof window === "undefined") {
    return ["JavaScript sandbox is not available server-side."]
  }

  return new Promise<string[]>((resolve) => {
    const outputs: string[] = []
    let settled = false

    // Create a hidden sandboxed iframe
    const iframe = document.createElement("iframe")
    iframe.setAttribute("sandbox", "allow-scripts")
    iframe.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden"
    document.body.appendChild(iframe)

    function cleanup() {
      clearTimeout(timer)
      window.removeEventListener("message", handler)
      if (iframe.parentNode) {
        document.body.removeChild(iframe)
      }
    }

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      resolve([
        ...outputs,
        "⏱ Execution timed out (5s limit). Check for infinite loops.",
      ])
    }, EXECUTION_TIMEOUT_MS)

    function handler(event: MessageEvent) {
      // Only accept messages from our specific iframe
      if (event.source !== iframe.contentWindow) return

      const data = event.data
      if (typeof data !== "object" || data === null) return

      if (data.type === "log") {
        if (outputs.length < MAX_OUTPUT_LINES) {
          outputs.push(String(data.text))
        } else if (outputs.length === MAX_OUTPUT_LINES) {
          outputs.push("[Output truncated at 500 lines]")
        }
      } else if (data.type === "error") {
        if (!settled) {
          settled = true
          cleanup()
          resolve([...outputs, `Error: ${data.message}`])
        }
      } else if (data.type === "done") {
        if (!settled) {
          settled = true
          cleanup()
          resolve(outputs.length > 0 ? outputs : ["(no output)"])
        }
      }
    }

    window.addEventListener("message", handler)

    // Wrap user code: intercept console.log + run + report done/error
    const wrappedCode = `
(function() {
  var _origLog = console.log.bind(console);
  var _origWarn = console.warn.bind(console);
  var _origError = console.error.bind(console);

  function _postLog() {
    var args = Array.prototype.slice.call(arguments);
    var text = args.map(function(a) {
      if (typeof a === 'object' && a !== null) {
        try { return JSON.stringify(a, null, 2); } catch(e) { return String(a); }
      }
      return String(a);
    }).join(' ');
    window.parent.postMessage({ type: 'log', text: text }, '*');
  }

  console.log = function() { _postLog.apply(null, arguments); _origLog.apply(null, arguments); };
  console.warn = function() { _postLog.apply(null, arguments); _origWarn.apply(null, arguments); };
  console.error = function() { _postLog.apply(null, arguments); _origError.apply(null, arguments); };

  try {
    (function() {
      ${code}
    })();
    window.parent.postMessage({ type: 'done' }, '*');
  } catch(err) {
    window.parent.postMessage({ type: 'error', message: err.message || String(err) }, '*');
  }
})();
`

    // srcdoc triggers immediate synchronous execution in most browsers
    iframe.srcdoc = `<!DOCTYPE html><html><body><script>${wrappedCode}<\/script></body></html>`
  })
}

// ─── React hook ───────────────────────────────────────────────────────────────

export interface UseJSSandboxReturn {
  runCode: (code: string) => Promise<string[]>
  isRunning: boolean
  output: string[]
}

export function useJSSandbox(): UseJSSandboxReturn {
  const [isRunning, setIsRunning] = useState(false)
  const [output, setOutput] = useState<string[]>([])

  const runCode = async (code: string): Promise<string[]> => {
    setIsRunning(true)
    setOutput([])
    try {
      const result = await runJSOnce(code)
      setOutput(result)
      return result
    } finally {
      setIsRunning(false)
    }
  }

  return { runCode, isRunning, output }
}
