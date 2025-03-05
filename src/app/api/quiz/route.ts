// app/api/quiz/route.ts
import { NextRequest, NextResponse } from "next/server"
import { callGroqLLM } from "@/lib/llm"
import { getSkillSpace } from "@/lib/skillspace"
import { loadChatMessages } from "@/lib/skillChat"

export async function POST(req: NextRequest) {
  try {
    const { uid, skillId, nodeIds } = await req.json()
    if (!uid || !skillId || !nodeIds || !Array.isArray(nodeIds)) {
      return NextResponse.json({ error: "Missing or invalid parameters" }, { status: 400 })
    }

    const skill = await getSkillSpace(uid, skillId)
    if (!skill || !skill.roadmapJSON?.nodes) {
      console.error("Skill or roadmap not found:", { uid, skillId })
      return NextResponse.json({ error: "Skill or roadmap not found" }, { status: 404 })
    }

    const nodeTitles = nodeIds
      .map(id => skill.roadmapJSON?.nodes.flatMap((n: any) => n.children || []).find((c: any) => c.id === id)?.title)
      .filter(Boolean)
      .join(", ")
    if (!nodeTitles) {
      console.error("No valid node titles for nodeIds:", nodeIds)
      return NextResponse.json({ error: "No valid topics selected" }, { status: 400 })
    }

    const chatHistory = await loadChatMessages(uid, skillId)
      .then(messages => messages
        .filter((msg: any) => nodeIds.includes(msg.nodeId))
        .map((msg: any) => `${msg.role}: ${msg.content}`)
        .join("\n") || "No chat history available.")

    const prompt = `
      You are an expert tutor for ${skill.name}.
      Generate 20 to 30 unique exercises based on:
      - Topics: ${nodeTitles}
      - Chat history: ${chatHistory}
      Respond *only* with a valid JSON array containing 20 to 30 items:
      [
        { "type": "multiple-choice", "question": "...", "options": ["a. ...", "b. ...", "c. ...", "d. ..."], "correctAnswer": "a" },
        { "type": "fill-in-the-blank", "question": "Complete: ___ is a key concept.", "correctAnswer": "..." },
        { "type": "matching", "question": "Match terms to definitions", "pairs": [{"term": "...", "definition": "..."}, {"term": "...", "definition": "..."}], "correctAnswer": [{"term": "...", "definition": "..."}, {"term": "...", "definition": "..."}] }
      ]
      Requirements:
      - Include a balanced mix of multiple-choice (4 options labeled "a.", "b.", "c.", "d.", correctAnswer as "a", "b", "c", or "d"), fill-in-the-blank (single-word/phrase correctAnswer as a string), and matching (2-4 term-definition pairs, correctAnswer matches pairs exactly).
      - Aim for roughly equal distribution (e.g., 8-12 MCQs, 6-10 fill-in-the-blanks, 6-10 matching), but flexibility is allowed.
      - Make exercises fun, concise, relevant, varied, and avoid repetition.
      - If unable to generate enough, fill remaining slots with contextual exercises like {"type": "fill-in-the-blank", "question": "___ is a key topic in ${skill.name}.", "correctAnswer": "${nodeTitles.split(", ")[0] || "Learning"}"}.
      **Critical**: Return a valid JSON array with 20 to 30 items.
    `

    let exercises: string
    try {
      exercises = await callGroqLLM([{ role: "user", content: prompt }])
      console.log("Raw AI response:", exercises)
    } catch (err) {
      console.error("Error calling Groq LLM:", err)
      return NextResponse.json({ error: "Failed to generate exercises" }, { status: 500 })
    }

    let parsedExercises: any[]
    try {
      parsedExercises = JSON.parse(exercises)
      if (!Array.isArray(parsedExercises) || parsedExercises.length < 20 || parsedExercises.length > 30) {
        throw new Error(`Expected 20-30 exercises, got ${parsedExercises.length}`)
      }

      parsedExercises.forEach((q: any) => {
        if (!["multiple-choice", "fill-in-the-blank", "matching"].includes(q.type)) {
          throw new Error(`Invalid question type: ${q.type}`)
        }
        if (q.type === "multiple-choice" && (!q.options || q.options.length !== 4 || !["a", "b", "c", "d"].includes(q.correctAnswer))) {
          throw new Error("Invalid multiple-choice format")
        }
        if (q.type === "fill-in-the-blank" && typeof q.correctAnswer !== "string") {
          throw new Error("Invalid fill-in-the-blank format")
        }
        if (q.type === "matching" && (!q.pairs || !Array.isArray(q.pairs) || q.pairs.length < 2 || !Array.isArray(q.correctAnswer))) {
          throw new Error("Invalid matching format")
        }
      })
    } catch (err) {
      console.error("Invalid AI response:", err, "Raw response:", exercises)
      parsedExercises = [
        { type: "multiple-choice", question: `What is a key feature of ${skill.name}?`, options: ["a. Speed", "b. UI", "c. Data", "d. Loops"], correctAnswer: "b" },
        { type: "fill-in-the-blank", question: `${skill.name} uses ___ for syntax.`, correctAnswer: "JSX" },
        { type: "matching", question: "Match terms", pairs: [{ term: "JSX", definition: "Syntax extension" }, { term: "Component", definition: "Reusable UI" }], correctAnswer: [{ term: "JSX", definition: "Syntax extension" }, { term: "Component", definition: "Reusable UI" }] },
        // Add more contextual fallbacks up to 20
      ].concat(Array(17).fill({ type: "fill-in-the-blank", question: `${skill.name} is a ___ tool.`, correctAnswer: nodeTitles.split(", ")[0] || "great" }))
      console.warn("Using contextual fallback exercises due to invalid AI response")
    }

    return NextResponse.json(parsedExercises)
  } catch (err: any) {
    console.error("Quiz API error:", err)
    return NextResponse.json({ error: err.message || "Failed to generate exercises" }, { status: 500 })
  }
}