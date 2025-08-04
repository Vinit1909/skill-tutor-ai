// import { callGroqLLM } from "./llm"

// interface RoadmapNode {
//   id: string
//   title: string
//   status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"
//   weight: number
//   children?: RoadmapNode[]
// }

// interface Roadmap {
//   title: string
//   nodes: RoadmapNode[]
// }

// interface Question {
//   nodeId: string
//   question: string
//   shortDesc: string
// }

// interface GenerateRoadmapResponse {
//   roadmap: Roadmap
//   questions: Question[]
// }

// export async function generateRoadmap({
//     skillName, 
//     level, 
//     goals, 
//     priorKnowledge,
// }: {
//     skillName: string
//     level?: string
//     goals?: string
//     priorKnowledge?: string
// }): Promise<GenerateRoadmapResponse> {
//     const prompt = `
//     You are an expert tutor. Generate a JSON roadmap (no code fences) for learning ${skillName}.
//     User context:
//     - Level: ${level}
//     - Goals: ${goals}
//     - Prior knowledge: ${priorKnowledge}

//     Please respond only with valid JSON in the format:
//     {
//         "roadmap": {
//             "title": "${skillName} Roadmap",
//             "nodes": [
//                 {"id": "uniqueTopicId", "title": "...", "status": "NOT_STARTED", "weight": 1, "children": [...]}
//             ]
//         },
//         "questions": [
//             {
//                 "nodeId": "uniqueTopicId",
//                 "question": "...",
//                 "shortDesc": "...",
//             },
//             {
//                 ...
//             }
//         ]
//     }
//     Instructions for Roadmap:
//     The roadmap should be engaging with creative titles for parent nodes, making the user excited about it.        
//     Align children nodes with the parent nodes with respect to the content.
//     Weight the nodes according to their level of importance. It is for tracking progress.
    
//     Instructions for Questions:
//     Generate questions that are fun and should be relevant to the Roadmap.
//     Make sure the questions are short and concise and are of equal lengths.
//     These questions should be something that users would like to ask, or users would not have thought about.
//     The short desc should be like the area of the skill or relevant info (not more than two words).
    
//     General Instructions:
//     No extra text, no commentary, just the JSON structure.
//     If you cannot produce JSON, output an empty JSON structure with a "title" and an empty "nodes" array.
//     `

//     const messages = [
//         {
//             role: "user" as const,
//             content: prompt
//         }
//     ]

//     const aiResponse = await callGroqLLM(messages)

//     let combined: { roadmap?: Roadmap; questions?: Question[] }
//     try {
//         combined = JSON.parse(aiResponse.trim())
//     } catch (err) {
//         console.error("Error parsing AI JSON:", err)
//         combined = { roadmap: undefined, questions: [] }
//     }

//     if (combined.roadmap && Array.isArray(combined.roadmap.nodes)) {
//         combined.roadmap.nodes = combined.roadmap.nodes.map((n: RoadmapNode) => ({
//             ...n,
//             status: n.status || "NOT_STARTED",
//             weight: n.weight || 1,
//         }))
//     }

//     return {
//         roadmap: combined.roadmap || { title: "", nodes: [] },
//         questions: combined.questions || [],
//     }
// }

import { multiLLM } from "./llm-providers"

interface RoadmapNode {
  id: string
  title: string
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"
  weight: number
  children?: RoadmapNode[]
}

interface Roadmap {
  title: string
  nodes: RoadmapNode[]
}

interface Question {
  nodeId: string
  question: string
  shortDesc: string
}

interface GenerateRoadmapResponse {
  roadmap: Roadmap
  questions: Question[]
}

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
}): Promise<GenerateRoadmapResponse> {
    // const prompt = `
    // You are an expert tutor. Generate a JSON roadmap (no code fences) for learning ${skillName}.
    // User context:
    // - Level: ${level}
    // - Goals: ${goals}
    // - Prior knowledge: ${priorKnowledge}

    // Please respond only with valid JSON in the format:
    // {
    //     "roadmap": {
    //         "title": "${skillName} Roadmap",
    //         "nodes": [
    //             {"id": "uniqueTopicId", "title": "...", "status": "NOT_STARTED", "weight": 1, "children": [...]}
    //         ]
    //     },
    //     "questions": [
    //         {
    //             "nodeId": "uniqueTopicId",
    //             "question": "...",
    //             "shortDesc": "...",
    //         },
    //         {
    //             ...
    //         }
    //     ]
    // }
    // Instructions for Roadmap:
    // The roadmap should be engaging with creative titles for parent nodes, making the user excited about it.        
    // Align children nodes with the parent nodes with respect to the content.
    // Weight the nodes according to their level of importance. It is for tracking progress.
    
    // Instructions for Questions:
    // Generate questions that are fun and should be relevant to the Roadmap.
    // Make sure the questions are short and concise and are of equal lengths.
    // These questions should be something that users would like to ask, or users would not have thought about.
    // The short desc should be like the area of the skill or relevant info (not more than two words).
    
    // General Instructions:
    // No extra text, no commentary, just the JSON structure.
    // If you cannot produce JSON, output an empty JSON structure with a "title" and an empty "nodes" array.
    // `

    const prompt = `
        Generate a JSON roadmap for learning ${skillName} with this EXACT structure:

        {
            "roadmap": {
                "title": "${skillName} Learning Path",
                "nodes": [
                    {
                        "id": "fundamentals",
                        "title": "Fundamentals",
                        "status": "NOT_STARTED", 
                        "weight": 3,
                        "children": [
                            {"id": "basics", "title": "Basic Concepts", "status": "NOT_STARTED", "weight": 1},
                            {"id": "syntax", "title": "Syntax", "status": "NOT_STARTED", "weight": 1}
                        ]
                    }
                ]
            },
            "questions": [
                {"nodeId": "basics", "question": "What are the key concepts?", "shortDesc": "Concepts"}
            ]
        }

        Create 3-4 parent nodes, each with 2-4 children. Use ONLY this structure.
        `

    const messages = [
        {
            role: "user" as const,
            content: prompt
        }
    ]

    console.log("🎯 Starting roadmap generation with multi-LLM system...")

    // Use the multi-LLM system instead of just Groq
    const result = await multiLLM.callLLM(messages)

    console.log(`✅ Roadmap generated via ${result.provider} (attempt ${result.attempt})`)

    let combined: { roadmap?: Roadmap; questions?: Question[] }
    try {
        combined = JSON.parse(result.content.trim())
    } catch (err) {
        console.error("Error parsing AI JSON:", err)
        console.error("Raw AI response:", result.content)
        combined = { roadmap: undefined, questions: [] }
    }

    if (combined.roadmap && Array.isArray(combined.roadmap.nodes)) {
        combined.roadmap.nodes = combined.roadmap.nodes.map((n: RoadmapNode) => ({
            ...n,
            status: n.status || "NOT_STARTED",
            weight: n.weight || 1,
        }))
    }

    return {
        roadmap: combined.roadmap || { title: `${skillName} Roadmap`, nodes: [] },
        questions: combined.questions || [],
    }
}