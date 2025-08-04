// import { generateRoadmap } from "@/lib/roadmapAI";
// import { getSkillSpace, updateSkillSpace } from "@/lib/skillspace";
// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebase";
// import { doc, collection, addDoc, getDocs, deleteDoc } from "firebase/firestore";

// export async function POST(req: NextRequest) {
//     try {
//         const {uid, skillId, level, goals, priorKnowledge } = await req.json();

//         const skill = await getSkillSpace(uid, skillId);
//         if (!skill) {
//             return NextResponse.json({error: "Skill not found"}, {status:404})
//         }
//         const skillName = skill.name || "Unknown Skill";

//         const { roadmap, questions } = await generateRoadmap({
//             skillName, 
//             level, 
//             goals, 
//             priorKnowledge,
//         });

//         await deleteOldQuestions(uid, skillId);

//         await updateSkillSpace(uid, skillId, {
//             roadmapContext: {level, goals, priorKnowledge},
//             roadmapJSON: roadmap,
//         });

//         const skillRef = doc(db, "users", uid, "skillspaces", skillId)
//         const questionsRef = collection(skillRef, "questions")

//         for (const q of questions) {
//             await addDoc(questionsRef, q);
//         }

//         return NextResponse.json({
//             success: true,
//             roadmap,
//             questions,
//         });
//     } catch (err:unknown) {
//         console.error("Error in /api/generate-roadmap:", err);
//         const errorMessage = err instanceof Error ? err.message : String(err)
//         return NextResponse.json({error: errorMessage}, {status: 500})
//     }
// }

// async function deleteOldQuestions(uid: string, skillId: string) {
//     const skillRef = doc(db, "users", uid, "skillspaces", skillId);
//     const questionsRef = collection(skillRef, "questions");
//     const snap = await getDocs(questionsRef);
//     for (const docSnap of snap.docs) {
//         await deleteDoc(docSnap.ref);
//     }
// }

import { NextRequest, NextResponse } from "next/server"
import { generateRoadmap } from "@/lib/roadmapAI"
import { getSkillSpace, updateSkillSpace } from "@/lib/skillspace"

export async function POST(req: NextRequest) {
  try {
    const { uid, skillId, level, goals, priorKnowledge } = await req.json()

    if (!uid || !skillId) {
      return NextResponse.json(
        { error: "Missing required parameters: uid, skillId" },
        { status: 400 }
      )
    }

    // Get the actual skill name from the database
    const skillData = await getSkillSpace(uid, skillId)
    const skillName = skillData?.name || skillId

    console.log("🎯 Generating roadmap for:", { skillId, skillName, level })

    // This will now automatically use the multi-LLM system
    const { roadmap, questions } = await generateRoadmap({
      skillName: skillName, // Use actual skill name instead of skillId
      level: level || "beginner",
      goals: goals || "",
      priorKnowledge: priorKnowledge || ""
    })

    // Save the roadmap and questions back to the database
    await updateSkillSpace(uid, skillId, {
      roadmapJSON: roadmap,
      roadmapContext: {
        level: level || "beginner",
        goals: goals || "",
        priorKnowledge: priorKnowledge || ""
      },
      level: level || "beginner",
      goals: goals || "",
      priorKnowledge: priorKnowledge || ""
    })

    console.log("✅ Roadmap generated and saved successfully")

    return NextResponse.json({
      roadmap,
      questions,
      message: "Roadmap generated successfully!"
    })

  } catch (error: unknown) {
    console.error("❌ Error in /api/generate-roadmap:", error)
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
    
    // Check if it's a "no providers" error
    if (errorMessage.includes("No LLM providers available")) {
      return NextResponse.json(
        { 
          error: "AI services temporarily unavailable",
          userMessage: "Our AI roadmap generator is currently offline. Please try again later or contact support.",
          technicalDetails: errorMessage
        },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        userMessage: "Unable to generate roadmap right now. Our AI is experiencing high demand. Please try again in a moment."
      },
      { status: 500 }
    )
  }
}