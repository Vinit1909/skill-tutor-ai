/**
 * Repairs malformed Mermaid that weaker LLMs frequently produce.
 * Pure functions — unit-tested in src/lib/__tests__/mermaidSanitize.test.ts.
 *
 * Failure modes handled (all observed in production logs):
 *  1. Invalid labeled-arrow syntax:  -->|label|>  →  -->|label|
 *  2. Truncated diagrams: a response that hits the token limit mid-edge makes
 *     the WHOLE diagram unparseable — drop incomplete edge lines instead.
 *  3. Repetition loops: the same edge emitted dozens of times — dedupe + cap.
 *  4. Invented inline styling: "A[Label]((fill:#abc))" is not Mermaid — strip it
 *     (valid classDef/class/linkStyle lines are untouched).
 *
 * Only flowcharts (graph/flowchart) are structurally repaired — other diagram
 * types have different grammars and pass through with line-ending cleanup only.
 */

// Generous cap — legitimate teaching diagrams are well under this; only
// genuine model runaways (e.g. a 26-edge fan-out) get trimmed.
export const MAX_EDGE_LINES = 18

export function sanitizeMermaid(code: string): string {
  const cleaned = code
    .replace(/\r\n/g, "\n")
    // Fix 1: drop the stray ">" after a closed edge label
    .replace(/(-->\s*\|[^|\n]*\|)\s*>/g, "$1")
    // Fix 4: strip invalid inline style groups — a parenthetical (or double
    // parenthetical) whose content starts with a CSS style keyword. Does NOT
    // touch valid labels like A[Foo (bar)] or `style A fill:#f9f` statements.
    .replace(/\(+\s*(?:fill|stroke|color|stroke-width)\s*:[^()]*\)+/gi, "")
    .trim()

  const lines = cleaned.split("\n")
  if (lines.length === 0) return cleaned

  const header = lines[0]
  const isFlowchart = /^(graph|flowchart)\s/i.test(header.trim())
  if (!isFlowchart) return cleaned

  const seen = new Set<string>()
  const body: string[] = []
  let edgeCount = 0
  for (const line of lines.slice(1)) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const isEdge = trimmed.includes("-->")
    if (isEdge) {
      // After the final arrow (and optional |label|) there must be a node id.
      const afterArrow = trimmed.split("-->").pop()!.trim()
      const target = afterArrow.replace(/^\|[^|]*\|\s*/, "").trim()
      // Fix 2: incomplete/truncated edge — no valid target node → drop the line
      if (!target || !/^[A-Za-z0-9_]/.test(target)) continue
    }

    // Fix 3a: collapse duplicate lines from repetition loops
    if (seen.has(trimmed)) continue
    seen.add(trimmed)

    // Fix 3b: cap the number of edges so a breadth-runaway stays readable
    if (isEdge) {
      if (edgeCount >= MAX_EDGE_LINES) continue
      edgeCount++
    }
    body.push(line)
  }

  return [header, ...body].join("\n")
}

/**
 * Mermaid v11 emits `width="icon"` / `height="icon"` on icon-shape nodes.
 * React 19 validates SVG attributes even inside dangerouslySetInnerHTML,
 * so those produce console warnings. Replace them with a valid CSS length.
 */
export function fixSvgAttributes(svg: string): string {
  return svg
    .replace(/\bwidth="icon"/g, 'width="1em"')
    .replace(/\bheight="icon"/g, 'height="1em"')
}
