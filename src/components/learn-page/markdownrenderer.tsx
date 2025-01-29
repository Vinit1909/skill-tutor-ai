// import React, { useState } from "react";
// import ReactMarkdown from "react-markdown";
// import remarkGfm from "remark-gfm";
// import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
// import { oneLight, a11yDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
// import { ClipboardCheck, Copy } from "lucide-react";

// interface CodeProps extends React.HTMLAttributes<HTMLElement> {
//     inline?: boolean;
//     className?: string;
//     children?: React.ReactNode;
//     node?: any; 
// }

// interface MarkdownRendererProps {
//     content: string;
// }

// export function MarkdownRenderer({ content }: MarkdownRendererProps) {
//     return (
//         <ReactMarkdown
//             remarkPlugins={[remarkGfm]}
//             components={{
//                 code({
//                 node,
//                 inline,
//                 className,
//                 children,
//                 ...props
//                 }: CodeProps) {
//                 const match = /language-(\w+)/.exec(className || "");
//                 const isCodeBlock = match && !inline;
//                 const language = match?.[1] || "text";

//                 if (isCodeBlock) {
//                     return (
//                             <CodeBlockWithCopy
//                                 code={String(children).replace(/\n$/, "")}
//                                 language={language}
//                                 className="custom-scrollbar"
//                                 {...props}
//                             />
//                     );
//                 } else {
//                     return (
//                         <code className="bg-neutral-200 text-sm rounded-sm px-1 py-0.5" {...props}>
//                             {children}
//                         </code>
//                     );
//                 }
//                 },
//                 h1: ({ node, children, ...props }) => (
//                 <h1 className="text-2xl font-bold" {...props}>{children}</h1>
//                 ),
//                 h2: ({ node, children, ...props }) => (
//                     <h2 className="text-xl font-semibold" {...props}>{children}</h2>
//                 ),
//                 h3: ({ node, children, ...props }) => (
//                     <h3 className="text-lg font-semibold" {...props}>{children}</h3>
//                 ),
//                 h4: ({ node, children, ...props }) => (
//                     <h4 className="text-base font-medium" {...props}>{children}</h4>
//                 ),
//                 h5: ({ node, children, ...props }) => (
//                     <h5 className="text-sm font-medium" {...props}>{children}</h5>
//                 ),
//                 h6: ({ node, children, ...props }) => (
//                     <h6 className="text-xs font-medium" {...props}>{children}</h6>
//                 ),
//                 // Lists
//                 ul: ({ node, children, ...props }) => (
//                     <ul className="my-2 list-disc list-inside ml-6" {...props}>
//                     {children}
//                     </ul>
//                 ),
//                 ol: ({ node, children, ...props }) => (
//                     <ol className="my-2 list-decimal list-inside ml-6" {...props}>
//                     {children}
//                     </ol>
//                 ),
//                 li: ({ node, children, ...props }) => (
//                     <li className="my-2 leading-relaxed" {...props}>
//                     {children}
//                     </li>
//                 ),
//                 // Blockquote
//                 blockquote: ({ node, children, ...props }) => (
//                     <blockquote
//                     className="border-l-4 border-neutral-300 pl-4 italic"
//                     {...props}
//                     >
//                     {children}
//                     </blockquote>
//                 ),
//                 // Horizontal rule
//                 hr: ({ ...props }) => <hr className="border-neutral-300" {...props} />,
//                 // Tables
//                 table: ({ node, children, ...props }) => (
//                     <div className="overflow-auto my-2">
//                     <table className="border-collapse border border-neutral-300 w-full text-sm" {...props}>
//                         {children}
//                     </table>
//                     </div>
//                 ),
//                 thead: ({ node, children, ...props }) => (
//                     <thead className="bg-neutral-100" {...props}>{children}</thead>
//                 ),
//                 tr: ({ node, children, ...props }) => (
//                     <tr className="border border-neutral-300" {...props}>{children}</tr>
//                 ),
//                 th: ({ node, children, ...props }) => (
//                     <th className="border border-neutral-300 px-2 py-1 text-left font-semibold" {...props}>
//                     {children}
//                     </th>
//                 ),
//                 td: ({ node, children, ...props }) => (
//                     <td className="border border-neutral-300 px-2 py-1" {...props}>
//                     {children}
//                     </td>
//                 ),
//                 // Paragraph
//                 p: ({ node, children, ...props }) => (
//                     <p className="my-2 leading-relaxed" {...props}>{children}</p>
//                 ),
//             }}
//             >
//             {content}
//         </ReactMarkdown>
//     );
// }


// function CodeBlockWithCopy({
//     code, 
//     language, 
//     ...props
// }: {
//     code: any;
//     language: any;
// } & Omit<CodeProps, "children">) {
//     const [copied, setCopied] = useState(false);

//     function handleCopy() {
//         navigator.clipboard
//             .writeText(code)
//             .then(() => {
//                 setCopied(true);
//                 setTimeout(() => setCopied(false), 2000);
//             })
//             .catch((err) => {
//                 console.error("Failed to copy code:", err);
//             });
//     }
    
//     return (
//         <div className="my-3 rounded-md border-neutral-300 overflow-hidden">
//             <div className = "bg-neutral-50 rounded-lg border border-neutral-300 overflow-hidden my-3">
//                 <div className="flex items-center justify-between bg-neutral-300 px-2 py-1 text-xs text-neutral-600">
//                     <span>{language}</span>
//                     <button
//                         onClick={handleCopy}
//                         className="rounded px-2 hover:bg-neutral-200 text-xs"
//                     >
//                         {copied ? (
//                             <div className="flex items-center"><ClipboardCheck className="mr-1 h-3 w-3"/>Copied</div>
//                         ) : (
//                             <div className="flex items-center"><Copy className="mr-1 h-3 w-3"/>Copy</div>
//                         )}
//                     </button>
//                 </div>
//                 <SyntaxHighlighter
//                     style={a11yDark as any}
//                     language={language}
//                     PreTag="div"
//                     {...props}
//                 >
//                     {code}
//                 </SyntaxHighlighter>
//             </div>
//         </div>
//     );
// }

//1--------------------------------------------------------------------------------------------



"use client"

import type React from "react"
import { useState, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneLight, oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism"
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
      <SyntaxHighlighter
        style={(isDarkMode ? oneDark : oneLight) as any}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: "1rem",
          backgroundColor: isDarkMode ? "hsl(220, 13%, 18%)" : "hsl(0, 0%, 98%)",
        }}
        {...props}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}




