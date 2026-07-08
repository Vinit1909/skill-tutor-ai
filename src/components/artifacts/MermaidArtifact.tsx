"use client"

import { useEffect, useRef, useState } from "react"
// Sanitizer lives in lib (pure, unit-tested) — see src/lib/mermaidSanitize.ts
import { sanitizeMermaid, fixSvgAttributes } from "@/lib/mermaidSanitize"

interface MermaidArtifactProps {
  content: string
  isDarkMode: boolean
}

export function MermaidArtifact({ content, isDarkMode }: MermaidArtifactProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [svg, setSvg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // Debounce: wait 300ms after content stops changing before rendering.
    // This prevents hundreds of failed mermaid.render() calls during streaming
    // (each one blocks the main thread and creates orphaned error DOM elements).
    const timer = setTimeout(async () => {
      if (cancelled) return

      try {
        const { default: mermaid } = await import("mermaid")

        mermaid.initialize({
          startOnLoad: false,
          theme: isDarkMode ? "dark" : "default",
          // "strict" sanitizes labels and blocks click/link handlers — diagram
          // source is untrusted LLM output, so this closes an XSS vector.
          securityLevel: "strict",
        })

        const clean = sanitizeMermaid(content)
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

        try {
          const { svg: rendered } = await mermaid.render(id, clean)

          if (!cancelled) {
            setSvg(fixSvgAttributes(rendered))
            setError(null)
          }
        } catch (renderErr) {
          // mermaid.render() creates a temporary DOM element with the given ID.
          // On failure, this element persists in the document body as a visible
          // "Syntax error in text / version X.Y.Z" message. Remove it.
          const orphan = document.getElementById(id)
          orphan?.remove()

          if (!cancelled) {
            console.error("Mermaid render error:", renderErr)
            setError("Could not render diagram.")
          }
        }
      } catch (importErr) {
        if (!cancelled) {
          console.error("Failed to load mermaid:", importErr)
          setError("Could not load diagram renderer.")
        }
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [content, isDarkMode])

  // Render failure — show the raw source so the user can still read the diagram
  if (error) {
    return (
      <div className="overflow-x-auto">
        <p className="text-xs text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
          Diagram could not render — showing source
        </p>
        <pre className="text-xs font-mono bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 p-3 rounded overflow-x-auto whitespace-pre">
          {content}
        </pre>
      </div>
    )
  }

  if (!svg) {
    return (
      <div className="flex items-center gap-2 text-sm text-neutral-400 p-4">
        <span className="animate-pulse">Rendering diagram…</span>
      </div>
    )
  }

  // The outer div scrolls horizontally; the inner w-fit div takes the SVG's
  // natural width (no squishing) and mx-auto centers it when it's narrower
  // than the panel. Wide diagrams stay readable and scrollable.
  return (
    <div className="overflow-x-auto">
      <div
        ref={containerRef}
        className="w-fit mx-auto min-h-[80px]"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )
}
