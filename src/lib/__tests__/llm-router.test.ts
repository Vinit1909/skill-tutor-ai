import { describe, it, expect, beforeEach } from "vitest"
import { classifyChatTask, routeToProviders } from "@/lib/llm-router"

type Msg = { role: string; content: string }
const user = (content: string): Msg => ({ role: "user", content })
const assistant = (content: string): Msg => ({ role: "assistant", content })

describe("classifyChatTask", () => {
  it("routes images to VISION", () => {
    expect(classifyChatTask([user("what is this?")], true)).toBe("VISION")
  })

  it("routes exercise requests to EXERCISE (the Groq-8b root-cause fix)", () => {
    // All real phrasings that previously fell through to CHAT_SIMPLE → 8b
    for (const text of [
      "Give me an exercise on Array",
      "give me a coding exercise on arrays",
      "Give me an exercise related to array",
      "quiz me on closures",
      "give me a leetcode style problem",
    ]) {
      expect(classifyChatTask([user(text)])).toBe("EXERCISE")
    }
  })

  it("routes exercise follow-ups to EXERCISE only after a recent exercise", () => {
    const history = [assistant('Here is a problem: {"starterCode": "def f():"} ...')]
    expect(classifyChatTask([...history, user("another one")])).toBe("EXERCISE")
    expect(classifyChatTask([...history, user("make it harder")])).toBe("EXERCISE")
    // No recent exercise → not an exercise
    expect(classifyChatTask([assistant("Loops repeat code."), user("another one")])).toBe(
      "CHAT_SIMPLE"
    )
  })

  it("routes diagram requests to DIAGRAM", () => {
    expect(classifyChatTask([user("draw a diagram of the GCP architecture")])).toBe("DIAGRAM")
    expect(classifyChatTask([user("can you show me a flowchart of the event loop")])).toBe(
      "DIAGRAM"
    )
  })

  it("routes diagram follow-ups to DIAGRAM only after a recent diagram", () => {
    const history = [assistant("```mermaid\ngraph TD\n A-->B\n```")]
    expect(classifyChatTask([...history, user("color code the same")])).toBe("DIAGRAM")
    expect(classifyChatTask([assistant("Plain prose."), user("make it simpler")])).toBe(
      "CHAT_SIMPLE"
    )
  })

  it("does not false-positive on prose containing trigger-adjacent words", () => {
    expect(classifyChatTask([user("explain the architecture of React")])).toBe("CHAT_SIMPLE")
    expect(classifyChatTask([user("how do I draw conclusions from this data")])).toBe(
      "CHAT_SIMPLE"
    )
    expect(classifyChatTask([user("explain the problem with global variables")])).toBe(
      "CHAT_SIMPLE"
    )
  })

  it("routes code-heavy long messages to CODE_ANALYSIS", () => {
    const code =
      "Can you review this function for bugs and tell me what happens with empty input lists and how to improve performance overall?\n```python\ndef f(a):\n  return sorted(a)\n```"
    expect(classifyChatTask([user(code)])).toBe("CODE_ANALYSIS")
  })

  it("defaults short questions to CHAT_SIMPLE", () => {
    expect(classifyChatTask([user("what is a closure")])).toBe("CHAT_SIMPLE")
  })
})

describe("routeToProviders (Groq only — no NVIDIA key)", () => {
  beforeEach(() => {
    // Provider construction reads env at call time — give it a Groq key only.
    process.env.GROQ_API_KEY = "test-key"
    delete process.env.GOOGLE_API_KEY
    delete process.env.TOGETHER_API_KEY
    delete process.env.NVIDIA_API_KEY
  })

  it("assigns task-appropriate token budgets", () => {
    expect(routeToProviders({ taskType: "EXERCISE" }).maxTokens).toBeGreaterThanOrEqual(1500)
    expect(routeToProviders({ taskType: "DIAGRAM" }).maxTokens).toBeGreaterThan(
      routeToProviders({ taskType: "CHAT_SIMPLE" }).maxTokens
    )
  })

  it("never routes EXERCISE to the 8b model first", () => {
    const { providers } = routeToProviders({ taskType: "EXERCISE" })
    expect(providers[0].name).toBe("Groq (llama-3.3-70b)")
  })

  it("restricts VISION to multimodal providers only", () => {
    const { providers } = routeToProviders({ taskType: "VISION" })
    expect(providers.every((p) => /vision|Gemini/i.test(p.name))).toBe(true)
  })

  it("fails fast when VISION has no multimodal provider", () => {
    delete process.env.GROQ_API_KEY
    expect(() => routeToProviders({ taskType: "VISION" })).toThrow()
  })
})

describe("routeToProviders (NVIDIA NIM configured — last-resort only)", () => {
  beforeEach(() => {
    process.env.GROQ_API_KEY = "test-key"
    process.env.NVIDIA_API_KEY = "nvapi-test"
    delete process.env.GOOGLE_API_KEY
    delete process.env.TOGETHER_API_KEY
  })

  it("NIM NEVER leads any interactive chain (measured: 120–260s TTFT on free tier)", () => {
    for (const task of [
      "CHAT_SIMPLE", "CHAT_COMPLEX", "CODE_ANALYSIS", "DIAGRAM",
      "EXERCISE", "STRUCTURED", "VISION", "PROGRESSION",
    ] as const) {
      const { providers } = routeToProviders({ taskType: task })
      expect(providers[0].name, `${task} must not lead with NIM`).not.toContain("NVIDIA")
    }
  })

  it("Groq 70b leads STRUCTURED (measured 2.0s vs NIM's 262.8s for a roadmap)", () => {
    expect(routeToProviders({ taskType: "STRUCTURED" }).providers[0].name).toBe(
      "Groq (llama-3.3-70b)"
    )
    expect(routeToProviders({ taskType: "EXERCISE" }).providers[0].name).toBe(
      "Groq (llama-3.3-70b)"
    )
  })

  it("NIM is present as a last-resort fallback in quality chains", () => {
    for (const task of ["CHAT_COMPLEX", "CODE_ANALYSIS", "EXERCISE", "STRUCTURED"] as const) {
      const names = routeToProviders({ taskType: task }).providers.map((p) => p.name)
      expect(names).toContain("NVIDIA (mistral-large-3-675b)")
    }
  })

  it("never registers Maverick (it leaks tool-call JSON into the text stream — verified live)", () => {
    for (const task of ["CHAT_COMPLEX", "DIAGRAM", "VISION", "STRUCTURED"] as const) {
      const { providers } = routeToProviders({ taskType: task })
      expect(providers.every((p) => !p.name.includes("maverick"))).toBe(true)
    }
  })

  it("VISION keeps the NVIDIA vision model as fallback and stays multimodal-only", () => {
    const { providers } = routeToProviders({ taskType: "VISION" })
    const names = providers.map((p) => p.name)
    expect(names[0]).toBe("Groq (llama-4-scout vision)")
    expect(names).toContain("NVIDIA (llama-3.2-90b-vision)")
    expect(providers.every((p) => /vision|Gemini/i.test(p.name))).toBe(true)
  })
})
