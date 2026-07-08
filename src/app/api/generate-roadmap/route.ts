/**
 * Generates a personalized learning roadmap + starter questions for a skill.
 *
 * Pure generation: identity-checked (Firebase ID token), no Firestore I/O.
 * The authenticated client supplies the skill name and persists the results —
 * locked security rules reject unauthenticated server-side client-SDK access,
 * and the browser is where the user's auth context lives.
 */

import { NextRequest, NextResponse } from "next/server"
import { generateRoadmap } from "@/lib/roadmapAI"
import { verifyAuth } from "@/lib/serverAuth"
import { checkRateLimit } from "@/lib/usage"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { uid, skillId, skillName, level, goals, priorKnowledge } = await req.json()

    if (!uid || !skillId || typeof skillName !== "string" || !skillName.trim()) {
      return NextResponse.json(
        { error: "Missing required parameters: uid, skillId, skillName" },
        { status: 400 }
      )
    }

    const auth = await verifyAuth(req, uid)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const rateError = checkRateLimit(uid)
    if (rateError) {
      return NextResponse.json({ error: rateError }, { status: 429 })
    }

    console.log("🎯 Generating roadmap for:", { skillId, skillName, level })

    const { roadmap, questions } = await generateRoadmap({
      skillName: skillName.slice(0, 200),
      level: level || "beginner",
      goals: goals || "",
      priorKnowledge: priorKnowledge || "",
    })

    return NextResponse.json({
      roadmap,
      questions,
      message: "Roadmap generated successfully!",
    })
  } catch (error: unknown) {
    console.error("❌ Error in /api/generate-roadmap:", error)

    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

    if (errorMessage.includes("No LLM providers available")) {
      return NextResponse.json(
        {
          error: "AI services temporarily unavailable",
          userMessage:
            "Our AI roadmap generator is currently offline. Please try again later or contact support.",
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        error: errorMessage,
        userMessage:
          "Unable to generate roadmap right now. Our AI is experiencing high demand. Please try again in a moment.",
      },
      { status: 500 }
    )
  }
}
