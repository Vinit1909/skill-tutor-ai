import { callGroqLLM } from "./llm";

export async function generateRoadmap({
    skillName, 
    level, 
    goals, 
    priorKnowledge,
}: {
    skillName: string
    level?: string
    goals?: string
    priorKnowledge?: string
}): Promise<{
    roadmap: any
    questions: any[]
}> {
    const prompt = `
    You are an expert tutor. Generate a JSON roadmap (no code fences) for learning ${skillName}.
    User context:
    - Level: ${level}
    - Goals: ${goals}
    - Prior knowledge: ${priorKnowledge}

    Please respond only with valid JSON in the format:
    {
        "roadmap": {
            "title": "${skillName} Roadmap",
            "nodes": [
                {"id": "1", "title": "...", "status": "NOT_STARTED","children": [...]}
            ]
        },
        "questions": [
            {
                "nodeId": "1",
                "question": "...",
                "shortDesc": "...",
            },
            {
                ...
            }
        ]
    }
    Instructions for Roadmap:
    The roadmap should be engaging with creative titles for parent nodes, making the user excited about it.        
    Align children nodes with the parent nodes with respect to the content.    
    
    Instructions for Questions:
    Generate questions that are fun and should be relevant to the Roadmap.
    Make sure the questions are short and concise and are of equal lengths.
    These questions should be something that users would like to ask, or users would not have thought about.
    The short desc should be like the area of the skill or relevant info (not more than two words).
    
    General Instructions:
    No extra text, no commentary, just the JSON structure.
    If you cannot produce JSON, output an empty JSON structure with a "title" and an empty "nodes" array.
    `;

    const messages = [
        {
            role: "user" as const,
            content: prompt
        }
    ];

    const aiResponse = await callGroqLLM(messages); 

    // let roadmap;
    let combined;
    try {
        combined = JSON.parse(aiResponse.trim());
    } catch (err) {
        console.error("Error parsing AI JSON:", err)
        combined = {roadmap: null, questions: []};
    }
    return {
        roadmap: combined.roadmap || { title: "", nodes: [] },
        questions: combined.questions || [],
    }
}