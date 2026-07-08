"use client"

import { useEffect, useState } from "react"

interface SvgArtifactProps {
  content: string
}

export function SvgArtifact({ content }: SvgArtifactProps) {
  const [sanitized, setSanitized] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function sanitize() {
      try {
        const { default: DOMPurify } = await import("dompurify")
        const clean = DOMPurify.sanitize(content, {
          USE_PROFILES: { svg: true, svgFilters: true },
        })
        setSanitized(clean)
      } catch {
        setError(true)
      }
    }

    if (typeof window !== "undefined") {
      sanitize()
    }
  }, [content])

  if (error) {
    return (
      <div className="text-sm text-red-500 dark:text-red-400 p-2">
        Could not render SVG.
      </div>
    )
  }

  if (!sanitized) {
    return (
      <div className="text-sm text-neutral-400 p-4 animate-pulse">
        Loading illustration…
      </div>
    )
  }

  return (
    <div
      className="flex justify-center overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
