import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { ClipboardCheck, Copy } from "lucide-react";

interface CodeProps extends React.HTMLAttributes<HTMLElement> {
    inline?: boolean;
    className?: string;
    children?: React.ReactNode;
    node?: any; 
}

interface MarkdownRendererProps {
    content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                code({
                node,
                inline,
                className,
                children,
                ...props
                }: CodeProps) {
                const match = /language-(\w+)/.exec(className || "");
                const isCodeBlock = match && !inline;
                const language = match?.[1] || "text";

                if (isCodeBlock) {
                    return (
                            <CodeBlockWithCopy
                                code={String(children).replace(/\n$/, "")}
                                language={language}
                                className="custom-scrollbar"
                                {...props}
                            />
                    );
                } else {
                    return (
                        <code className="bg-zinc-200 text-sm rounded-sm px-1 py-0.5" {...props}>
                            {children}
                        </code>
                    );
                }
                },
                h1: ({ node, children, ...props }) => (
                <h1 className="text-2xl font-bold" {...props}>{children}</h1>
                ),
                h2: ({ node, children, ...props }) => (
                    <h2 className="text-xl font-semibold" {...props}>{children}</h2>
                ),
                h3: ({ node, children, ...props }) => (
                    <h3 className="text-lg font-semibold" {...props}>{children}</h3>
                ),
                h4: ({ node, children, ...props }) => (
                    <h4 className="text-base font-medium" {...props}>{children}</h4>
                ),
                h5: ({ node, children, ...props }) => (
                    <h5 className="text-sm font-medium" {...props}>{children}</h5>
                ),
                h6: ({ node, children, ...props }) => (
                    <h6 className="text-xs font-medium" {...props}>{children}</h6>
                ),
                // Lists
                ul: ({ node, children, ...props }) => (
                    <ul className="my-2 list-disc list-inside ml-6" {...props}>
                    {children}
                    </ul>
                ),
                ol: ({ node, children, ...props }) => (
                    <ol className="my-2 list-decimal list-inside ml-6" {...props}>
                    {children}
                    </ol>
                ),
                li: ({ node, children, ...props }) => (
                    <li className="my-2 leading-relaxed" {...props}>
                    {children}
                    </li>
                ),
                // Blockquote
                blockquote: ({ node, children, ...props }) => (
                    <blockquote
                    className="border-l-4 border-gray-300 pl-4 italic"
                    {...props}
                    >
                    {children}
                    </blockquote>
                ),
                // Horizontal rule
                hr: ({ ...props }) => <hr className="border-gray-300" {...props} />,
                // Tables
                table: ({ node, children, ...props }) => (
                    <div className="overflow-auto my-2">
                    <table className="border-collapse border border-gray-300 w-full text-sm" {...props}>
                        {children}
                    </table>
                    </div>
                ),
                thead: ({ node, children, ...props }) => (
                    <thead className="bg-gray-100" {...props}>{children}</thead>
                ),
                tr: ({ node, children, ...props }) => (
                    <tr className="border border-gray-300" {...props}>{children}</tr>
                ),
                th: ({ node, children, ...props }) => (
                    <th className="border border-gray-300 px-2 py-1 text-left font-semibold" {...props}>
                    {children}
                    </th>
                ),
                td: ({ node, children, ...props }) => (
                    <td className="border border-gray-300 px-2 py-1" {...props}>
                    {children}
                    </td>
                ),
                // Paragraph
                p: ({ node, children, ...props }) => (
                    <p className="my-2 leading-relaxed" {...props}>{children}</p>
                ),
            }}
            >
            {content}
        </ReactMarkdown>
    );
}


function CodeBlockWithCopy({
    code, 
    language, 
    ...props
}: {
    code: any;
    language: any;
} & Omit<CodeProps, "children">) {
    const [copied, setCopied] = useState(false);

    function handleCopy() {
        navigator.clipboard
            .writeText(code)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            })
            .catch((err) => {
                console.error("Failed to copy code:", err);
            });
    }
    
    return (
        <div className="my-3 rounded-md border-gray-gray-300 overflow-hidden">
            <div className = "bg-zinc-50 rounded-lg border border-zinc-300 overflow-hidden my-3">
                <div className="flex items-center justify-between bg-zinc-300 px-2 py-1 text-xs text-gray-600">
                    <span>{language}</span>
                    <button
                        onClick={handleCopy}
                        className="rounded px-2 hover:bg-black hover:text-white text-xs"
                    >
                        {copied ? (
                            <div className="flex items-center"><ClipboardCheck className="mr-1 h-3 w-3"/>Copied</div>
                        ) : (
                            <div className="flex items-center"><Copy className="mr-1 h-3 w-3"/>Copy</div>
                        )}
                    </button>
                </div>
                <SyntaxHighlighter
                    style={oneLight as any}
                    language={language}
                    PreTag="div"
                    {...props}
                >
                    {code}
                </SyntaxHighlighter>
            </div>
        </div>
    );
}