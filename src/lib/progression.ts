/**
 * AI progression tool definitions for the chat tutor.
 * These tools allow the AI to signal learning progress events.
 *
 * IMPORTANT: Execute functions here do NOT write to Firestore directly —
 * Firestore writes happen client-side in chat.tsx onFinish, where the user
 * has an authenticated Firebase session. Server-side client SDK calls fail
 * silently under Firestore security rules that require auth.
 *
 * Used in /api/chat/route.ts with Vercel AI SDK's streamText tools.
 */

import { tool } from "ai"
import { z } from "zod"

/** Shared type used by both /api/chat and /api/chat/progress route responses. */
export interface ToolInvocationResult {
  toolName: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any
}

/**
 * Creates the progression tools bound to a specific user's skill session.
 * Execute functions return structured data; the client handles Firestore writes.
 */
export function createProgressionTools(uid: string, skillId: string) {
  // uid and skillId are included in the return value so the client can use them
  void uid
  void skillId

  return {
    /**
     * Called by the AI when the user starts actively engaging with a topic.
     * Fires early in the conversation when a meaningful question is asked.
     */
    markNodeInProgress: tool({
      description:
        "Mark the current learning topic as in progress. Call this when the user is actively engaging with the topic — answering the tutor's questions, sharing their setup or background, following along with steps, or asking anything about the topic. Do NOT call for pure greetings or if the node is already in progress.",
      parameters: z.object({
        nodeId: z.string().describe("The ID of the node/topic being worked on — use the exact Node ID from the CURRENT FOCUS section"),
      }),
      execute: async (args) => {
        const { nodeId } = args as { nodeId: string }
        console.log(`📚 AI signaled node "${nodeId}" → IN_PROGRESS`)
        return { success: true, nodeId, status: "IN_PROGRESS" }
      },
    }),

    /**
     * Called by the AI when it is confident the user has mastered a topic.
     * Should only fire after verifying understanding (not just after explaining).
     */
    markNodeComplete: tool({
      description:
        "Mark a learning topic as complete. ONLY call this when you have VERIFIED the user understands — they answered a checking question correctly, explained the concept in their own words, successfully applied it in an example, or explicitly said they're ready to move on. Do NOT call this just after explaining a concept.",
      parameters: z.object({
        nodeId: z.string().describe("The ID of the node/topic that was mastered — use the exact Node ID from the CURRENT FOCUS section"),
        reason: z
          .string()
          .describe(
            "Brief reason why you're marking this complete (e.g., 'User correctly explained closures and applied them')"
          ),
      }),
      execute: async (args) => {
        const { nodeId, reason } = args as { nodeId: string; reason: string }
        console.log(`✅ AI signaled node "${nodeId}" → COMPLETED. Reason: ${reason}`)
        return { success: true, nodeId, status: "COMPLETED", reason }
      },
    }),

    /**
     * Called immediately after markNodeComplete to proactively suggest the next topic.
     * Provides a smooth transition message to keep the learner engaged.
     */
    suggestNextNode: tool({
      description:
        "Suggest the next topic to the learner after they complete the current one. Call this right after markNodeComplete if there is a next topic available. Provide an encouraging transition message.",
      parameters: z.object({
        nextNodeId: z
          .string()
          .describe("The ID of the next node to learn — use the exact Node ID from the 'Next up' line in CURRENT FOCUS"),
        transitionMessage: z
          .string()
          .describe(
            "An encouraging message introducing the next topic (e.g., 'Great work! Now let's dive into Async/Await, which builds directly on what you just learned about Promises.')"
          ),
      }),
      execute: async (args) => {
        const { nextNodeId, transitionMessage } = args as {
          nextNodeId: string
          transitionMessage: string
        }
        console.log(`➡️ AI suggested next node "${nextNodeId}"`)
        return { success: true, nextNodeId, transitionMessage }
      },
    }),
  }
}
