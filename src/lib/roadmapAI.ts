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
        You are an expert tutor. Generate a JSON roadmap (no code fences) for learning ${skillName}.
        User context:
        - Level: ${level}
        - Goals: ${goals}
        - Prior knowledge: ${priorKnowledge}

        IMPORTANT: The roadmap must have a HIERARCHICAL structure with parent nodes containing child nodes.

        Please respond only with valid JSON in the format:
        {
            "roadmap": {
                "title": "${skillName} Roadmap",
                "nodes": [
                    {
                        "id": "parentTopic1",
                        "title": "Parent Topic 1",
                        "status": "NOT_STARTED",
                        "weight": 3,
                        "children": [
                            {"id": "childTopic1", "title": "Child Topic 1", "status": "NOT_STARTED", "weight": 1},
                            {"id": "childTopic2", "title": "Child Topic 2", "status": "NOT_STARTED", "weight": 1}
                        ]
                    },
                    {
                        "id": "parentTopic2",
                        "title": "Parent Topic 2", 
                        "status": "NOT_STARTED",
                        "weight": 4,
                        "children": [
                            {"id": "childTopic3", "title": "Child Topic 3", "status": "NOT_STARTED", "weight": 2},
                            {"id": "childTopic4", "title": "Child Topic 4", "status": "NOT_STARTED", "weight": 2}
                        ]
                    }
                ]
            },
            "questions": [
                {
                    "nodeId": "childTopic1",
                    "question": "...",
                    "shortDesc": "..."
                }
            ]
        }

        Rules:
        1. ONLY create parent nodes in the main "nodes" array
        2. Each parent node MUST have a "children" array with child nodes
        3. Child nodes should NOT have their own children array
        4. All IDs must be unique and use camelCase
        5. Questions should reference child node IDs only
        6. Parent nodes represent major topics, children represent subtopics
        
        Generate exactly 3-4 parent nodes, each with 2-4 child nodes.
        No extra text, no commentary, just the JSON structure.
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

    // Add validation and fixing
    if (combined.roadmap && Array.isArray(combined.roadmap.nodes)) {
        // Fix flat structure if AI generated it incorrectly
        const fixedNodes = fixRoadmapStructure(combined.roadmap.nodes)
        
        combined.roadmap.nodes = fixedNodes.map((n: RoadmapNode) => ({
            ...n,
            status: n.status || "NOT_STARTED",
            weight: n.weight || 1,
            children: n.children?.map(child => ({
                ...child,
                status: child.status || "NOT_STARTED",
                weight: child.weight || 1
            })) || []
        }))
    }

    // Add this helper function
    function fixRoadmapStructure(nodes: RoadmapNode[]): RoadmapNode[] {
        // Check if structure is already correct
        const hasProperStructure = nodes.every(node => 
            node.children && Array.isArray(node.children) && node.children.length > 0
        )
        
        if (hasProperStructure) {
            return nodes
        }
        
        // Fix flat structure by grouping nodes
        console.log("🔧 Fixing flat roadmap structure...")
        
        const parentNodes: RoadmapNode[] = []
        const orphanNodes: RoadmapNode[] = []
        
        // Separate potential parents from children
        nodes.forEach(node => {
            if (node.children && node.children.length > 0) {
                parentNodes.push(node)
            } else {
                orphanNodes.push(node)
            }
        })
        
        // If we have no proper parents, create them
        if (parentNodes.length === 0) {
            // Group orphan nodes into logical parents
            const groupSize = Math.ceil(orphanNodes.length / 3) // Create ~3 parent groups
            
            for (let i = 0; i < orphanNodes.length; i += groupSize) {
                const childGroup = orphanNodes.slice(i, i + groupSize)
                const parentId = `group${Math.floor(i / groupSize) + 1}`
                
                parentNodes.push({
                    id: parentId,
                    title: `Learning Path ${Math.floor(i / groupSize) + 1}`,
                    status: "NOT_STARTED",
                    weight: childGroup.reduce((sum, child) => sum + (child.weight || 1), 0),
                    children: childGroup
                })
            }
        }
        
        return parentNodes
    }

    return {
        roadmap: combined.roadmap || { title: `${skillName} Roadmap`, nodes: [] },
        questions: combined.questions || [],
    }
}