/**
 * Vercel AI SDK provider manager.
 * Stateless by design (works correctly in serverless/edge environments).
 * Providers are tried in priority order; first one with a valid API key is used.
 * Falls back to the next provider if the current one throws synchronously.
 */

import { createGroq } from "@ai-sdk/groq"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import type { LanguageModel } from "ai"

export interface AIProvider {
  name: string
  model: LanguageModel
}

/**
 * Returns providers in priority order, filtered to those with API keys configured.
 * Groq → Google Gemini → Together AI → Fireworks AI
 */
export function getOrderedProviders(): AIProvider[] {
  const providers: AIProvider[] = []

  if (process.env.GROQ_API_KEY) {
    try {
      const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
      // Primary: best quality. Has its own daily TPD bucket (100k tokens/day on free tier).
      providers.push({ name: "Groq (llama-3.3-70b)", model: groq("llama-3.3-70b-versatile") })
      // Fallback: separate TPD bucket — still available when the 70b model is rate-limited.
      providers.push({ name: "Groq (llama-3.1-8b)", model: groq("llama-3.1-8b-instant") })
    } catch {
      console.warn("⚠️ Failed to initialize Groq provider")
    }
  }

  if (process.env.GOOGLE_API_KEY) {
    try {
      const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY })
      // gemini-1.5-flash was deprecated — gemini-2.0-flash is the current equivalent.
      providers.push({ name: "Google Gemini", model: google("gemini-2.0-flash") })
    } catch {
      console.warn("⚠️ Failed to initialize Google Gemini provider")
    }
  }

  if (process.env.TOGETHER_API_KEY) {
    try {
      const together = createOpenAI({
        baseURL: "https://api.together.xyz/v1",
        apiKey: process.env.TOGETHER_API_KEY,
      })
      providers.push({
        name: "Together AI",
        model: together("meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo"),
      })
    } catch {
      console.warn("⚠️ Failed to initialize Together AI provider")
    }
  }

  if (process.env.FIREWORKS_API_KEY) {
    try {
      const fireworks = createOpenAI({
        baseURL: "https://api.fireworks.ai/inference/v1",
        apiKey: process.env.FIREWORKS_API_KEY,
      })
      // Updated to llama-v3p3 — llama-v3p1-70b-instruct was removed from Fireworks.
      providers.push({
        name: "Fireworks AI",
        model: fireworks("accounts/fireworks/models/llama-v3p3-70b-instruct"),
      })
    } catch {
      console.warn("⚠️ Failed to initialize Fireworks AI provider")
    }
  }

  return providers
}

/**
 * Returns the primary provider's model, or throws if none are configured.
 * Used when you need a single model (e.g., generateObject calls).
 */
export function getPrimaryModel(): LanguageModel {
  const providers = getOrderedProviders()
  if (providers.length === 0) {
    throw new Error(
      "No AI providers configured. Please set at least one of: GROQ_API_KEY, GOOGLE_API_KEY, TOGETHER_API_KEY, FIREWORKS_API_KEY"
    )
  }
  return providers[0].model
}
