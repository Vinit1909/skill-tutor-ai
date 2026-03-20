/**
 * Roadmap generation using Vercel AI SDK generateObject.
 *
 * generateObject enforces the Zod schema at the LLM level — no JSON.parse,
 * no fixRoadmapStructure, no flat-structure hacks. The returned `object` is
 * fully type-safe and guaranteed to match RoadmapGenerationSchema.
 *
 * Provider failover: iterates getOrderedProviders() with maxRetries: 0 so it
 * moves to the next provider immediately on any failure.
 */

import { generateObject } from "ai"
import { getOrderedProviders } from "./ai-providers"
import { buildRoadmapPrompt } from "./prompts"
import { RoadmapGenerationSchema, type RoadmapGeneration } from "./schemas"

export async function generateRoadmap({
  skillName,
  level,
  goals,
  priorKnowledge,
}: {
  skillName: string
  level?: string
  goals?: string
  priorKnowledge?: string
}): Promise<RoadmapGeneration> {
  const prompt = buildRoadmapPrompt({ skillName, level, goals, priorKnowledge })
  const providers = getOrderedProviders()

  if (providers.length === 0) {
    throw new Error("No LLM providers available. Please check your API keys.")
  }

  console.log(`🎯 Generating roadmap for "${skillName}" with ${providers.length} providers available`)

  for (const provider of providers) {
    try {
      console.log(`🔄 Trying ${provider.name}...`)

      const { object } = await generateObject({
        model: provider.model,
        schema: RoadmapGenerationSchema,
        prompt,
        maxRetries: 0, // fail fast → next provider
      })

      console.log(
        `✅ Roadmap generated via ${provider.name} — ` +
        `${object.roadmap.nodes.length} parent nodes, ${object.questions.length} questions`
      )

      return object
    } catch (err) {
      console.error(`❌ ${provider.name} failed for roadmap generation:`, err)
      // continue to next provider
    }
  }

  throw new Error("All providers failed to generate the roadmap. Please try again.")
}
