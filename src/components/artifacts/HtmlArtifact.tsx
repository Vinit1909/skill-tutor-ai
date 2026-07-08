"use client"

import { useEffect, useRef, useState } from "react"

interface HtmlArtifactProps {
  content: string
}

// Injected into the sandboxed document so it can report its own height. The
// parent cannot read a cross-origin (opaque) sandbox's DOM, so the iframe must
// push its size out via postMessage.
const HEIGHT_REPORTER = `<script>
(function(){
  function send(){
    var h = Math.max(
      document.body ? document.body.scrollHeight : 0,
      document.documentElement ? document.documentElement.scrollHeight : 0
    );
    parent.postMessage({ __artifactHtmlHeight: h }, '*');
  }
  window.addEventListener('load', send);
  window.addEventListener('resize', send);
  if (window.ResizeObserver) { new ResizeObserver(send).observe(document.documentElement); }
  setTimeout(send, 50); setTimeout(send, 300); setTimeout(send, 800);
})();
<\/script>`

/**
 * Renders LLM-generated HTML/CSS in a sandboxed iframe.
 *
 * Security: sandbox="allow-scripts" WITHOUT allow-same-origin — the document
 * runs on an opaque origin, so it cannot read cookies, localStorage, or the
 * parent DOM. Content is injected via srcDoc; height comes back via postMessage.
 */
export function HtmlArtifact({ content }: HtmlArtifactProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(220)

  const isFullDoc = /<html[\s>]/i.test(content) || /<!doctype/i.test(content)
  const srcDoc = isFullDoc
    ? // Append the reporter just before </body> (or at the end as a fallback).
      /<\/body>/i.test(content)
      ? content.replace(/<\/body>/i, `${HEIGHT_REPORTER}</body>`)
      : content + HEIGHT_REPORTER
    : `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>:root{color-scheme:light dark}body{margin:12px;font-family:system-ui,sans-serif}</style>
</head><body>${content}${HEIGHT_REPORTER}</body></html>`

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const onMessage = (e: MessageEvent) => {
      // Only accept height messages from THIS iframe's window.
      if (e.source !== iframe.contentWindow) return
      const h = (e.data as { __artifactHtmlHeight?: number })?.__artifactHtmlHeight
      if (typeof h === "number" && h > 0) {
        setHeight(Math.min(h + 8, 900))
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  return (
    <iframe
      ref={iframeRef}
      title="HTML preview"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      className="w-full rounded-md bg-white"
      style={{ height, border: "none" }}
    />
  )
}
