/**
 * Skills registry.
 *
 * Each skill encodes the house style for a recurring kind of tutor output, so
 * artifacts come out consistent without the user having to ask twice. Skills are
 * composed into the chat system prompt by composeSkills().
 */
import type { Skill } from "./types"
import { mermaidSkill } from "./mermaid"
import { htmlCssSkill } from "./htmlcss"
import { codeRunnableSkill } from "./codeRunnable"
import { codeExerciseSkill } from "./codeExercise"
import { chartsSkill } from "./charts"

export type { Skill } from "./types"

export const ALL_SKILLS: Skill[] = [
  mermaidSkill,
  chartsSkill,
  htmlCssSkill,
  codeRunnableSkill,
  codeExerciseSkill,
]

/**
 * Renders the given skills into a single system-prompt section: a short index of
 * capabilities followed by each skill's full house-style instructions.
 */
export function composeSkills(skills: Skill[] = ALL_SKILLS): string {
  const index = skills.map((s) => `- ${s.id}: ${s.summary}`).join("\n")
  const bodies = skills.map((s) => s.instructions).join("\n\n")
  return `INTERACTIVE SKILLS — you can make answers vivid and hands-on with these.
Reach for them whenever they genuinely help the learner understand or practice;
do NOT wrap trivial one-line examples in artifacts.

Available:
${index}

${bodies}`
}
