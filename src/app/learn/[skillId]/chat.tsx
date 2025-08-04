"use client"

import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { FaArrowUp } from "react-icons/fa"
import { MarkdownRenderer } from "@/components/learn-page/markdownrenderer"
import { getSkillSpace, NodeStatus, SkillSpaceData } from "@/lib/skillspace"
import { useAuthContext } from "@/context/authcontext"
import { loadChatMessages, addChatMessage } from "@/lib/skillChat"
import { updateNodeStatus } from "@/lib/skillspace"
import { ChevronDown, CircleCheckBig, Globe, Loader, Orbit, PlusIcon, UndoDot } from "lucide-react"
import { ICONS, COLORS } from "@/lib/constants"
import { shuffleArray } from "@/lib/utils"
import { QuestionCard, QuestionData } from "@/components/learn-page/question-card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { TooltipProvider } from "@radix-ui/react-tooltip"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import LoadingBubble from "@/components/learn-page/ai-loading"
import { doc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"

interface RoadmapNode {
  id: string
  title: string
  status: NodeStatus
  children?: RoadmapChild[]
}

interface RoadmapChild {
  id: string
  title: string
  status: NodeStatus
}

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  nodeId?: string
  skillId?: string
}

export interface ChatRef {
  clearLocalChat: () => void
}

interface ChatProps {
  skillId?: string
  questions?: QuestionData[]
}

interface ChatBubbleProps extends ChatMessage {
  nodes: RoadmapNode[]
  isLatestAiResponse: boolean
  setActiveNode: (nodeId: string | null) => void
  sendUserMessage: (text: string) => void
}

const Chat = forwardRef<ChatRef, ChatProps>(function Chat({ skillId, questions = [] }, ref) {
  const { user } = useAuthContext()
  const [skill, setSkill] = useState<SkillSpaceData | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(true)
  const [userInput, setUserInput] = useState("")
  const [activeNode, setActiveNode] = useState<string | null>(null)
  const [isAiResponding, setIsAiResponding] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [randomCards, setRandomCards] = useState<{ question: QuestionData; Icon: React.ComponentType; iconColor: string }[]>([])

  const isChatEmpty = useCallback(() => {
    return messages.length === 0
  }, [messages.length])

  const fetchSkillAndActiveNode = useCallback(async () => {
    if (user?.uid && skillId) {
      const skillData = await getSkillSpace(user.uid, skillId)
      if (skillData) {
        setSkill(skillData)
        const storedActiveNode = skillData.activeNodeId
        if (storedActiveNode && skillData.roadmapJSON?.nodes.some((n: RoadmapNode) => n.id === storedActiveNode || n.children?.some((c: RoadmapChild) => c.id === storedActiveNode))) {
          setActiveNode(storedActiveNode)
          console.log("Fetched stored activeNode:", storedActiveNode)
        } else if (skillData.roadmapJSON?.nodes?.length) {
          const firstParent = skillData.roadmapJSON.nodes[0]
          const firstIncompleteChild = firstParent.children?.find((c: RoadmapChild) => c.status !== "COMPLETED") || firstParent.children?.[0]
          const childId = firstIncompleteChild?.id || firstParent.id
          setActiveNode(childId)
          console.log("Fetched default activeNode:", childId)
          await updateDoc(doc(db, "users", user.uid, "skillspaces", skillId), { activeNodeId: childId })
        }
      }
    }
  }, [user?.uid, skillId])

  useEffect(() => {
    fetchSkillAndActiveNode()
  }, [fetchSkillAndActiveNode])

  useImperativeHandle(ref, () => ({
    clearLocalChat() {
      setMessages([])
    },
  }))

  const fetchSkillSpace = useCallback(async () => {
    if (!user?.uid || !skillId) return
    try {
      const doc = await getSkillSpace(user.uid, skillId)
      if (doc) setSkill(doc)
    } catch (err) {
      console.error("Error fetching skill doc:", err)
    }
  }, [user?.uid, skillId])

  useEffect(() => {
    fetchSkillSpace()
  }, [fetchSkillSpace])

  const loadMessages = useCallback(async () => {
    if (!user?.uid || !skillId) return
    try {
      const msgs = await loadChatMessages(user.uid, skillId)
      const loaded = msgs.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
        nodeId: m.nodeId,
        skillId: m.skillId,
      }))
      setMessages(loaded)
    } catch (err) {
      console.error("Error loading chat messages:", err)
    } finally {
      setChatLoading(false)
    }
  }, [user?.uid, skillId])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  useEffect(() => {
    if (chatLoading) return

    if (isChatEmpty() && questions.length > 0) {
      const shuffledQuestions = shuffleArray(questions).slice(0, 4)
      const iconShuffled = shuffleArray(ICONS).slice(0, 4)
      const colorShuffled = shuffleArray(COLORS).slice(0, 4)
      setRandomCards(shuffledQuestions.map((q, i) => ({
        question: q,
        Icon: iconShuffled[i],
        iconColor: colorShuffled[i],
      })))
    } else {
      setRandomCards([])
    }
  }, [chatLoading, questions, isChatEmpty])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const findNode = (nodes: RoadmapNode[], nodeId: string | null): RoadmapNode | RoadmapChild | null => {
    if (!nodeId) return null
    for (const node of nodes) {
      if (node.id === nodeId) return node
      if (node.children) {
        const child = node.children.find((c: RoadmapChild) => c.id === nodeId)
        if (child) return child
      }
    }
    return null
  }

  // async function sendUserMessage(text: string) {
  //   if (!text.trim() || !skill) return

  //   const userMsg: ChatMessage = { role: "user", content: text, nodeId: activeNode ?? undefined }
  //   setMessages((prev) => [...prev, userMsg])
  //   setIsAiResponding(true)

  //   if (user?.uid && skillId) {
  //     await addChatMessage(user.uid, skillId, "user", text)
  //   }

  //   const activeNodeData = findNode(skill.roadmapJSON?.nodes || [], activeNode)
  //   const systemMessage: ChatMessage = {
  //     role: "assistant",
  //     content: buildSystemPrompt(skill, activeNodeData),
  //     nodeId: activeNode ?? "",
  //     skillId,
  //   }

  //   const finalMessages = [systemMessage, ...messages, userMsg]

  //   try {
  //     const response = await fetch("/api/llm", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ messages: finalMessages }),
  //     })
  //     if (!response.ok) throw new Error(`LLM call failed: ${response.status}`)

  //     const data = await response.json()
  //     if (data.error) throw new Error(data.error)

  //     const aiContent = data.content ?? "No response content."
  //     const aiMsg: ChatMessage = {
  //       role: "assistant",
  //       content: aiContent,
  //       nodeId: activeNode ?? "",
  //       skillId,
  //     }
  //     setMessages((prev) => [...prev, aiMsg])

  //     if (user?.uid && skillId) {
  //       await addChatMessage(user.uid, skillId, "assistant", aiContent)
  //     }
  //   } catch (err: unknown) {
  //     console.error("Error calling LLM:", err)
  //     const errorMessage = err instanceof Error ? err.message : "Unknown error occurred"
  //     const errorMsg: ChatMessage = { role: "assistant", content: `Error: ${errorMessage}` }
  //     setMessages((prev) => [...prev, errorMsg])
  //     if (user?.uid && skillId) {
  //       await addChatMessage(user.uid, skillId, "assistant", errorMsg.content)
  //     }
  //   } finally {
  //     setIsAiResponding(false)
  //   }
  // }

  async function sendUserMessage(text: string) {
  if (!text.trim() || !skill) return

  const userMsg: ChatMessage = { role: "user", content: text, nodeId: activeNode ?? undefined }
  setMessages((prev) => [...prev, userMsg])
  setIsAiResponding(true)

  if (user?.uid && skillId) {
    await addChatMessage(user.uid, skillId, "user", text)
  }

  const activeNodeData = findNode(skill.roadmapJSON?.nodes || [], activeNode)
  const systemMessage: ChatMessage = {
    role: "assistant",
    content: buildSystemPrompt(skill, activeNodeData),
    nodeId: activeNode ?? "",
    skillId,
  }

  const finalMessages = [systemMessage, ...messages, userMsg]

  let response: Response | undefined;
  try {
    response = await fetch("/api/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: finalMessages }),
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }

    const data = await response.json()
    if (data.error) throw new Error(data.error)

    const aiContent = data.content ?? "No response content."
    const aiMsg: ChatMessage = {
      role: "assistant",
      content: aiContent,
      nodeId: activeNode ?? "",
      skillId,
    }

    // Log provider info (but don't show to user unless debugging)
    if (data.switched) {
      console.log(`🔄 AI switched to ${data.provider} for better reliability`)
      // Optionally show a subtle success message
      // toast({ title: "Switched to backup AI for better performance", duration: 2000 })
    } else {
      console.log(`💬 AI response from ${data.provider}`)
    }

    setMessages((prev) => [...prev, aiMsg])

    if (user?.uid && skillId) {
      await addChatMessage(user.uid, skillId, "assistant", aiContent)
    }

  } catch (err: unknown) {
    console.error("Error calling LLM:", err)
    const errorMessage = err instanceof Error ? err.message : "Unknown error occurred"
    
    // Only show error if ALL providers truly failed
    let userFriendlyMessage: string
    
    if (errorMessage.includes("All") && errorMessage.includes("providers failed")) {
      userFriendlyMessage = "I'm experiencing technical difficulties with all AI services right now. Please try again in a few minutes, or contact support if this persists."
    } else if (errorMessage.includes("No LLM providers available")) {
      userFriendlyMessage = "AI services are temporarily offline for maintenance. Please try again shortly."
    } else if (response && response.status >= 500) {
      userFriendlyMessage = "There's a temporary server issue. Please try your question again."
    } else {
      // For other errors, encourage retry without being alarming
      userFriendlyMessage = "I had trouble processing that. Could you please try asking your question again?"
    }
    
    const errorMsg: ChatMessage = { 
      role: "assistant", 
      content: userFriendlyMessage
    }
    
    setMessages((prev) => [...prev, errorMsg])
    if (user?.uid && skillId) {
      await addChatMessage(user.uid, skillId, "assistant", errorMsg.content)
    }
  } finally {
    setIsAiResponding(false)
  }
}

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`
    }
  }

  useEffect(() => {
    adjustTextareaHeight()
  }, [userInput])

  async function handleSend() {
    if (!userInput.trim()) return
    const text = userInput
    setUserInput("")
    await sendUserMessage(text)
  }

  function handleQuestionCardClick(questionText: string) {
    sendUserMessage(questionText)
  }

  if (chatLoading && isChatEmpty()) {
    return (
      <div className="flex items-center justify-center fixed inset-0">
        <div className="text-md text-neutral-500 dark:text-neutral-400">
          <div className="flex gap-2 animate-shiny-text">
            <Loader className="animate-spin" />
            Loading Chat
          </div>
        </div>
      </div>
    )
  }

  const latestAiMessageIndex = messages.reduce((maxIdx, msg, idx) => 
    msg.role === "assistant" && idx > maxIdx ? idx : maxIdx, -1)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ScrollArea className="flex-1 px-4 sm:px-6 pl-3 space-y-2 scroll-smooth w-full" ref={scrollRef} style={{ height: "100%" }}>
        <div className="flex h-full items-center justify-center">
          {isChatEmpty() ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 place-items-center my-10 sm:my-40 w-full max-w-[95%] sm:max-w-3xl mx-auto lg:px-20 overflow-hidden">
              {randomCards.map(({ question, Icon, iconColor }, idx) => (
                <QuestionCard
                  key={question.id || idx}
                  question={question}
                  Icon={Icon}
                  iconColorClass={iconColor}
                  onQuestionClick={handleQuestionCardClick}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2 w-full max-w-[95%] sm:max-w-3xl mx-auto py-4">
              {messages.map((msg, i) => (
                <ChatBubble
                  key={i}
                  role={msg.role}
                  content={msg.content}
                  nodeId={activeNode ?? undefined}
                  skillId={skillId}
                  nodes={skill?.roadmapJSON?.nodes || []}
                  isLatestAiResponse={i === latestAiMessageIndex}
                  setActiveNode={setActiveNode}
                  sendUserMessage={sendUserMessage}
                />
              ))}
              {isAiResponding && <LoadingBubble />}
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border border-r bg-white dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700 rounded-3xl p-2 sm:p-2 max-w-[95%] sm:max-w-3xl mx-auto w-full mb-4 sm:mb-8">
        <Textarea
          ref={textareaRef}
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Type your question..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          className="bg-white dark:bg-[hsl(0,0%,18%)] resize-none min-h-[2.5rem] max-h-32 w-full rounded-xl mb-2 px-2 sm:px-4 custom-scrollbar"
        />
        <div className="flex justify-between place-items-center">
          <div className="flex justify-start gap-2 mb-2 ml-2">
            <Button
              variant="outline"
              className="rounded-full p-2.5 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[hsl(0,0%,18%)] hover:bg-gray-100 dark:hover:bg-neutral-800"
            >
              <PlusIcon className="h-4 w-4" />
              Add File
            </Button>
            <Button
              variant="outline"
              className="rounded-full p-2.5 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[hsl(0,0%,18%)] hover:bg-gray-100 dark:hover:bg-neutral-800"
              onClick={() => setUserInput("")}
            >
              <Globe className="h-4 w-4" />
              Search
            </Button>
          </div>
          <div className="flex justify-end gap-2 mb-2 mr-2">
            <Button className="rounded-full p-2.5" onClick={handleSend}>
              <FaArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
})

export default Chat

function buildSystemPrompt(skill: SkillSpaceData | null, activeNode: RoadmapNode | RoadmapChild | null) {
  if (!skill) {
    return `You are a fun, engaging tutor. The skill is not fully loaded yet, so keep it generic. Add slight humor but remain helpful.`
  }

  const level = skill.roadmapContext?.level || "Unknown"
  const goals = skill.roadmapContext?.goals || "No specific goals"
  const priorKnowledge = skill.roadmapContext?.priorKnowledge || "Not mentioned"
  const skillName = skill.name || "Unnamed Skill"
  const roadmapJSON = JSON.stringify(skill.roadmapJSON || { title: "", nodes: [] })
  const activeNodeTitle = activeNode?.title || "unknown"
  const activeNodeStatus = activeNode?.status || "unknown"

  return `
    You are a fun, enthusiastic, motivating, engaging tutor.
    Your domain is ${skillName}.
    The user's current level is ${level}.
    Their goals: ${goals}.
    They have prior knowledge: ${priorKnowledge}.

    We have a roadmap in JSON:
    ${roadmapJSON}

    Current node: "${activeNodeTitle}" (ID: ${skill.activeNodeId || "unknown"}, Status: ${activeNodeStatus}).
    Focus on guiding based on this node, suggesting next steps if it's NOT_STARTED or IN_PROGRESS.
    Provide detailed explanations and examples relevant to "${activeNodeTitle}" when asked.
    Keep it systematic, humorous, and encouraging, staying within the roadmap.
    If the user asks about an unrelated topic, politely redirect to "${activeNodeTitle}" or suggest using the dropdown to switch nodes.
  `
}

function ChatBubble({ role, content, nodeId, skillId, nodes, isLatestAiResponse, setActiveNode, sendUserMessage }: ChatBubbleProps) {
  const { user } = useAuthContext()
  const { toast } = useToast()

  const handleStatusUpdate = async (newStatus: NodeStatus) => {
    if (!user?.uid || !skillId || !nodeId) {
      console.error("Missing required params:", { uid: user?.uid, skillId, nodeId })
      return
    }
    try {
      console.log("Updating status:", { uid: user.uid, skillId, nodeId, newStatus })
      await updateNodeStatus(user.uid, skillId, nodeId, newStatus)
      toast({
        title: "Progress updated",
        description: `Node ${nodeId} marked as ${newStatus.toLowerCase().replace("_", " ")}`,
        duration: 3000,
      })

      const parentNode = nodes.find((n: RoadmapNode) => n.children?.some((c: RoadmapChild) => c.id === nodeId))
      if (parentNode && newStatus === "COMPLETED") {
        const nextChild = parentNode.children?.find((c: RoadmapChild) => c.status !== "COMPLETED")
        setActiveNode(nextChild?.id || null)
      }
    } catch (err) {
      console.error("Error updating status:", err)
    }
  }

  const handleNodeSelect = async (selectedNodeId: string) => {
    setActiveNode(selectedNodeId)
    if (user?.uid && skillId) {
      await updateDoc(doc(db, "users", user.uid, "skillspaces", skillId), { activeNodeId: selectedNodeId })
    }
  }

  if (role === "assistant") {
    return (
      <div className="flex items-start w-full rounded-xl gap-4">
        <Orbit className="flex-shrink-0 mr-2 mt-2 h-8 w-8 rounded-full p-1 overflow-visible border border-neutral-300 dark:border-neutral-600 text-[#6c63ff] dark:text-[#7a83ff]" />
        <div className="flex flex-col mb-4 w-full">
          <div className="flex-1 text-neutral-900 dark:text-white text-sm break-words overflow-x-auto">
            <MarkdownRenderer content={content} />
          </div>
          {nodeId && isLatestAiResponse && (
            <div className="flex flex-wrap gap-2 sm:gap-4 items-center mt-1 -ml-2 px-2 sm:px-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex gap-1 text-neutral-500 dark:text-neutral-400 hover:dark:text-white p-2 rounded-full hover:bg-muted dark:hover:bg-neutral-700">
                    <ChevronDown className="h-4 w-4" />
                    {nodeId}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="dark:bg-[hsl(0,0%,18%)] max-h-60 overflow-y-auto custom-scrollbar">
                  {nodes.map((parentNode: RoadmapNode, idx: number) => (
                    <React.Fragment key={parentNode.id}>
                      {parentNode.children && parentNode.children.map((child: RoadmapChild) => (
                        <DropdownMenuItem
                          key={child.id}
                          onClick={() => handleNodeSelect(child.id)}
                          className={child.id === nodeId ? "bg-neutral-100 dark:bg-neutral-700" : ""}
                        >
                          {child.title}
                        </DropdownMenuItem>
                      ))}
                      {idx < nodes.length - 1 && <DropdownMenuSeparator className="my-1" />}
                    </React.Fragment>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="flex text-neutral-500 hover:bg-muted hover:text-black p-2 rounded-full dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-700 text-xs sm:text-sm"
                      variant="ghost"
                      onClick={() => handleStatusUpdate("COMPLETED")}
                    >
                      <CircleCheckBig className="h-4 w-4" /> Complete
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-white font-semibold bg-neutral-900">
                    Mark as understood
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="flex text-neutral-500 hover:bg-muted hover:text-black p-2 rounded-full dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-700 text-xs sm:text-sm"
                      variant="ghost"
                      onClick={() => handleStatusUpdate("IN_PROGRESS")}
                    >
                      <Loader className="h-4 w-4" /> Start Learning
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-white font-semibold bg-neutral-900">
                    Begin this topic
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="flex text-neutral-500 hover:bg-muted hover:text-black p-2 rounded-full dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-700 text-xs sm:text-sm"
                      variant="ghost"
                      onClick={() => sendUserMessage("Explain this more")}
                    >
                      <UndoDot className="h-4 w-4" /> Need Help
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-white font-semibold bg-neutral-900">
                    Ask for more explanation
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </div>
    )
  } else {
    return (
      <div className="flex justify-end">
        <div className="bg-neutral-100 dark:bg-[hsl(0,0%,20%)] text-neutral-900 dark:text-white text-sm p-3 rounded-3xl max-w-xl mb-4 break-words overflow-hidden">
          {content}
        </div>
      </div>
    )
  }
}