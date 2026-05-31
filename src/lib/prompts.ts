/**
 * Centralized prompt templates for all AI calls in the application.
 * Keeps prompt logic in one place and makes it easy to iterate on quality.
 */

import type { SkillSpaceData, RoadmapNode } from "./skillspace"

// ─── Chat Skill Context ───────────────────────────────────────────────────────

/**
 * Minimal skill context sent from client → server in each chat request.
 * Avoids a Firestore roundtrip on the server; the client already has this loaded.
 */
export interface ChatSkillContext {
  name?: string
  roadmapContext?: {
    level?: string
    goals?: string
    priorKnowledge?: string
  }
  roadmapJSON?: {
    nodes: RoadmapNode[]
  }
}

// ─── Chat / Tutor System Prompt ──────────────────────────────────────────────

/**
 * Builds a compact, focused system prompt for the chat tutor.
 * Accepts either a full SkillSpaceData or the slim ChatSkillContext sent by
 * the client — both expose the same fields we need here.
 * Deliberately does NOT inline the full roadmapJSON — only the active node
 * and immediate context are included to save tokens and stay focused.
 */
export function buildChatSystemPrompt(
  skill: SkillSpaceData | ChatSkillContext | null,
  activeNodeId: string | null | undefined
): string {
  if (!skill) {
    return "You are a helpful tutor. Greet the user and ask what they'd like to learn today."
  }

  const level = skill.roadmapContext?.level || "any level"
  const goals = skill.roadmapContext?.goals || "general understanding"
  const priorKnowledge = skill.roadmapContext?.priorKnowledge || "not specified"
  const skillName = skill.name || "the skill"

  // Find active node and its context
  const activeNode = activeNodeId
    ? findNodeById(skill.roadmapJSON?.nodes || [], activeNodeId)
    : null

  // Find the parent of active node (for context)
  const parentNode = activeNodeId
    ? findParentNode(skill.roadmapJSON?.nodes || [], activeNodeId)
    : null

  // Get completed node titles for context
  const completedNodes = getCompletedNodeTitles(skill.roadmapJSON?.nodes || [])

  // Get next incomplete node title
  const nextNode = activeNode ? findNextIncompleteNode(skill.roadmapJSON?.nodes || [], activeNodeId!) : null

  const activeNodeTitle = activeNode?.title || "the current topic"
  const activeNodeStatus = activeNode?.status || "NOT_STARTED"
  const parentTitle = parentNode?.title || null

  return `You are an expert, enthusiastic tutor for "${skillName}".

LEARNER PROFILE:
- Level: ${level}
- Goal: ${goals}
- Prior knowledge: ${priorKnowledge}

CURRENT FOCUS:
- Topic: "${activeNodeTitle}"${parentTitle ? ` (part of "${parentTitle}")` : ""}
- Status: ${activeNodeStatus}
${completedNodes.length > 0 ? `- Already mastered: ${completedNodes.join(", ")}` : "- No topics completed yet"}
${nextNode ? `- Next up after this: "${nextNode.title}"` : "- This is the last topic"}

TEACHING APPROACH:
1. Be Socratic — ask a brief checking question after explaining a concept to verify understanding
2. Be Concrete — always follow explanations with a short, self-contained code example when relevant
3. Be Focused — stay on "${activeNodeTitle}" unless the user explicitly asks to switch topics
4. Be Encouraging — acknowledge progress and keep motivation high

RESPONSE FORMAT:
- Keep explanations under 3 concise paragraphs; use bullet points for lists
- When showing code examples, use fenced code blocks with the language tag (e.g. \`\`\`jsx, \`\`\`python, \`\`\`html)
- For interactive demos (React/HTML/CSS), write self-contained runnable code in \`\`\`jsx or \`\`\`html blocks
- For architecture diagrams, flows, or relationships, use \`\`\`mermaid blocks
- Do NOT use \`\`\`mermaid for simple code examples — only for actual diagrams

CONSTRAINTS:
- Do not discuss topics outside the ${skillName} roadmap unless directly relevant
- If asked about an unrelated topic, gently redirect: "Let's finish ${activeNodeTitle} first — ask me about that other topic after!"
- Keep your tone warm, slightly humorous, and conversational — not robotic
- NEVER mention, reference, simulate, or write out any function calls, tool names, or progress-tracking code in your responses. Progress is tracked separately — your job is purely to teach.`
}

// ─── Roadmap Generation Prompt ───────────────────────────────────────────────

export function buildRoadmapPrompt({
  skillName,
  level,
  goals,
  priorKnowledge,
}: {
  skillName: string
  level?: string
  goals?: string
  priorKnowledge?: string
}): string {
  return `You are an expert curriculum designer. Create a personalized learning roadmap for "${skillName}".

LEARNER CONTEXT:
- Level: ${level || "beginner"}
- Goals: ${goals || "general understanding and practical ability"}
- Prior knowledge: ${priorKnowledge || "minimal background"}

ROADMAP RULES:
1. Create exactly 3–4 parent nodes representing major topic areas of "${skillName}"
2. Each parent MUST have 2–4 child nodes (no grandchildren — max one level of nesting)
3. Child nodes are self-contained learning units completable in one study session (~30–60 min)
4. All IDs must be unique camelCase strings (e.g., "reactHooks", "promisesAsync")
5. Titles must be specific and action-oriented: "useState Hook" not "React Basics"
6. Weights: foundational = 2–3, advanced = 1–2 (used for progress tracking)
7. Tailor complexity to the learner's level (${level || "beginner"}) and goals

QUESTION RULES:
1. Generate 1–2 questions per child node — use the child node's ID (not the parent ID)
2. Questions should be genuinely useful: "how", "why", "when to use" — not trivial recall
3. shortDesc must be a 2-word topic tag (e.g., "Array Methods", "Error Handling")`
}

// ─── Quiz Generation Prompt ───────────────────────────────────────────────────

export function buildQuizPrompt({
  skillName,
  nodeTitles,
  chatHistory,
}: {
  skillName: string
  nodeTitles: string
  chatHistory: string
}): string {
  return `You are an expert at creating educational assessments for "${skillName}".

Generate 20–30 quiz questions covering these topics: ${nodeTitles}

CONTEXT FROM LEARNER'S STUDY SESSIONS:
${chatHistory}

QUESTION TYPES — produce a balanced mix:
- multiple-choice: question + options array (exactly 4, labelled "a. …", "b. …", "c. …", "d. …") + correctAnswer ("a", "b", "c", or "d")
- fill-in-the-blank: question with a blank indicated by ___ + correctAnswer (single word or short phrase)
- matching: question + pairs array (2–4 objects with "term" and "definition") + correctAnswer (same pairs in correct order)

QUALITY RULES:
1. Balanced mix: 8–12 multiple-choice, 6–10 fill-in-the-blank, 4–8 matching
2. Multiple-choice distractors (wrong options) must be PLAUSIBLE — not obviously wrong
3. Fill-in-the-blank answers should test understanding, not just vocabulary recall
4. Matching pairs must have genuine conceptual relationships (not arbitrary)
5. Cover 3 difficulty levels: ~30% recall, ~40% comprehension, ~30% application
6. Avoid repeating the same concept across multiple questions
7. Make questions practical — test what a practitioner would actually need to know`
}

// ─── Progression-Only System Prompt ──────────────────────────────────────────

/**
 * Minimal system prompt for the /api/chat/progress route.
 * This call runs in parallel with the text call — its only job is to decide
 * whether to call a progression tool (markNodeInProgress / markNodeComplete /
 * suggestNextNode). No teaching, no explanations, just a tool-call decision.
 *
 * Kept deliberately short to minimise token cost and TTFT on this parallel call.
 */
export function buildProgressionSystemPrompt(
  skill: SkillSpaceData | ChatSkillContext | null,
  activeNodeId: string | null | undefined,
  userMessageCount: number = 0
): string {
  if (!skill || !activeNodeId) {
    return "You are a progress tracker. No active topic is set. Do nothing."
  }

  const skillName = skill.name || "the skill"
  const activeNode = activeNodeId
    ? findNodeById(skill.roadmapJSON?.nodes || [], activeNodeId)
    : null
  const nextNode = activeNode
    ? findNextIncompleteNode(skill.roadmapJSON?.nodes || [], activeNodeId!)
    : null

  const activeNodeTitle = activeNode?.title || "current topic"
  const activeNodeStatus = activeNode?.status || "NOT_STARTED"

  return `You are a learning progress tracker for "${skillName}". Your only output must be tool calls — no text.

CURRENT TOPIC: "${activeNodeTitle}" (nodeId: "${activeNodeId}", status: ${activeNodeStatus})
${nextNode ? `NEXT TOPIC: "${nextNode.title}" (nodeId: "${nextNode.id}")` : "NO NEXT TOPIC"}
TOTAL USER MESSAGES SO FAR: ${userMessageCount}

━━━ TOOL DECISION GUIDE ━━━

[1] markNodeInProgress
  CALL when status is NOT_STARTED AND userMessageCount >= 2 AND the conversation
  shows the user is actively engaged in learning "${activeNodeTitle}" — this includes:
    • Answering a question from the tutor
    • Sharing their background or setup (e.g. "I'm on Windows", "I know Python")
    • Asking about any aspect of the topic
    • Following along with instructions step by step
  DO NOT call for: pure greetings alone ("hello", "hi", "hey"), or if status is already IN_PROGRESS or COMPLETED.

[2] markNodeComplete
  CALL when userMessageCount >= 4 AND there is clear evidence the user understands "${activeNodeTitle}":
    • They correctly answered a checking question
    • They explained the concept back in their own words
    • They applied it successfully (ran code, got right output, etc.)
    • They explicitly said they're done / ready to move on
  DO NOT call merely because the AI finished explaining. Understanding must be demonstrated by the USER.

[3] suggestNextNode
  CALL immediately after markNodeComplete if a next topic exists (ID: "${nextNode?.id ?? "none"}").

Analyse the conversation now and call the appropriate tool(s). If none of the conditions above are clearly met, return nothing.`
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function findNodeById(
  nodes: RoadmapNode[],
  id: string
): RoadmapNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children) {
      const found = findNodeById(node.children, id)
      if (found) return found
    }
  }
  return null
}

function findParentNode(
  nodes: RoadmapNode[],
  childId: string
): RoadmapNode | null {
  for (const node of nodes) {
    if (node.children?.some((c) => c.id === childId)) return node
    if (node.children) {
      const found = findParentNode(node.children, childId)
      if (found) return found
    }
  }
  return null
}

function getCompletedNodeTitles(nodes: RoadmapNode[]): string[] {
  const titles: string[] = []
  for (const node of nodes) {
    if (node.children) {
      for (const child of node.children) {
        if (child.status === "COMPLETED") titles.push(child.title)
      }
    } else if (node.status === "COMPLETED") {
      titles.push(node.title)
    }
  }
  return titles
}

function findNextIncompleteNode(
  nodes: RoadmapNode[],
  currentId: string
): RoadmapNode | null {
  // Flatten all leaf nodes in order
  const leaves: RoadmapNode[] = []
  for (const node of nodes) {
    if (node.children?.length) {
      leaves.push(...node.children)
    } else {
      leaves.push(node)
    }
  }

  const currentIndex = leaves.findIndex((n) => n.id === currentId)
  if (currentIndex === -1) return null

  // Find next incomplete node after current
  for (let i = currentIndex + 1; i < leaves.length; i++) {
    if (leaves[i].status !== "COMPLETED") return leaves[i]
  }
  return null
}
