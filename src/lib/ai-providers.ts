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
      // Vision-capable (multimodal). Llama 4 Scout accepts images, so multimodal
      // works on Groq without needing a Gemini key. If this model ID is ever
      // retired, vision routing falls back to Gemini (when configured).
      providers.push({
        name: "Groq (llama-4-scout vision)",
        model: groq("meta-llama/llama-4-scout-17b-16e-instruct"),
      })
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

  if (process.env.NVIDIA_API_KEY) {
    try {
      // NVIDIA NIM (build.nvidia.com) — OpenAI-compatible, free dev credits.
      // ROLE: LAST-RESORT FALLBACK ONLY. Measured 2026-06-11: free-tier queue
      // gives the 675B a TTFT of 120–260s (~9 tok/s) — unusable interactively,
      // but a slow answer still beats a hard error when every fast provider is
      // down. Do not promote these in llm-router without re-measuring latency.
      const nvidia = createOpenAI({
        baseURL: "https://integrate.api.nvidia.com/v1",
        apiKey: process.env.NVIDIA_API_KEY,
      })
      // Quality verified (clean prose with tools attached, real tool calls,
      // generateObject works) — only latency disqualifies it from leading.
      providers.push({
        name: "NVIDIA (mistral-large-3-675b)",
        model: nvidia("mistralai/mistral-large-3-675b-instruct-2512"),
      })
      // Vision last-resort (proper tool_calls verified live).
      providers.push({
        name: "NVIDIA (llama-3.2-90b-vision)",
        model: nvidia("meta/llama-3.2-90b-vision-instruct"),
      })
      // NOT registered (verified failures — do not re-add without retesting):
      //  - meta/llama-4-maverick-17b-128e-instruct: with tools attached it
      //    emits raw tool-call JSON into the TEXT stream (visible garbage).
      //  - qwen3-next-80b / nemotron-super-49b: reasoning-hybrid — text
      //    channel comes back EMPTY through the AI SDK.
      //  - DeepSeek V4/R1 reasoning family: thinking traces leak into output.
    } catch {
      console.warn("⚠️ Failed to initialize NVIDIA NIM provider")
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

  // Fireworks AI was removed: its llama-70b model IDs were retired and every
  // fallback pass burned a roundtrip on a guaranteed "Model not found" error.
  // Re-add here with a verified model ID if a Fireworks key is provisioned again.

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
