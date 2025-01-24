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
}): Promise<any> {
    const prompt = `
    You are an expert tutor. Generate a JSON roadmap (no code fences) for learning ${skillName}.
    User context:
    - Level: ${level}
    - Goals: ${goals}
    - Prior knowledge: ${priorKnowledge}

    Respond only with valid JSON in the format:
    {
        "title": "${skillName} Roadmap",
        "nodes": [
            {
                "id": "1",
                "title": "...",
                "status": "NOT_STARTED",
                "children": [...]
            }
        ]
    }
    No extra text, no commentary 
    If you cannot produce JSON, output an empty JSON structure with a "title" and an empty "nodes" array.
    `;

    const messages = [
        {
            role: "user" as const,
            content: prompt
        }
    ];

    const aiResponse = await callGroqLLM(messages); 

    let roadmap;
    try {
        roadmap = JSON.parse(aiResponse.trim());
    } catch (err) {
        console.error("Error parsing AI JSON:", err)
        roadmap = {title: "Error Roadmap", nodes: []};
    }
    return roadmap;
}