/**
 * Assembles the tool set for the unified streaming endpoint.
 *
 * Progression tools (markNodeInProgress / markNodeComplete / suggestNextNode)
 * are intentionally NOT included here. Those tools caused the "stuck then full
 * response" streaming bug: small models (Groq 8b) would call markNodeInProgress
 * as their first action, blocking the stream on a tool round-trip before
 * generating any text. With fast Groq inference the whole response then
 * appeared all at once.
 *
 * Progression tracking is handled separately by /api/chat/progress, which
 * is called as a background fire-and-forget fetch from the client onFinish
 * callback — the same pattern used before the streaming migration.
 */

import { createRenderArtifactTool } from "@/lib/tools/artifacts"
import { createWebSearchTool } from "@/lib/tools/search"
import type { CoreTool } from "ai"

// uid and skillId are kept in the signature for forward-compatibility (e.g. per-user
// webSearch quotas or skill-scoped tool permissions in a future iteration).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function buildToolSet(uid: string, skillId: string): Record<string, CoreTool> {
  const tools: Record<string, CoreTool> = {
    renderArtifact: createRenderArtifactTool(),
  }

  if (process.env.TAVILY_API_KEY) {
    tools.webSearch = createWebSearchTool()
  }

  return tools
}
