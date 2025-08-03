import { generateRoadmap } from "@/lib/roadmapAI";
import { getSkillSpace, updateSkillSpace } from "@/lib/skillspace";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, collection, addDoc, getDocs, deleteDoc } from "firebase/firestore";

export async function POST(req: NextRequest) {
    try {
        const {uid, skillId, level, goals, priorKnowledge } = await req.json();

        const skill = await getSkillSpace(uid, skillId);
        if (!skill) {
            return NextResponse.json({error: "Skill not found"}, {status:404})
        }
        const skillName = skill.name || "Unknown Skill";

        const { roadmap, questions } = await generateRoadmap({
            skillName, 
            level, 
            goals, 
            priorKnowledge,
        });

        await deleteOldQuestions(uid, skillId);

        await updateSkillSpace(uid, skillId, {
            roadmapContext: {level, goals, priorKnowledge},
            roadmapJSON: roadmap,
        });

        const skillRef = doc(db, "users", uid, "skillspaces", skillId)
        const questionsRef = collection(skillRef, "questions")

        for (const q of questions) {
            await addDoc(questionsRef, q);
        }

        return NextResponse.json({
            success: true,
            roadmap,
            questions,
        });
    } catch (err:unknown) {
        console.error("Error in /api/generate-roadmap:", err);
        const errorMessage = err instanceof Error ? err.message : String(err)
        return NextResponse.json({error: errorMessage}, {status: 500})
    }
}

async function deleteOldQuestions(uid: string, skillId: string) {
    const skillRef = doc(db, "users", uid, "skillspaces", skillId);
    const questionsRef = collection(skillRef, "questions");
    const snap = await getDocs(questionsRef);
    for (const docSnap of snap.docs) {
        await deleteDoc(docSnap.ref);
    }
}