"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeMathjax from "rehype-mathjax"
import { Highlight, themes } from "prism-react-renderer"
import { ClipboardCheck, Copy, ChevronDown, ChevronRight } from "lucide-react"
import { useTheme } from "next-themes"
import { parseExerciseSpec } from "@/lib/artifactParse"

// Render ```mermaid and ```html fences through the SAME framed ArtifactPanel
// used by the renderArtifact tool, so they look identical no matter which path
// the model used (fenced code block vs. tool call). Dynamic + ssr:false because
// the renderers touch browser globals at import time.
const ArtifactPanelLazy = dynamic(
  () => import("@/components/artifacts/ArtifactPanel").then((m) => ({ default: m.ArtifactPanel })),
  {
    ssr: false,
    loading: () => (
      <span className="text-xs text-neutral-400 animate-pulse block py-2">
        Rendering…
      </span>
    ),
  }
)

// Shared prop type for markdown component overrides.
// Avoids 18 individual implicit-any errors in function parameters.
// No index signature — react-markdown's element props don't declare one, and
// TypeScript contravariance requires the types to be compatible.
type MDProps = { children?: React.ReactNode; className?: string }

interface CodeProps extends React.HTMLAttributes<HTMLPreElement> {
    inline?: boolean
    className?: string
    children?: React.ReactNode
}

interface MarkdownRendererProps {
  content: string
  /** True while useChat is still receiving tokens for this message. */
  isStreaming?: boolean
}

export function MarkdownRenderer({ content, isStreaming = false }: MarkdownRendererProps) {
  // resolvedTheme (not theme) correctly returns "dark"/"light" even when the
  // user's preference is "system" — theme would return "system" in that case.
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDarkMode = resolvedTheme === "dark"

  // Memoised so ReactMarkdown doesn't rebuild its internal component tree
  // on every parent re-render. The object only changes when the theme flips.
  const markdownComponents = useMemo((): Components => ({
        code({ inline, className, children, ...props }: CodeProps) {
          const match = /language-(\w+)/.exec(className || "")
          const isCodeBlock = match && !inline
          const language = match?.[1] || "text"

          // Mermaid fences → live diagrams, but ONLY after streaming completes.
          // During streaming, the mermaid source is partial/invalid. Calling
          // mermaid.render() on every token would:
          //  1. Block the main thread (~50-100ms per failed parse × 100s of tokens)
          //  2. Create orphaned error-message DOM elements visible on screen
          //  3. Cause the browser to freeze
          if (isCodeBlock && language === "mermaid") {
            if (isStreaming) {
              return (
                <div className="my-4 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800/50 p-4 text-center">
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    Diagram will render when complete...
                  </span>
                </div>
              )
            }
            return (
              <ArtifactPanelLazy
                payload={{
                  artifactId: "inline-mermaid",
                  type: "mermaid",
                  title: "Diagram",
                  content: String(children).replace(/\n$/, ""),
                }}
              />
            )
          }

          // HTML fences render as a live preview (with a Code toggle in the panel).
          if (isCodeBlock && language === "html") {
            const html = String(children).replace(/\n$/, "")
            if (isStreaming) {
              return (
                <div className="my-4 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800/50 p-4 text-center">
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    Preview will render when complete...
                  </span>
                </div>
              )
            }
            return (
              <ArtifactPanelLazy
                payload={{
                  artifactId: "inline-html",
                  type: "html",
                  title: "Preview",
                  content: html,
                }}
              />
            )
          }

          // Coding exercises emitted as a fenced block — more reliable than tool
          // calls on weaker models. Accept an explicit ```code-exercise tag, or a
          // ```json block whose content parses to an exercise spec.
          if (isCodeBlock && (language === "code-exercise" || language === "json")) {
            const raw = String(children).replace(/\n$/, "")
            const isExercise =
              language === "code-exercise" || (!isStreaming && !!parseExerciseSpec(raw))
            if (isExercise) {
              if (isStreaming) {
                return (
                  <div className="my-4 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800/50 p-4 text-center">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      Exercise will load when complete...
                    </span>
                  </div>
                )
              }
              return (
                <ArtifactPanelLazy
                  payload={{
                    artifactId: "inline-exercise",
                    type: "code-exercise",
                    title: "Exercise",
                    content: raw,
                  }}
                />
              )
            }
            // plain JSON that isn't an exercise → render as a normal code block
          }

          if (isCodeBlock) {
            return (
              <CodeBlockWithCopy
                code={String(children).replace(/\n$/, "")}
                language={language}
                isDarkMode={isDarkMode}
                className="custom-scrollbar"
                {...props}
              />
            )
          } else {
            return (
              <code
                className={`text-sm rounded-sm px-1 py-0.5 ${isDarkMode ? "bg-neutral-700" : "bg-neutral-200"}`}
                {...props}
              >
                {children}
              </code>
            )
          }
        },
        div({ className, children, ...props }: MDProps) {
            if (className?.includes("math-display")) {
              return (
                <div style={{ overflowX: "auto" }}>
                  <div className="math-block" {...props}>
                    {children}
                  </div>
                </div>
              )
            }
            return <div {...props}>{children}</div>
        },
        span({ className, children, ...props }: MDProps) {
            if (className?.includes("math-inline")) {
                return <span className="math-inline" {...props}>{children}</span>
            }
            return <span {...props}>{children}</span>
        },
        h1: ({ children, ...props }: MDProps) => (
          <h1 className="text-2xl font-bold mt-6 mb-4" {...props}>
            {children}
          </h1>
        ),
        h2: ({ children, ...props }: MDProps) => (
          <h2 className="text-xl font-semibold mt-5 mb-3" {...props}>
            {children}
          </h2>
        ),
        h3: ({ children, ...props }: MDProps) => (
          <h3 className="text-lg font-semibold mt-4 mb-2" {...props}>
            {children}
          </h3>
        ),
        h4: ({ children, ...props }: MDProps) => (
          <h4 className="text-base font-medium mt-3 mb-2" {...props}>
            {children}
          </h4>
        ),
        h5: ({ children, ...props }: MDProps) => (
          <h5 className="text-sm font-medium mt-2 mb-1" {...props}>
            {children}
          </h5>
        ),
        h6: ({ children, ...props }: MDProps) => (
          <h6 className="text-xs font-medium mt-2 mb-1" {...props}>
            {children}
          </h6>
        ),
        ul: ({ children, ...props }: MDProps) => (
          <ul className="my-3 list-disc list-inside ml-6" {...props}>
            {children}
          </ul>
        ),
        ol: ({ children, ...props }: MDProps) => (
          <ol className="my-3 list-decimal list-inside ml-6" {...props}>
            {children}
          </ol>
        ),
        li: ({ children, ...props }: MDProps) => (
          <li className="my-2 leading-relaxed" {...props}>
            {children}
          </li>
        ),
        blockquote: ({ children, ...props }: MDProps) => (
          <blockquote
            className={`border-l-4 pl-4 italic my-4 ${isDarkMode ? "border-neutral-600" : "border-neutral-300"}`}
            {...props}
          >
            {children}
          </blockquote>
        ),
        hr: ({ ...props }: MDProps) => <hr className={isDarkMode ? "border-neutral-600" : "border-neutral-300"} {...props} />,
        table: ({ children, ...props }: MDProps) => (
          <div className="overflow-auto my-4">
            <table
              className={`border-collapse w-full text-sm ${isDarkMode ? "border-neutral-600" : "border-neutral-300"}`}
              {...props}
            >
              {children}
            </table>
          </div>
        ),
        thead: ({ children, ...props }: MDProps) => (
          <thead className={isDarkMode ? "bg-neutral-800" : "bg-neutral-100"} {...props}>
            {children}
          </thead>
        ),
        tr: ({ children, ...props }: MDProps) => (
          <tr className={isDarkMode ? "border-neutral-600" : "border-neutral-300"} {...props}>
            {children}
          </tr>
        ),
        th: ({ children, ...props }: MDProps) => (
          <th
            className={`px-3 py-2 text-left font-semibold ${
              isDarkMode ? "border-neutral-600 text-neutral-200" : "border-neutral-300 text-neutral-800"
            }`}
            {...props}
          >
            {children}
          </th>
        ),
        td: ({ children, ...props }: MDProps) => (
          <td
            className={`px-3 py-2 ${
              isDarkMode ? "border-neutral-600 text-neutral-300" : "border-neutral-300 text-neutral-700"
            }`}
            {...props}
          >
            {children}
          </td>
        ),
        p: ({ children, ...props }: MDProps) => (
          <p className="my-3 leading-relaxed" {...props}>
            {children}
          </p>
        ),
      }), [isDarkMode, isStreaming])

  // Hydration guard: useTheme returns different values on server vs client.
  // Placed after hooks so hook call order is stable.
  if (!mounted) return null

  // During streaming, skip expensive plugins (remarkMath + rehypeMathjax).
  // remarkGfm alone handles bold, italic, code, tables, lists — covers 99% of
  // streaming content. Full rendering with mathjax kicks in when streaming ends.
  // This reduces per-token render cost from ~5-10ms to <1ms.
  return (
    <ReactMarkdown
      remarkPlugins={isStreaming ? [remarkGfm] : [remarkGfm, remarkMath]}
      rehypePlugins={isStreaming ? [] : [rehypeMathjax]}
      components={markdownComponents}
    >
      {content}
    </ReactMarkdown>
  )
}

function CodeBlockWithCopy({
  code,
  language,
  isDarkMode,
}: {
  code: string
  language: string
  isDarkMode: boolean
} & Omit<CodeProps, "children">) {
  const [copied, setCopied] = useState(false)
  // Code blocks are expandable/collapsible; expanded by default.
  const [collapsed, setCollapsed] = useState(false)

  function handleCopy() {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch((err) => {
        console.error("Failed to copy code:", err)
      })
  }

  return (
    <div
      className={`my-4 rounded-md overflow-hidden ${
        isDarkMode ? "bg-neutral-800" : "bg-neutral-50 border border-neutral-200"
      }`}
    >
      <div
        className={`flex items-center justify-between px-4 py-1 text-xs ${
          isDarkMode ? "bg-neutral-700 text-neutral-300" : "bg-neutral-200 text-neutral-600"
        }`}
      >
        {/* Language label doubles as the expand/collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={`flex items-center gap-1 font-mono rounded px-1 py-0.5 transition-colors ${
            isDarkMode ? "hover:text-white" : "hover:text-neutral-900"
          }`}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
          {language}
        </button>
        <button
          onClick={handleCopy}
          className={`rounded px-2 py-1 transition-colors ${
            isDarkMode ? "text-neutral-300 hover:text-white" : "text-neutral-700 hover:text-neutral-900"
          }`}
        >
          {copied ? (
            <div className="flex items-center">
              <ClipboardCheck className="mr-1 h-3 w-3 text-green-500 dark:text-green-400" />
              Copied
            </div>
          ) : (
            <div className="flex items-center">
              <Copy className="mr-1 h-3 w-3" />
              Copy
            </div>
          )}
        </button>
      </div>
    {!collapsed && (
    <Highlight theme={isDarkMode ? themes.nightOwl : themes.nightOwlLight} code={code} language={language}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre
            className={`${className} ${isDarkMode ? "dark" : ""}`}
            style={{
                ...style,
                margin: 0,
                padding: "1rem",
                backgroundColor: isDarkMode ? "#0d1111" : "#ffffff",
            }}
            >
            {tokens.map((line, i) => {
                const lineProps = getLineProps({ line, key: i })
                const { key: lineKey, ...restLineProps } = lineProps
                return (
                <div key={lineKey as React.Key} {...restLineProps}>
                    {line.map((token, tokenKey) => {
                    const tokenProps = getTokenProps({ token, key: tokenKey })
                    const { key: propKey, ...restTokenProps } = tokenProps
                    return <span key={propKey as React.Key} {...restTokenProps} />
                    })}
                </div>
                )
            })}
            </pre>
        )}
    </Highlight>
    )}
    </div>
  )
}
