/**
 * renderArtifact tool — lets the LLM emit structured, interactive content.
 *
 * The execute function is intentionally trivial: it returns a stable payload so
 * the client can render it. All rendering logic lives in the frontend.
 *
 * Artifact types:
 *  - mermaid:       Mermaid diagram source (flowcharts, sequence diagrams, etc.)
 *  - svg:           Raw SVG markup (sanitized client-side with DOMPurify)
 *  - recharts:      JSON config for a Recharts chart { chartType, data, xKey, yKey }
 *  - html:          A self-contained HTML/CSS document, rendered in a sandboxed iframe
 *  - code-runnable: Editable, executable code (Python or JavaScript)
 *  - code-exercise: A LeetCode-style practice problem — JSON with prompt, starter
 *                   code, language, and test cases the learner runs against.
 */

import { tool } from "ai"
import { z } from "zod"

export type ArtifactType =
  | "mermaid"
  | "svg"
  | "recharts"
  | "html"
  | "code-runnable"
  | "code-exercise"

export interface ArtifactPayload {
  artifactId: string
  type: ArtifactType
  title: string
  content: string
  language?: string
}

/**
 * Shape of a `code-exercise` artifact's `content` (JSON-encoded).
 * Kept simple: a function-call test model — each test evaluates `call` and
 * compares its string output to `expected`.
 */
export interface CodeExerciseSpec {
  prompt: string            // problem statement (markdown allowed)
  // Any language is allowed in the editor; auto-run/grading only works for
  // "python" / "javascript". Other languages (typescript, go, …) are editor-only
  // and graded by the tutor via the Review button.
  language: string
  starterCode: string       // pre-filled editor content (defines the function)
  tests: Array<{
    call: string            // an expression to evaluate, e.g. "twoSum([2,7,11],9)"
    expected: string        // expected stringified result, e.g. "[0, 1]"
    explanation?: string    // optional, shown to the learner
  }>
}

const RenderArtifactParams = z.object({
  type: z
    .enum(["mermaid", "svg", "recharts", "html", "code-runnable", "code-exercise"])
    .describe(
      "mermaid: diagram source | svg: raw SVG | recharts: JSON {chartType,data,xKey,yKey} | " +
        "html: self-contained HTML/CSS document | code-runnable: editable runnable code | " +
        "code-exercise: JSON {prompt,language,starterCode,tests:[{call,expected,explanation}]}"
    ),
  title: z.string().describe("Short descriptive title shown above the artifact panel"),
  content: z
    .string()
    .describe(
      "mermaid/svg/html: raw source. recharts/code-exercise: JSON string. " +
        "code-runnable: complete self-contained code."
    ),
  language: z
    .string()
    .optional()
    .describe("For code-runnable: 'python' or 'javascript'"),
})

let artifactCounter = 0

export function createRenderArtifactTool() {
  return tool({
    description:
      "Emit an interactive artifact the learner can see, run, or edit. Use for: " +
      "diagrams (mermaid), charts (recharts), SVG illustrations, rendered HTML/CSS (html), " +
      "runnable code the learner will execute/modify (code-runnable), or a LeetCode-style " +
      "practice problem (code-exercise). Do NOT wrap trivial inline snippets in artifacts.",
    parameters: RenderArtifactParams,
    execute: async (args): Promise<ArtifactPayload> => {
      const id = `artifact-${Date.now()}-${++artifactCounter}`
      console.log(`🎨 [artifact] ${args.type}: "${args.title}"`)
      return {
        artifactId: id,
        type: args.type as ArtifactType,
        title: args.title,
        content: args.content,
        language: args.language,
      }
    },
  })
}
