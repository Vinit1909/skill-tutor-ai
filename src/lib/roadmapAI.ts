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
                "topicLogoKey": "...",
            },
            {
                ...
            }
        ]
    }
    Instructions for Roadmap:
    The roadmap should be engaging with creative titles for parent nodes, making the user excited about it.        
    With respect to roadmap for parent nodes try to include some relevant emojis. Do not add emoji for title of the roadmap.
    Align children nodes with the parent nodes with respect to the content.    
    
    Instructions for Questions:
    Keep the question short and concise and of equal lengths to each other for better UI.
    
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