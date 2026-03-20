"use client"

import React, {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback,
  memo,
  useMemo,
} from "react"
import type { ToolInvocationResult } from "@/lib/progression"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { FaArrowUp } from "react-icons/fa"
import { MarkdownRenderer } from "@/components/learn-page/markdownrenderer"
import { getSkillSpace, NodeStatus, SkillSpaceData, updateNodeStatus } from "@/lib/skillspace"
import { useAuthContext } from "@/context/authcontext"
import { addChatMessage, loadChatMessages } from "@/lib/skillChat"
import {
  ChevronRight,
  CircleCheckBig,
  Globe,
  HelpCircle,
  Loader,
  Orbit,
  Play,
  PlusIcon,
} from "lucide-react"
import { ICONS, COLORS } from "@/lib/constants"
import { shuffleArray } from "@/lib/utils"
import { QuestionCard, QuestionData } from "@/components/learn-page/question-card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { TooltipProvider } from "@radix-ui/react-tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { doc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore"

// ─── Types ───────────────────────────────────────────────────────────────────

/** Simple chat message — no streaming metadata needed */
interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

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

export interface ChatRef {
  clearLocalChat: () => void
}

interface ChatProps {
  skillId?: string
  questions?: QuestionData[]
}

interface ChatBubbleProps {
  message: Message
  nodes: RoadmapNode[]
  isLatestAiResponse: boolean
  activeNodeId: string | null
  setActiveNode: (nodeId: string | null) => void
  sendUserMessage: (text: string) => void
  skillId?: string
}

// ─── Chat Component ───────────────────────────────────────────────────────────

const Chat = forwardRef<ChatRef, ChatProps>(function Chat(
  { skillId, questions = [] },
  ref
) {
  const { user } = useAuthContext()
  const { toast } = useToast()

  const [skill, setSkill] = useState<SkillSpaceData | null>(null)
  const [activeNode, setActiveNode] = useState<string | null>(null)
  const [chatLoading, setChatLoading] = useState(true)
  const [randomCards, setRandomCards] = useState<
    { question: QuestionData; Icon: React.ComponentType; iconColor: string }[]
  >([])

  // Pagination state
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const oldestCursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Ref to always have latest activeNode when sending messages
  const activeNodeRef = useRef<string | null>(null)
  useEffect(() => {
    activeNodeRef.current = activeNode
  }, [activeNode])

  // ─── Chat state (plain fetch — no streaming library needed) ──────────────
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isAiResponding, setIsAiResponding] = useState(false)

  // Expose clearLocalChat to parent via ref
  useImperativeHandle(ref, () => ({
    clearLocalChat() {
      setMessages([])
    },
  }))

  // ─── Skill & Active Node Loading ──────────────────────────────────────────

  const fetchSkillAndActiveNode = useCallback(async () => {
    if (!user?.uid || !skillId) return
    const skillData = await getSkillSpace(user.uid, skillId)
    if (!skillData) return
    setSkill(skillData)

    const stored = skillData.activeNodeId
    if (
      stored &&
      skillData.roadmapJSON?.nodes.some(
        (n: RoadmapNode) =>
          n.id === stored || n.children?.some((c: RoadmapChild) => c.id === stored)
      )
    ) {
      setActiveNode(stored)
    } else if (skillData.roadmapJSON?.nodes?.length) {
      const firstParent = skillData.roadmapJSON.nodes[0]
      const firstIncomplete =
        firstParent.children?.find((c: RoadmapChild) => c.status !== "COMPLETED") ||
        firstParent.children?.[0]
      const childId = firstIncomplete?.id || firstParent.id
      setActiveNode(childId)
      await updateDoc(doc(db, "users", user.uid, "skillspaces", skillId), {
        activeNodeId: childId,
      })
    }
  }, [user?.uid, skillId])

  useEffect(() => {
    fetchSkillAndActiveNode()
  }, [fetchSkillAndActiveNode])

  // ─── Initial Chat Load (paginated) ───────────────────────────────────────

  const loadMessages = useCallback(async () => {
    if (!user?.uid || !skillId) return
    try {
      const { messages: loaded, oldestCursor, hasMore: more } = await loadChatMessages(
        user.uid,
        skillId
      )
      oldestCursorRef.current = oldestCursor

      const aiMessages: Message[] = loaded.map((m, i) => ({
        id: m.id || `init-${i}`,
        role: m.role as "user" | "assistant",
        content: m.content,
      }))
      setMessages(aiMessages)
      setHasMore(more)
    } catch (err) {
      console.error("Error loading chat messages:", err)
    } finally {
      setChatLoading(false)
    }
  }, [user?.uid, skillId])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  // ─── Load More (scroll to top) ────────────────────────────────────────────

  const loadMoreMessages = useCallback(async () => {
    if (!user?.uid || !skillId || !hasMore || isLoadingMore || !oldestCursorRef.current)
      return

    setIsLoadingMore(true)
    try {
      const {
        messages: older,
        oldestCursor: newCursor,
        hasMore: moreLeft,
      } = await loadChatMessages(user.uid, skillId, oldestCursorRef.current)

      oldestCursorRef.current = newCursor
      setHasMore(moreLeft)

      const olderAiMessages: Message[] = older.map((m, i) => ({
        id: m.id || `older-${i}`,
        role: m.role as "user" | "assistant",
        content: m.content,
      }))

      // Prepend older messages to the front of the list
      setMessages((prev) => [...olderAiMessages, ...prev])
    } catch (err) {
      console.error("Error loading more messages:", err)
    } finally {
      setIsLoadingMore(false)
    }
  }, [user?.uid, skillId, hasMore, isLoadingMore, setMessages])

  // ─── Random Question Cards ────────────────────────────────────────────────

  useEffect(() => {
    if (chatLoading) return
    if (messages.length === 0 && questions.length > 0) {
      const shuffledQ = shuffleArray(questions).slice(0, 4)
      const shuffledI = shuffleArray(ICONS).slice(0, 4)
      const shuffledC = shuffleArray(COLORS).slice(0, 4)
      setRandomCards(
        shuffledQ.map((q, i) => ({
          question: q,
          Icon: shuffledI[i],
          iconColor: shuffledC[i],
        }))
      )
    } else {
      setRandomCards([])
    }
  }, [chatLoading, questions, messages.length])

  // ─── Auto-scroll to bottom on new messages ────────────────────────────────
  // Fires when a complete message is added or the typing indicator appears/disappears.
  // No RAF throttle needed — updates are infrequent (once per message, not per token).

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isAiResponding])

  // ─── Textarea auto-height ─────────────────────────────────────────────────

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`
    }
  }

  useEffect(() => {
    adjustTextareaHeight()
  }, [input])

  // ─── Send Message ─────────────────────────────────────────────────────────

  const sendUserMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !user?.uid || !skillId || isAiResponding) return

      // Optimistically add user message to local state
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
      }
      setMessages((prev) => [...prev, userMsg])
      setIsAiResponding(true)

      // Persist user message to Firestore (fire-and-forget)
      addChatMessage(user.uid, skillId, "user", text, activeNodeRef.current ?? undefined).catch(
        (err) => console.error("Failed to persist user message:", err)
      )

      // Build clean message history (only role + content — no streaming metadata)
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      // Build shared request body — used by both parallel fetches
      const skillContext = skill
        ? {
            name: skill.name,
            roadmapContext: skill.roadmapContext,
            roadmapJSON: skill.roadmapJSON,
          }
        : undefined

      const requestBody = JSON.stringify({
        messages: history.slice(-10), // fixed token ceiling
        skillId,
        uid: user.uid,
        activeNodeId: activeNodeRef.current,
        skillContext,
      })

      // ── Fire both fetches simultaneously ──────────────────────────────────
      // chatFetch  → text only (no tools) → drives UI — user waits for this
      // progressFetch → tools only (no text) → updates sidebar in background
      const chatFetch = fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      })
      const progressFetch = fetch("/api/chat/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      })

      try {
        // ── Critical path: wait for text response ──────────────────────────
        const res = await chatFetch

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({ error: "Unknown error" }))
          throw new Error(errBody.error || `HTTP ${res.status}`)
        }

        const data: { content: string } = await res.json()

        // Add AI response to local state
        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: data.content,
        }
        setMessages((prev) => [...prev, aiMsg])

        // Persist AI response to Firestore (fire-and-forget)
        addChatMessage(user.uid, skillId, "assistant", data.content).catch((err) =>
          console.error("Failed to persist AI message:", err)
        )
      } catch (err) {
        console.error("Chat error:", err)
        toast({
          title: "Connection issue",
          description:
            err instanceof Error
              ? err.message
              : "Couldn't reach the AI. Please try again.",
          variant: "destructive",
          duration: 4000,
        })
        // Remove the optimistic user message on error
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
      } finally {
        // ── Unblock input as soon as text arrives — don't wait for tools ──
        setIsAiResponding(false)
      }

      // ── Background path: handle progression tools after UI is unblocked ──
      // Firestore writes happen here (client-side, authenticated) because
      // server-side writes fail under Firestore security rules that require auth.
      progressFetch
        .then((r) => r.json())
        .then(async (progressData: { toolInvocations?: ToolInvocationResult[] }) => {
          for (const invocation of progressData.toolInvocations || []) {
            if (invocation.toolName === "markNodeInProgress") {
              const { nodeId } = invocation.result as { nodeId: string }
              try {
                await updateNodeStatus(user.uid, skillId, nodeId, "IN_PROGRESS")
                setActiveNode(nodeId)
                console.log(`📚 Node "${nodeId}" marked IN_PROGRESS by AI`)
              } catch (err) {
                console.error("Failed to mark node in progress:", err)
              }
            } else if (invocation.toolName === "markNodeComplete") {
              const { nodeId } = invocation.result as { nodeId: string }
              try {
                const result = await updateNodeStatus(user.uid, skillId, nodeId, "COMPLETED")
                toast({
                  title: "Topic marked complete ✓",
                  description: "Great work! Keep it up.",
                  duration: 3000,
                })
                if (result.activeNodeId) setActiveNode(result.activeNodeId)
              } catch (err) {
                console.error("Failed to mark node complete:", err)
              }
            } else if (invocation.toolName === "suggestNextNode") {
              const { nextNodeId } = invocation.result as { nextNodeId: string }
              try {
                await updateNodeStatus(user.uid, skillId, nextNodeId, "IN_PROGRESS")
                setActiveNode(nextNodeId)
              } catch (err) {
                console.error("Failed to start next node:", err)
              }
            }
          }
        })
        .catch((err) => console.error("⚠️ Progress fetch failed (non-critical):", err))
    },
    [user?.uid, skillId, skill, messages, isAiResponding, toast]
  )

  const handleSend = useCallback(async () => {
    if (!input.trim()) return
    const text = input
    setInput("")
    await sendUserMessage(text)
  }, [input, setInput, sendUserMessage])

  const handleQuestionCardClick = useCallback(
    (questionText: string) => {
      sendUserMessage(questionText)
    },
    [sendUserMessage]
  )

  // ─── Derived state (must be before any early returns per Rules of Hooks) ────

  // All messages in state are complete — no partial streaming content to hide.
  // visibleMessages is just an alias; the typing indicator (isAiResponding) is
  // shown separately below the message list.
  const latestAiMessageIndex = useMemo(
    () =>
      messages.reduce(
        (maxIdx: number, msg, idx) =>
          msg.role === "assistant" && idx > maxIdx ? idx : maxIdx,
        -1
      ),
    [messages]
  )

  // ─── Loading state ────────────────────────────────────────────────────────

  if (chatLoading) {
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

  const isChatEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ScrollArea
        className="flex-1 px-4 sm:px-6 pl-3 space-y-2 scroll-smooth w-full"
        ref={scrollRef}
        style={{ height: "100%" }}
      >
        <div className="flex h-full items-center justify-center">
          {isChatEmpty ? (
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
              {/* Load more button */}
              {hasMore && (
                <div className="flex justify-center py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadMoreMessages}
                    disabled={isLoadingMore}
                    className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  >
                    {isLoadingMore ? (
                      <Loader className="h-3 w-3 animate-spin mr-1" />
                    ) : null}
                    Load earlier messages
                  </Button>
                </div>
              )}

              {messages.map((msg, i) => (
                <ChatBubble
                  key={msg.id || i}
                  message={msg}
                  nodes={skill?.roadmapJSON?.nodes || []}
                  isLatestAiResponse={i === latestAiMessageIndex && !isAiResponding}
                  activeNodeId={activeNode}
                  setActiveNode={setActiveNode}
                  sendUserMessage={sendUserMessage}
                  skillId={skillId}
                />
              ))}

              {/* AI skeleton — shown while waiting for the response */}
              {isAiResponding && <AiSkeleton />}
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border border-r bg-white dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700 rounded-3xl p-2 sm:p-2 max-w-[95%] sm:max-w-3xl mx-auto w-full mb-4 sm:mb-8">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
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
              onClick={() => setInput("")}
            >
              <Globe className="h-4 w-4" />
              Search
            </Button>
          </div>
          <div className="flex justify-end gap-2 mb-2 mr-2">
            <Button
              className="rounded-full p-2.5"
              onClick={handleSend}
              disabled={isAiResponding || !input.trim()}
            >
              <FaArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
})

export default Chat

// ─── AiSkeleton ──────────────────────────────────────────────────────────────

function AiSkeleton() {
  return (
    <div className="flex items-start w-full gap-4">
      <Orbit className="flex-shrink-0 mr-2 mt-2 h-8 w-8 rounded-full p-1 overflow-visible border border-neutral-300 dark:border-neutral-600 text-[#6c63ff] dark:text-[#7a83ff]" />
      <p className="mt-2.5 text-sm text-neutral-400 dark:text-neutral-500 animate-pulse">
        Thinking…
      </p>
    </div>
  )
}

// ─── ChatBubble ───────────────────────────────────────────────────────────────

const ChatBubble = memo(function ChatBubble({
  message,
  nodes,
  isLatestAiResponse,
  activeNodeId,
  setActiveNode,
  sendUserMessage,
  skillId,
}: ChatBubbleProps) {
  const { user } = useAuthContext()
  const { toast } = useToast()

  const { role, content } = message

  const handleStatusUpdate = async (newStatus: NodeStatus) => {
    if (!user?.uid || !skillId || !activeNodeId) {
      console.error("Missing required params:", { uid: user?.uid, skillId, activeNodeId })
      return
    }
    try {
      await updateNodeStatus(user.uid, skillId, activeNodeId, newStatus)
      toast({
        title: "Progress updated",
        description: `Topic marked as ${newStatus.toLowerCase().replace("_", " ")}`,
        duration: 3000,
      })

      // Auto-advance to next incomplete node on completion
      if (newStatus === "COMPLETED") {
        const parentNode = nodes.find((n: RoadmapNode) =>
          n.children?.some((c: RoadmapChild) => c.id === activeNodeId)
        )
        if (parentNode && parentNode.children) {
          const nextChild = parentNode.children.find(
            (c: RoadmapChild) => c.status !== "COMPLETED"
          )
          setActiveNode(nextChild?.id || null)
        }
      }
    } catch (err) {
      console.error("Error updating status:", err)
    }
  }

  const handleNodeSelect = async (selectedNodeId: string) => {
    setActiveNode(selectedNodeId)
    if (user?.uid && skillId) {
      await updateDoc(doc(db, "users", user.uid, "skillspaces", skillId), {
        activeNodeId: selectedNodeId,
      })
    }
  }

  if (role === "assistant") {
    return (
      <div className="flex items-start w-full rounded-xl gap-4">
        <Orbit className="flex-shrink-0 mr-2 mt-2 h-8 w-8 rounded-full p-1 overflow-visible border border-neutral-300 dark:border-neutral-600 text-[#6c63ff] dark:text-[#7a83ff]" />
        <div className="flex flex-col mb-4 w-full">
          {/*
           * During streaming: render raw text with whitespace-pre-wrap.
           * Heavy plugins (rehypeMathjax, remarkMath, remarkGfm) run on every token
           * which causes main-thread jank. Switch to full MarkdownRenderer only
           * after the message is complete — same approach used by ChatGPT/Claude.ai.
           */}
          <div className="flex-1 text-neutral-900 dark:text-white text-sm break-words overflow-x-auto">
            <MarkdownRenderer content={content} />
          </div>
          {activeNodeId && isLatestAiResponse && (
            <div className="flex flex-wrap gap-2 sm:gap-4 items-center mt-1 -ml-2 px-2 sm:px-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex gap-1 text-neutral-500 dark:text-neutral-400 hover:dark:text-white p-2 rounded-full hover:bg-muted dark:hover:bg-neutral-700"
                  >
                    <ChevronRight className="h-4 w-4" />
                    {nodes
                      .find(
                        (n: RoadmapNode) =>
                          n.id === activeNodeId ||
                          n.children?.some((c: { id: string }) => c.id === activeNodeId)
                      )
                      ?.children?.find((c: { id: string }) => c.id === activeNodeId)
                      ?.title ||
                      nodes.find((n: RoadmapNode) => n.id === activeNodeId)?.title ||
                      "Select Topic"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="dark:bg-[hsl(0,0%,18%)] max-h-60 overflow-y-auto custom-scrollbar">
                  {nodes.map((parentNode: RoadmapNode, idx: number) => (
                    <React.Fragment key={parentNode.id}>
                      {parentNode.children &&
                        parentNode.children.map((child: RoadmapChild) => (
                          <DropdownMenuItem
                            key={child.id}
                            onClick={() => handleNodeSelect(child.id)}
                            className={
                              child.id === activeNodeId
                                ? "bg-neutral-100 dark:bg-neutral-700"
                                : ""
                            }
                          >
                            {child.title}
                          </DropdownMenuItem>
                        ))}
                      {idx < nodes.length - 1 && (
                        <DropdownMenuSeparator className="my-1" />
                      )}
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
                      <Play className="h-4 w-4" /> Start Learning
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
                      <HelpCircle className="h-4 w-4" /> Need Help
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
  }

  return (
    <div className="flex justify-end">
      <div className="bg-neutral-100 dark:bg-[hsl(0,0%,20%)] text-neutral-900 dark:text-white text-sm p-3 rounded-3xl max-w-xl mb-4 break-words overflow-hidden">
        {content}
      </div>
    </div>
  )
})
