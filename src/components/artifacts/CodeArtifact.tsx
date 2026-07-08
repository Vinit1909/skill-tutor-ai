"use client"

import { useState, useCallback } from "react"
import dynamic from "next/dynamic"
import { Copy, Check, Play, Loader2, RotateCcw, Cloud } from "lucide-react"
import { Button } from "@/components/ui/button"
import { runCode } from "@/lib/codeRunner"
import { resolveLanguage, isExecutable } from "@/lib/execLanguages"

// CodeMirror + all language modes load lazily — keeps the chat bundle lean.
const CodeEditor = dynamic(() => import("./CodeEditor"), {
  ssr: false,
  loading: () => (
    <div className="p-3 text-xs font-mono text-neutral-400 animate-pulse min-h-[120px]">
      Loading editor…
    </div>
  ),
})

interface CodeArtifactProps {
  content: string
  language?: string
}

export function CodeArtifact({ content, language = "python" }: CodeArtifactProps) {
  const [code, setCode] = useState(content)
  const [copied, setCopied] = useState(false)
  const [output, setOutput] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null)

  const lang = resolveLanguage(language)
  const runnable = isExecutable(language)
  const isEdited = code !== content

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRun = useCallback(async () => {
    if (isRunning) return
    setIsRunning(true)
    setOutput(null)
    setRunError(null)
    setLoadingMsg(
      lang?.id === "python"
        ? "Loading Python environment… (first run takes ~10s)"
        : lang?.tier === "server"
        ? "Running on the execution server…"
        : "Running…"
    )
    try {
      const result = await runCode(language, code)
      setLoadingMsg(null)
      if (result.error) {
        setRunError(result.error + (result.stderr ? `\n${result.stderr}` : ""))
        if (result.stdout) setOutput(result.stdout)
      } else {
        setOutput(result.stdout || result.stderr || "(no output)")
        if (result.stdout && result.stderr) setRunError(result.stderr)
      }
    } catch (err) {
      setLoadingMsg(null)
      setRunError(err instanceof Error ? err.message : "Execution failed")
    } finally {
      setIsRunning(false)
      setLoadingMsg(null)
    }
  }, [code, language, lang, isRunning])

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
          {lang?.label ?? language} {isEdited && <span className="italic">· edited</span>}
          {lang?.tier === "server" && (
            <span title="Runs on the execution server">
              <Cloud className="h-3 w-3" />
            </span>
          )}
        </span>
        <div className="flex gap-1 items-center">
          {isEdited && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
              onClick={() => setCode(content)}
              title="Reset to original"
              aria-label="Reset code to original"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            onClick={handleCopy}
            title="Copy code"
            aria-label="Copy code"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
          {runnable && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 font-medium"
              onClick={handleRun}
              disabled={isRunning}
              aria-label="Run code"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Running…
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 mr-1" />
                  Run
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Editor */}
      <CodeEditor
        value={code}
        onChange={setCode}
        language={language}
        minHeight="80px"
        ariaLabel={`${lang?.label ?? language} code`}
      />

      {/* Loading message */}
      {loadingMsg && (
        <div className="border-t border-neutral-200 dark:border-neutral-700 px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800 flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          {loadingMsg}
        </div>
      )}

      {/* Output panel */}
      {(output !== null || runError) && !loadingMsg && (
        <div className="border-t border-neutral-200 dark:border-neutral-700">
          <div className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Output
          </div>
          {runError && (
            <pre className="px-3 py-2 text-xs font-mono whitespace-pre-wrap text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 max-h-48 overflow-y-auto">
              {runError}
            </pre>
          )}
          {output && (
            <pre className="px-3 py-2 text-xs font-mono whitespace-pre-wrap text-neutral-800 dark:text-neutral-200 bg-neutral-50 dark:bg-neutral-900 max-h-48 overflow-y-auto">
              {output}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
