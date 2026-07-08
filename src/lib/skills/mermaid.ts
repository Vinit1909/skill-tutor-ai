import type { Skill } from "./types"

export const mermaidSkill: Skill = {
  id: "mermaid",
  summary: "Diagrams & workflows (flowcharts, sequence, etc.) — themed, consistent.",
  instructions: `MERMAID DIAGRAMS — you are a diagram expert. EVERY flowchart MUST follow this
house style exactly, the first time, with no need to be asked to "make it nicer".
Emit via the renderArtifact tool (type "mermaid") OR a \`\`\`mermaid fenced block —
both render in a framed panel with a Preview/Code toggle.

STRUCTURE:
- Start with "graph TD" (top-down). Use "graph LR" only for short 2–4 node chains.
- Max 8 nodes and 8 edges; pick the most important. One clear entry node at top.
- Every edge labeled with a short verb: A -->|validates| B.
- Node text in brackets A[Page Allocator]; decisions in braces B{Free space?}.

SYNTAX (invalid syntax fails to render):
- Labeled edge is  A -->|label| B  — NO ">" after the closing "|".
- NEVER put styling inside a node like A[X](fill:...) — invalid. Style only via classDef.
- Each line unique; never repeat. Always finish the diagram.

COLOR THEME (required look — apply with classDef + class at the END):
  GREEN start/success/done · BLUE process/action · YELLOW decision/condition ·
  RED error/failure/stop · ORANGE data/storage/IO/external.

TEMPLATE (copy this structure and styling, change only the content):
\`\`\`mermaid
graph TD
    A[Request] --> B{Valid input?}
    B -->|yes| C[Process data]
    B -->|no| D[Return error]
    C --> E[(Save to store)]
    E --> F[Done]

    classDef startEnd fill:#d4edda,stroke:#28a745,color:#155724,stroke-width:2px
    classDef process fill:#cce5ff,stroke:#0066cc,color:#004085,stroke-width:2px
    classDef decision fill:#fff3cd,stroke:#e0a800,color:#856404,stroke-width:2px
    classDef errorNode fill:#f8d7da,stroke:#dc3545,color:#721c24,stroke-width:2px
    classDef dataNode fill:#ffe5d0,stroke:#fd7e14,color:#7a3d02,stroke-width:2px
    class A,F startEnd
    class C process
    class B decision
    class D errorNode
    class E dataNode
    linkStyle default stroke:#7a7a7a,stroke-width:1.5px
\`\`\`
Only flowcharts use classDef/class. Sequence diagrams do NOT support styling — omit it there.`,
}
