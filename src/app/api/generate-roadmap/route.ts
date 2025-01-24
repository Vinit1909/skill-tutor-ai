import { generateRoadmap } from "@/lib/roadmapAI";
import { getSkillSpace, updateSkillSpace } from "@/lib/skillspace";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const {uid, skillId, level, goals, priorKnowledge } = await req.json();

        const skill = await getSkillSpace(uid, skillId);
        if (!skill) {
            return NextResponse.json({error: "Skill not found"}, {status:404})
        }
        const skillName = skill.name || "Unknown Skill";

        const roadmapJSON = await generateRoadmap({
            skillName, 
            level, 
            goals, 
            priorKnowledge,
        });

        await updateSkillSpace(uid, skillId, {
            roadmapContext: {level, goals, priorKnowledge},
            roadmapJSON,
        });

        return NextResponse.json({success: true, roadmapJSON});
    } catch (err:any) {
        console.error(err);
        return NextResponse.json({error: err.message}, {status: 500})
    }
}