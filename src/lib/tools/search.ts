/**
 * webSearch tool — lets the LLM search the web when answering questions
 * that require current or domain-specific information.
 *
 * Powered by Tavily Search API (designed for AI use cases).
 * Only included in the tool set when TAVILY_API_KEY is configured.
 */

import { tool } from "ai"
import { z } from "zod"

export interface SearchResult {
  query: string
  answer: string
  sources: { title: string; url: string; snippet: string }[]
}

export function createWebSearchTool() {
  return tool({
    description:
      "Search the web for current, accurate information when answering a question. " +
      "Use this when the topic requires up-to-date facts, documentation, or " +
      "examples that might have changed since training. " +
      "Always cite the sources in your response.",
    parameters: z.object({
      query: z.string().describe("The search query"),
      reason: z
        .string()
        .describe("Why this search is needed to answer the question"),
    }),
    execute: async ({ query }): Promise<SearchResult> => {
      const apiKey = process.env.TAVILY_API_KEY
      if (!apiKey) {
        // Tool was included but key disappeared at runtime — return empty rather than throw.
        // A thrown error here becomes 3:"An error occurred." in the data stream.
        console.warn("[search] TAVILY_API_KEY missing at execution time")
        return { query, answer: "Web search is not configured.", sources: [] }
      }

      console.log(`🔍 [search] "${query}"`)

      try {
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: apiKey,
            query,
            max_results: 5,
            include_answer: true,
          }),
        })

        if (!res.ok) {
          console.error(`[search] Tavily returned ${res.status}`)
          return { query, answer: "Search temporarily unavailable.", sources: [] }
        }

        const data = await res.json()

        return {
          query,
          answer: data.answer || "",
          sources: (data.results || []).slice(0, 3).map(
            (r: { title: string; url: string; content: string }) => ({
              title: r.title,
              url: r.url,
              snippet: r.content?.slice(0, 200) || "",
            })
          ),
        }
      } catch (err) {
        // Network error, timeout, JSON parse error — never throw into the stream
        console.error("[search] fetch error:", err)
        return { query, answer: "Search temporarily unavailable.", sources: [] }
      }
    },
  })
}
