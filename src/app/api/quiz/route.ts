import { NextRequest, NextResponse } from "next/server"
import { generateObject } from "ai"
import { getOrderedProviders } from "@/lib/ai-providers"
import { getSkillSpace } from "@/lib/skillspace"
import { loadChatMessages } from "@/lib/skillChat"
import { buildQuizPrompt } from "@/lib/prompts"
import { QuizResponseSchema, QuizQuestion } from "@/lib/schemas"

export const runtime = "nodejs"
export const maxDuration = 30

interface RoadmapNode {
  id: string
  title: string
  children?: Array<{ id: string; title: string }>
}

interface ChatMessage {
  role: string
  content: string
  nodeId?: string
}

export async function POST(req: NextRequest) {
  try {
    const { uid, skillId, nodeIds } = await req.json()
    if (!uid || !skillId || !nodeIds || !Array.isArray(nodeIds)) {
      return NextResponse.json({ error: "Missing or invalid parameters" }, { status: 400 })
    }

    const skill = await getSkillSpace(uid, skillId)
    if (!skill || !skill.roadmapJSON?.nodes) {
      return NextResponse.json({ error: "Skill or roadmap not found" }, { status: 404 })
    }

    const nodeTitles = nodeIds
      .map((id) =>
        skill.roadmapJSON?.nodes
          .flatMap((n: RoadmapNode) => n.children || [])
          .find((c: { id: string; title: string }) => c.id === id)?.title
      )
      .filter(Boolean)
      .join(", ")

    if (!nodeTitles) {
      return NextResponse.json({ error: "No valid topics selected" }, { status: 400 })
    }

    // Load relevant chat history for context (fire-and-forget friendly — non-critical)
    let chatHistory = "No chat history available."
    try {
      const { messages: allMessages } = await loadChatMessages(uid, skillId)
      const relevant = allMessages
        .filter((msg: ChatMessage) => nodeIds.includes(msg.nodeId ?? ""))
        .map((msg: ChatMessage) => `${msg.role}: ${msg.content}`)
        .join("\n")
      if (relevant) chatHistory = relevant
    } catch {
      // Non-critical — quiz can still be generated without chat context
    }

    const prompt = buildQuizPrompt({ skillName: skill.name, nodeTitles, chatHistory })

    // ── Try each provider in failover order ──────────────────────────────────
    const providers = getOrderedProviders()
    let questions: QuizQuestion[] | null = null

    for (const provider of providers) {
      try {
        console.log(`🎯 [quiz] ${provider.name} — generating for: ${nodeTitles}`)

        const { object } = await generateObject({
          model: provider.model,
          schema: QuizResponseSchema,
          prompt,
          maxRetries: 0, // fail fast — we handle failover ourselves
        })

        // Post-parse quality filter (same as before, but now type-safe)
        const valid = object.questions.filter((q) => {
          if (q.type === "multiple-choice") {
            return (
              q.options &&
              q.options.length === 4 &&
              ["a", "b", "c", "d"].includes(q.correctAnswer as string)
            )
          }
          if (q.type === "fill-in-the-blank") {
            return typeof q.correctAnswer === "string" && q.correctAnswer.length > 0
          }
          if (q.type === "matching") {
            return (
              q.pairs &&
              q.pairs.length >= 2 &&
              Array.isArray(q.correctAnswer)
            )
          }
          return false
        })

        if (valid.length < 5) {
          console.warn(`⚠️ [quiz] ${provider.name} — only ${valid.length} valid questions, trying next provider`)
          continue
        }

        console.log(`✅ [quiz] ${provider.name} — ${valid.length} questions`)
        questions = valid
        break
      } catch (err) {
        console.error(`❌ [quiz] ${provider.name} failed:`, err)
        // Try next provider
      }
    }

    if (!questions) {
      console.warn("⚠️ [quiz] All providers failed — using fallback exercises")
      questions = buildFallbackExercises(skill.name, nodeTitles)
    }

    return NextResponse.json(questions)
  } catch (err: unknown) {
    console.error("Quiz API error:", err)
    const errorMessage = err instanceof Error ? err.message : "Failed to generate exercises"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

function buildFallbackExercises(skillName: string, nodeTitles: string): QuizQuestion[] {
  const firstTopic = nodeTitles.split(", ")[0] || skillName
  return [
    {
      type: "multiple-choice",
      question: `What is a key feature of ${firstTopic}?`,
      options: ["a. Performance", "b. Simplicity", "c. Flexibility", "d. All of the above"],
      correctAnswer: "d",
    },
    {
      type: "fill-in-the-blank",
      question: `${firstTopic} is a fundamental concept in ${skillName} that helps with ___.`,
      correctAnswer: "problem solving",
    },
    {
      type: "multiple-choice",
      question: `When should you use ${firstTopic}?`,
      options: [
        "a. Always, in every situation",
        "b. When it solves the problem at hand",
        "c. Never, it's outdated",
        "d. Only in large projects",
      ],
      correctAnswer: "b",
    },
    {
      type: "fill-in-the-blank",
      question: `In ${skillName}, ___ is used to organize code effectively.`,
      correctAnswer: firstTopic,
    },
    {
      type: "multiple-choice",
      question: `Which of the following best describes ${skillName}?`,
      options: [
        "a. A programming language only",
        "b. A set of tools and concepts for building solutions",
        "c. A database technology",
        "d. An operating system",
      ],
      correctAnswer: "b",
    },
  ]
}
