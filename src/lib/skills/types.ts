/**
 * A "skill" is a reusable house-style module the tutor LLM follows whenever it
 * produces a recurring kind of output (a diagram, a chart, a coding exercise…).
 *
 * This is the app-runtime equivalent of a Claude Code skill file: instead of MCP
 * tools, skills are composed into the system prompt so every model in the routing
 * stack produces consistent, predictable artifacts without the user re-prompting.
 */
export interface Skill {
  /** Stable id, e.g. "mermaid". */
  id: string
  /** One-line capability summary shown in the skills index. */
  summary: string
  /** Full instructions injected into the system prompt. */
  instructions: string
}
