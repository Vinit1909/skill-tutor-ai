"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { Copy, Check, Maximize2, Minimize2, Code2, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ArtifactPayload, ArtifactType } from "@/lib/tools/artifacts"
import { RechartsArtifact } from "./RechartsArtifact"
import { SvgArtifact } from "./SvgArtifact"
import { HtmlArtifact } from "./HtmlArtifact"
import { CodeArtifact } from "./CodeArtifact"
import { CodeExerciseArtifact } from "./CodeExerciseArtifact"
import { useTheme } from "next-themes"
import { ErrorBoundary } from "@/components/ErrorBoundary"

// Mermaid accesses browser globals at import time — must never run on the server
const MermaidArtifact = dynamic(
  () => import("./MermaidArtifact").then((m) => ({ default: m.MermaidArtifact })),
  {
    ssr: false,
    loading: () => (
      <div className="p-4 text-sm text-neutral-400 animate-pulse">
        Loading diagram renderer…
      </div>
    ),
  }
)

interface ArtifactPanelProps {
  payload: ArtifactPayload
}

// Types that render to a visual and therefore support a Preview/Code toggle.
// Code-centric types (code-runnable, code-exercise) are always shown as their
// interactive editor — their "preview" is running them.
const RENDERABLE: ReadonlySet<ArtifactType> = new Set<ArtifactType>([
  "mermaid",
  "recharts",
  "svg",
  "html",
])

export function ArtifactPanel({ payload }: ArtifactPanelProps) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const { resolvedTheme } = useTheme()
  const isDarkMode = resolvedTheme === "dark"

  const isRenderable = RENDERABLE.has(payload.type)
  const showCopy = isRenderable // code-centric panels copy from their own toolbar

  const handleCopy = async () => {
    await navigator.clipboard.writeText(payload.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const renderPreview = () => {
    switch (payload.type) {
      case "mermaid":
        return <MermaidArtifact content={payload.content} isDarkMode={isDarkMode} />
      case "recharts":
        return <RechartsArtifact content={payload.content} />
      case "svg":
        return <SvgArtifact content={payload.content} />
      case "html":
        return <HtmlArtifact content={payload.content} />
      case "code-runnable":
        return <CodeArtifact content={payload.content} language={payload.language} />
      case "code-exercise":
        return <CodeExerciseArtifact content={payload.content} />
      default:
        return (
          <div className="text-sm text-neutral-400 p-3">Unsupported artifact type.</div>
        )
    }
  }

  const renderContent = () => {
    if (isRenderable && showCode) {
      return (
        <pre className="text-xs font-mono whitespace-pre overflow-x-auto p-3 rounded-md bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 max-h-96 custom-scrollbar">
          {payload.content}
        </pre>
      )
    }
    return renderPreview()
  }

  return (
    <div
      className={`rounded-xl border border-neutral-300 dark:border-neutral-600 overflow-hidden my-3 transition-all ${
        expanded ? "fixed inset-4 z-50 shadow-2xl bg-white dark:bg-neutral-900" : ""
      }`}
    >
      {/* Title bar — transparent so it blends with the page; divider keeps it defined */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center gap-2">
          <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 font-mono">
            {payload.type}
          </span>
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200 truncate max-w-[200px]">
            {payload.title}
          </span>
        </div>
        <div className="flex gap-1">
          {/* Preview / Code toggle for renderable artifacts */}
          {isRenderable && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 gap-1"
              onClick={() => setShowCode((c) => !c)}
              title={showCode ? "Show preview" : "Show code"}
            >
              {showCode ? (
                <>
                  <Eye className="h-3 w-3" /> Preview
                </>
              ) : (
                <>
                  <Code2 className="h-3 w-3" /> Code
                </>
              )}
            </Button>
          )}
          {showCopy && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              onClick={handleCopy}
              title="Copy source"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            onClick={() => setExpanded((e) => !e)}
            title={expanded ? "Minimize" : "Maximize"}
          >
            {expanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Content — transparent so the panel inherits the parent page background.
          In fullscreen mode the outer wrapper supplies a solid bg (see above).
          The boundary keeps one broken artifact from crashing the chat. */}
      <div className={expanded ? "overflow-auto h-[calc(100%-2.5rem)]" : ""}>
        <div className="p-3">
          <ErrorBoundary label={`${payload.type} artifact`}>{renderContent()}</ErrorBoundary>
        </div>
      </div>

      {/* Backdrop for expanded mode */}
      {expanded && (
        <div
          className="fixed inset-0 bg-black/50 -z-10"
          onClick={() => setExpanded(false)}
        />
      )}
    </div>
  )
}
