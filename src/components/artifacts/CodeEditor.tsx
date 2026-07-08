"use client"

/**
 * Rich code editor for sandboxes (CodeMirror 6) — HackerRank/CoderPad-class
 * basics without the bloat:
 *  - syntax highlighting for every execution language
 *  - auto-indent on Enter (language-aware), bracket/quote auto-close
 *  - Tab indents (Escape then Tab to move focus — standard CM6 a11y pattern)
 *  - line numbers, active-line highlight, dark/light theme
 *  - autocomplete deliberately OFF (per product decision — keeps it distraction-free)
 *
 * This module statically imports all language modes; consumers load the whole
 * editor lazily (next/dynamic) so none of this lands in the main chat bundle.
 */

import CodeMirror from "@uiw/react-codemirror"
import { keymap } from "@codemirror/view"
import { indentWithTab } from "@codemirror/commands"
import { indentUnit, StreamLanguage } from "@codemirror/language"
import type { Extension } from "@codemirror/state"
import { python } from "@codemirror/lang-python"
import { javascript } from "@codemirror/lang-javascript"
import { cpp } from "@codemirror/lang-cpp"
import { java } from "@codemirror/lang-java"
import { go } from "@codemirror/lang-go"
import { rust } from "@codemirror/lang-rust"
import { php } from "@codemirror/lang-php"
import { sql } from "@codemirror/lang-sql"
import { html } from "@codemirror/lang-html"
import { css } from "@codemirror/lang-css"
import { csharp, kotlin } from "@codemirror/legacy-modes/mode/clike"
import { ruby } from "@codemirror/legacy-modes/mode/ruby"
import { swift } from "@codemirror/legacy-modes/mode/swift"
import { shell } from "@codemirror/legacy-modes/mode/shell"
import { useTheme } from "next-themes"
import { resolveLanguage } from "@/lib/execLanguages"

function languageExtension(raw: string | undefined): Extension[] {
  const id = resolveLanguage(raw)?.id ?? raw?.toLowerCase() ?? ""
  switch (id) {
    case "python":
      return [python(), indentUnit.of("    ")] // PEP 8: 4 spaces
    case "javascript":
      return [javascript()]
    case "typescript":
      return [javascript({ typescript: true })]
    case "c":
    case "cpp":
      return [cpp()]
    case "java":
      return [java()]
    case "go":
      return [go()]
    case "rust":
      return [rust()]
    case "php":
      return [php()]
    case "csharp":
      return [StreamLanguage.define(csharp)]
    case "kotlin":
      return [StreamLanguage.define(kotlin)]
    case "ruby":
      return [StreamLanguage.define(ruby)]
    case "swift":
      return [StreamLanguage.define(swift)]
    case "bash":
      return [StreamLanguage.define(shell)]
    // Highlight-only languages (useful when reading non-runnable artifacts)
    case "sql":
      return [sql()]
    case "html":
      return [html()]
    case "css":
      return [css()]
    default:
      return [] // plain text — still a fine editor
  }
}

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  language?: string
  readOnly?: boolean
  minHeight?: string
  maxHeight?: string
  ariaLabel?: string
}

export default function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  minHeight = "120px",
  maxHeight = "420px",
  ariaLabel,
}: CodeEditorProps) {
  const { resolvedTheme } = useTheme()

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      minHeight={minHeight}
      maxHeight={maxHeight}
      aria-label={ariaLabel ?? "Code editor"}
      extensions={[...languageExtension(language), keymap.of([indentWithTab])]}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        autocompletion: false, // deliberate: distraction-free practice editor
        highlightActiveLine: true,
        highlightActiveLineGutter: false,
        indentOnInput: true, // auto-indent as you type/Enter
        bracketMatching: true,
        closeBrackets: true,
        searchKeymap: false,
      }}
      style={{ fontSize: "0.825rem" }}
    />
  )
}
