"use client"

import type React from "react"
import { useState, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Highlight, themes } from "prism-react-renderer"
import { ClipboardCheck, Copy } from "lucide-react"
import { useTheme } from "next-themes"

interface CodeProps extends React.HTMLAttributes<HTMLElement> {
  inline?: boolean
  className?: string
  children?: React.ReactNode
  node?: any
}

interface MarkdownRendererProps {
  content: string
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  const isDarkMode = theme === "dark"

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, inline, className, children, ...props }: CodeProps) {
          const match = /language-(\w+)/.exec(className || "")
          const isCodeBlock = match && !inline
          const language = match?.[1] || "text"

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
        h1: ({ node, children, ...props }) => (
          <h1 className="text-2xl font-bold mt-6 mb-4" {...props}>
            {children}
          </h1>
        ),
        h2: ({ node, children, ...props }) => (
          <h2 className="text-xl font-semibold mt-5 mb-3" {...props}>
            {children}
          </h2>
        ),
        h3: ({ node, children, ...props }) => (
          <h3 className="text-lg font-semibold mt-4 mb-2" {...props}>
            {children}
          </h3>
        ),
        h4: ({ node, children, ...props }) => (
          <h4 className="text-base font-medium mt-3 mb-2" {...props}>
            {children}
          </h4>
        ),
        h5: ({ node, children, ...props }) => (
          <h5 className="text-sm font-medium mt-2 mb-1" {...props}>
            {children}
          </h5>
        ),
        h6: ({ node, children, ...props }) => (
          <h6 className="text-xs font-medium mt-2 mb-1" {...props}>
            {children}
          </h6>
        ),
        ul: ({ node, children, ...props }) => (
          <ul className="my-3 list-disc list-inside ml-6" {...props}>
            {children}
          </ul>
        ),
        ol: ({ node, children, ...props }) => (
          <ol className="my-3 list-decimal list-inside ml-6" {...props}>
            {children}
          </ol>
        ),
        li: ({ node, children, ...props }) => (
          <li className="my-2 leading-relaxed" {...props}>
            {children}
          </li>
        ),
        blockquote: ({ node, children, ...props }) => (
          <blockquote
            className={`border-l-4 pl-4 italic my-4 ${isDarkMode ? "border-neutral-600" : "border-neutral-300"}`}
            {...props}
          >
            {children}
          </blockquote>
        ),
        hr: ({ ...props }) => <hr className={isDarkMode ? "border-neutral-600" : "border-neutral-300"} {...props} />,
        table: ({ node, children, ...props }) => (
          <div className="overflow-auto my-4">
            <table
              className={`border-collapse w-full text-sm ${isDarkMode ? "border-neutral-600" : "border-neutral-300"}`}
              {...props}
            >
              {children}
            </table>
          </div>
        ),
        thead: ({ node, children, ...props }) => (
          <thead className={isDarkMode ? "bg-neutral-800" : "bg-neutral-100"} {...props}>
            {children}
          </thead>
        ),
        tr: ({ node, children, ...props }) => (
          <tr className={isDarkMode ? "border-neutral-600" : "border-neutral-300"} {...props}>
            {children}
          </tr>
        ),
        th: ({ node, children, ...props }) => (
          <th
            className={`px-3 py-2 text-left font-semibold ${
              isDarkMode ? "border-neutral-600 text-neutral-200" : "border-neutral-300 text-neutral-800"
            }`}
            {...props}
          >
            {children}
          </th>
        ),
        td: ({ node, children, ...props }) => (
          <td
            className={`px-3 py-2 ${
              isDarkMode ? "border-neutral-600 text-neutral-300" : "border-neutral-300 text-neutral-700"
            }`}
            {...props}
          >
            {children}
          </td>
        ),
        p: ({ node, children, ...props }) => (
          <p className="my-3 leading-relaxed" {...props}>
            {children}
          </p>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

function CodeBlockWithCopy({
  code,
  language,
  isDarkMode,
  ...props
}: {
  code: string
  language: string
  isDarkMode: boolean
} & Omit<CodeProps, "children">) {
  const [copied, setCopied] = useState(false)

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
        isDarkMode ? "bg-neutral-800 border border-neutral-700" : "bg-neutral-50 border border-neutral-300"
      }`}
    >
      <div
        className={`flex items-center justify-between px-4 py-2 text-xs ${
          isDarkMode ? "bg-neutral-700 text-neutral-300" : "bg-neutral-200 text-neutral-600"
        }`}
      >
        <span className="font-mono">{language}</span>
        <button
          onClick={handleCopy}
          className={`rounded px-2 py-1 transition-colors ${
            isDarkMode ? "hover:bg-neutral-600 text-neutral-300" : "hover:bg-neutral-300 text-neutral-700"
          }`}
        >
          {copied ? (
            <div className="flex items-center">
              <ClipboardCheck className="mr-1 h-3 w-3" />
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
    <Highlight theme={isDarkMode ? themes.nightOwl : themes.nightOwlLight} code={code} language={language as any}>
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
        {tokens.map((line, i) => (
          <div key={i} {...getLineProps({ line, key: i })}>
            {line.map((token, key) => (
            <span key={key} {...getTokenProps({ token, key })} />
            ))}
          </div>
        ))}
        </pre>
      )}
    </Highlight>
    </div>
  )
}