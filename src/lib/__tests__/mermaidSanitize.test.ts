import { describe, it, expect } from "vitest"
import { sanitizeMermaid, fixSvgAttributes, MAX_EDGE_LINES } from "@/lib/mermaidSanitize"

describe("sanitizeMermaid", () => {
  it("fixes the invalid -->|label|> arrow syntax", () => {
    const out = sanitizeMermaid("graph TD\n  A[Start] -->|loads|> B[End]")
    expect(out).toContain("A[Start] -->|loads| B[End]")
    expect(out).not.toContain("|>")
  })

  it("drops a truncated trailing edge so the rest still parses", () => {
    const out = sanitizeMermaid("graph TD\n  A --> B\n  Menu -->|")
    expect(out).toContain("A --> B")
    expect(out).not.toContain("Menu -->|")
  })

  it("collapses duplicate edges from repetition loops", () => {
    const dup = "  X -->|go| Y[Same]"
    const out = sanitizeMermaid(`graph TD\n${dup}\n${dup}\n${dup}`)
    expect(out.split("\n").filter((l) => l.includes("X -->")).length).toBe(1)
  })

  it("caps runaway fan-outs at MAX_EDGE_LINES edges", () => {
    const lines = Array.from({ length: 30 }, (_, i) => `  A --> N${i}[Node ${i}]`)
    const out = sanitizeMermaid(`graph TD\n${lines.join("\n")}`)
    expect(out.split("\n").length - 1).toBe(MAX_EDGE_LINES)
  })

  it("strips invented inline style groups", () => {
    const out = sanitizeMermaid(
      "graph TD\n  A[Platform]((fill:#ADD8E6,stroke:#000)) -->|x| B[Engine](fill:#FFC107)"
    )
    expect(out).not.toContain("fill:")
    expect(out).toContain("A[Platform] -->|x| B[Engine]")
  })

  it("preserves valid classDef / class / linkStyle styling", () => {
    const styled = [
      "graph TD",
      "  A[Start] --> B{Choice?}",
      "  classDef ok fill:#d4edda,stroke:#28a745",
      "  class A ok",
      "  linkStyle default stroke:#888,stroke-width:1.5px",
    ].join("\n")
    const out = sanitizeMermaid(styled)
    expect(out).toContain("classDef ok fill:#d4edda")
    expect(out).toContain("class A ok")
    expect(out).toContain("linkStyle default")
  })

  it("preserves parentheses inside node labels", () => {
    const out = sanitizeMermaid("graph TD\n  A[Foo (bar) baz] --> B[End]")
    expect(out).toContain("A[Foo (bar) baz]")
  })

  it("leaves non-flowchart diagrams structurally untouched", () => {
    const seq = "sequenceDiagram\n  Alice->>John: Hello"
    expect(sanitizeMermaid(seq)).toBe(seq)
  })
})

describe("fixSvgAttributes", () => {
  it("replaces mermaid v11 icon-length attributes with valid CSS lengths", () => {
    const out = fixSvgAttributes('<svg width="icon" height="icon"><g width="icon"/></svg>')
    expect(out).not.toContain('"icon"')
    expect(out).toContain('width="1em"')
  })

  it("leaves normal numeric attributes alone", () => {
    const svg = '<svg width="640" height="480"></svg>'
    expect(fixSvgAttributes(svg)).toBe(svg)
  })
})
