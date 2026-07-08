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
import { useChat } from "ai/react"
import type { Message } from "ai"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { FaArrowUp } from "react-icons/fa"
import { MarkdownRenderer } from "@/components/learn-page/markdownrenderer"
import { ArtifactPanel } from "@/components/artifacts"
import type { ArtifactPayload } from "@/lib/tools/artifacts"
import { getSkillSpace, NodeStatus, SkillSpaceData, updateNodeStatus } from "@/lib/skillspace"
import { useAuthContext } from "@/context/authcontext"
import { addChatMessage, loadChatMessages, type ChatMessageData } from "@/lib/skillChat"
import type { ChatSkillContext } from "@/lib/prompts"
import { useSpeechInput } from "@/hooks/useSpeechInput"
import { ChatActionsProvider } from "@/context/chatActions"
import { extractExercises, exerciseKey } from "@/lib/extractArtifacts"
import { getAuthHeaders } from "@/lib/clientAuth"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import {
  ChevronRight,
  CircleCheckBig,
  HelpCircle,
  ImageIcon,
  Loader,
  Mic,
  MicOff,
  Orbit,
  Play,
  Square,
  X,
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
  /** True while useChat is still receiving tokens for this specific message. */
  isStreaming?: boolean
  /** Content of the previous assistant message — used to suppress duplicate
   *  exercise sandboxes when the tutor echoes a spec it already rendered. */
  prevAssistantContent?: string
  activeNodeId: string | null
  setActiveNode: (nodeId: string | null) => void
  sendUserMessage: (text: string) => void
  skillId?: string
}

// ─── Firestore → UI message reconstruction ────────────────────────────────────

/**
 * Rebuilds a useChat Message from a persisted Firestore record. Stored artifacts
 * are restored as renderArtifact tool invocations so ArtifactPanel re-renders
 * them after a page reload (they live outside message.content).
 */
function firestoreMessageToUIMessage(
  m: ChatMessageData,
  fallbackId: string
): Message {
  const msg: Message = {
    id: m.id || fallbackId,
    role: m.role as "user" | "assistant",
    content: m.content,
  }
  if (m.artifacts && m.artifacts.length) {
    msg.toolInvocations = m.artifacts.map((a, j) => ({
      state: "result" as const,
      toolCallId: a.artifactId || `${fallbackId}-art-${j}`,
      toolName: "renderArtifact",
      args: {},
      result: a,
    }))
  }
  // Restore uploaded images so the user bubble shows them again after reload.
  if (m.attachments && m.attachments.length) {
    msg.experimental_attachments = m.attachments.map((a) => ({
      url: a.url,
      contentType: a.contentType,
      name: a.name,
    }))
  }
  return msg
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
  const [input, setInput] = useState("")
  // Attached image (base64 data URL) for multimodal messages
  const [attachedImage, setAttachedImage] = useState<string | null>(null)
  const [randomCards, setRandomCards] = useState<
    { question: QuestionData; Icon: React.ComponentType; iconColor: string }[]
  >([])

  // Pagination state
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const oldestCursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Tracks the latest messages array so onFinish can read it without stale closures
  const messagesRef = useRef<Message[]>([])

  // Voice input — transcript is inserted into the textarea when speech ends
  const { isListening, start: startListening, stop: stopListening, isSupported: speechSupported } =
    useSpeechInput((transcript) => {
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript).trim())
    })

  // Refs for latest values — avoids stale closures in callbacks
  const activeNodeRef = useRef<string | null>(null)
  useEffect(() => {
    activeNodeRef.current = activeNode
  }, [activeNode])

  const skillContextRef = useRef<ChatSkillContext | undefined>(undefined)
  useEffect(() => {
    if (skill) {
      skillContextRef.current = {
        name: skill.name,
        roadmapContext: skill.roadmapContext,
        roadmapJSON: skill.roadmapJSON,
      }
    }
  }, [skill])

  // ─── onFinish ref — always current, avoids stale closure in useChat ──────
  // Assigned fresh on every render so it always captures the latest state.
  const onFinishRef = useRef<(msg: Message) => void>(() => {})
  onFinishRef.current = (message: Message) => {
    if (!user?.uid || !skillId) return

    // 1. Persist AI response to Firestore (fire-and-forget), including any
    //    renderArtifact tool outputs. Artifacts live in toolInvocations (NOT in
    //    message.content), so without this they'd vanish on reload — leaving
    //    only the text. We extract their payloads and store them on the message.
    const artifacts = (message.toolInvocations ?? [])
      .filter(
        (inv) => inv.state === "result" && inv.toolName === "renderArtifact"
      )
      .map((inv) => (inv as typeof inv & { result: unknown }).result)
      .filter(
        (r): r is ArtifactPayload =>
          !!r && typeof r === "object" && "type" in r && "content" in r
      )

    if (message.content || artifacts.length) {
      addChatMessage(
        user.uid,
        skillId,
        "assistant",
        message.content,
        undefined,
        artifacts
      ).catch((err) => console.error("Failed to persist AI message:", err))
    }

    // 2. Background progression tracking — kept separate from the streaming
    //    endpoint so progression tool calls never block or delay the text stream.
    //    Uses the same /api/chat/progress route that existed before the migration.
    const currentActiveNodeId = activeNodeRef.current
    if (!currentActiveNodeId) return

    const uid = user.uid
    const currentSkillContext = skillContextRef.current

    // Build a text-only message history (no image parts) for the progress route.
    // Use messagesRef for the latest snapshot; append the just-finished response
    // if it isn't already the last entry.
    const history = messagesRef.current.map((m) => ({
      role: m.role as "user" | "assistant",
      content: typeof m.content === "string" ? m.content : "",
    }))
    const lastEntry = history[history.length - 1]
    if (!lastEntry || lastEntry.role !== "assistant" || lastEntry.content !== message.content) {
      history.push({ role: "assistant" as const, content: message.content })
    }

    getAuthHeaders()
      .then((authHeaders) =>
        fetch("/api/chat/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({
            messages: history,
            skillId,
            uid,
            activeNodeId: currentActiveNodeId,
            skillContext: currentSkillContext,
          }),
        })
      )
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json() as {
          toolInvocations: Array<{ toolName: string; result: Record<string, unknown> }>
        }
        for (const inv of data.toolInvocations ?? []) {
          const result = inv.result
          if (inv.toolName === "markNodeInProgress") {
            const nodeId = result.nodeId as string
            updateNodeStatus(uid, skillId, nodeId, "IN_PROGRESS")
              .then(() => {
                setActiveNode(nodeId)
                console.log(`📚 Node "${nodeId}" marked IN_PROGRESS by AI`)
              })
              .catch((err) => console.error("Failed to mark node in progress:", err))
          } else if (inv.toolName === "markNodeComplete") {
            const nodeId = result.nodeId as string
            updateNodeStatus(uid, skillId, nodeId, "COMPLETED")
              .then((res) => {
                toast({ title: "Topic marked complete ✓", description: "Great work! Keep it up.", duration: 3000 })
                if (res.activeNodeId) setActiveNode(res.activeNodeId)
              })
              .catch((err) => console.error("Failed to mark node complete:", err))
          } else if (inv.toolName === "suggestNextNode") {
            const nextNodeId = result.nextNodeId as string
            updateNodeStatus(uid, skillId, nextNodeId, "IN_PROGRESS")
              .then(() => setActiveNode(nextNodeId))
              .catch((err) => console.error("Failed to start next node:", err))
          }
        }
      })
      .catch((err) => console.error("Progression tracking failed:", err))
  }

  // ─── Streaming chat via useChat ───────────────────────────────────────────
  const { messages, append, setMessages, isLoading, stop } = useChat({
    api: "/api/chat/stream",
    // CRITICAL for streaming performance. Without throttling, every single
    // token from the stream triggers a synchronous React re-render + full
    // markdown re-parse. A 600-token response in ~1.5s = ~400 renders/sec,
    // which the main thread cannot keep up with — the window freezes and then
    // paints the whole response at once. Throttling coalesces updates to a
    // max of one render per 50ms (20/sec), which is smooth and imperceptible.
    experimental_throttle: 50,
    onFinish: (msg) => onFinishRef.current(msg),
    onError: (err) => {
      // Provider errors can be huge JSON walls (quota messages, stack traces).
      // Show a clean one-liner; full detail is in the server logs.
      const raw = err.message || ""
      const friendly = /quota|rate limit|429/i.test(raw)
        ? "The AI service is briefly rate-limited. Please try again in a moment."
        : /unauthorized|authentication|\b401\b|\b403\b/i.test(raw)
        ? "Your session expired. Please refresh the page and sign in again."
        : raw.split("\n")[0].slice(0, 140) || "Couldn't reach the AI. Please try again."
      toast({
        title: "Connection issue",
        description: friendly,
        variant: "destructive",
        duration: 4000,
      })
    },
  })

  // Keep messagesRef in sync on every render so the onFinish callback always
  // has the latest snapshot (assigned here, outside any effect, so it's always
  // current by the time the callback fires after streaming ends).
  messagesRef.current = messages

  // isLoading mirrored into a ref so callbacks (sendUserMessage) can read it
  // without depending on it — keeps their identity stable across streaming.
  const isLoadingRef = useRef(false)
  isLoadingRef.current = isLoading

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

      const chatMessages: Message[] = loaded.map((m, i) =>
        firestoreMessageToUIMessage(m, `init-${i}`)
      )
      setMessages(chatMessages)
      setHasMore(more)
    } catch (err) {
      console.error("Error loading chat messages:", err)
    } finally {
      setChatLoading(false)
    }
  }, [user?.uid, skillId, setMessages])

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

      const olderMessages: Message[] = older.map((m, i) =>
        firestoreMessageToUIMessage(m, `older-${i}`)
      )

      setMessages((prev) => [...olderMessages, ...prev])
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
  // The scrollable element is the Radix Viewport, NOT the ScrollArea Root.
  // The Root has overflow:hidden — setting scrollTop on it does nothing.

  // Tracks whether the user is "pinned" to the bottom. Starts true; flips to
  // false only when the user actively scrolls up. Content growth alone never
  // fires a scroll event, so streaming can't wrongly un-pin.
  const isPinnedToBottomRef = useRef(true)

  const getViewport = useCallback((): HTMLElement | null => {
    return (
      scrollRef.current?.querySelector<HTMLElement>(
        "[data-radix-scroll-area-viewport]"
      ) ?? null
    )
  }, [])

  // Attach a scroll listener once the chat content is mounted, to record
  // whether the user has scrolled away from the bottom.
  useEffect(() => {
    if (chatLoading) return
    const viewport = getViewport()
    if (!viewport) return

    const handleScroll = () => {
      const distanceFromBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
      isPinnedToBottomRef.current = distanceFromBottom < 80
    }

    viewport.addEventListener("scroll", handleScroll, { passive: true })
    return () => viewport.removeEventListener("scroll", handleScroll)
  }, [chatLoading, getViewport])

  // Scroll to bottom when messages change — but only if the user is pinned.
  useEffect(() => {
    if (!isPinnedToBottomRef.current) return
    const viewport = getViewport()
    if (!viewport) return
    // rAF batches the scroll with the browser paint (no synchronous reflow).
    requestAnimationFrame(() => {
      viewport.scrollTop = viewport.scrollHeight
    })
  }, [messages, isLoading, getViewport])

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
    async (text: string, imageDataUrl?: string) => {
      // Allow image-only messages (text may be empty when an image is attached).
      // isLoading is read via ref so this callback keeps a stable identity —
      // otherwise every stream start/stop re-rendered every memoized ChatBubble.
      if ((!text.trim() && !imageDataUrl) || !user?.uid || !skillId || isLoadingRef.current)
        return

      // A new turn always re-pins to the bottom so the user follows their
      // message and the incoming response.
      isPinnedToBottomRef.current = true

      // Build attachments from the image (if any). experimental_attachments is
      // the AI SDK's native mechanism: it (1) stays on the message so the bubble
      // can render it, and (2) is serialized into the request body so the server
      // receives it — no separate body channel needed.
      const attachments = imageDataUrl
        ? [
            {
              url: imageDataUrl,
              contentType: imageDataUrl.match(/^data:([^;]+);/)?.[1] || "image/jpeg",
              name: "image",
            },
          ]
        : undefined

      // For a vision model an empty prompt is unhelpful — give it a default.
      const messageText = text.trim() || (imageDataUrl ? "What's in this image?" : "")

      // Persist user message (text + image) to Firestore (fire-and-forget)
      addChatMessage(
        user.uid,
        skillId,
        "user",
        messageText,
        activeNodeRef.current ?? undefined,
        undefined,
        attachments
      ).catch((err) => console.error("Failed to persist user message:", err))

      const body = {
        skillId,
        uid: user.uid,
        activeNodeId: activeNodeRef.current,
        skillContext: skillContextRef.current,
      }

      // Fresh ID token per request — the server verifies it (serverAuth.ts).
      const authHeaders = await getAuthHeaders()

      await append(
        {
          role: "user",
          content: messageText,
          ...(attachments ? { experimental_attachments: attachments } : {}),
        },
        { body, headers: authHeaders }
      )
    },
    [user?.uid, skillId, append]
  )

  const handleSend = useCallback(async () => {
    // Allow sending when there's text OR an attached image.
    if (!input.trim() && !attachedImage) return
    const text = input
    const image = attachedImage
    setInput("")
    setAttachedImage(null)
    await sendUserMessage(text, image ?? undefined)
  }, [input, attachedImage, sendUserMessage])

  const handleQuestionCardClick = useCallback(
    (questionText: string) => {
      sendUserMessage(questionText)
    },
    [sendUserMessage]
  )

  // ─── Image attachment ─────────────────────────────────────────────────────

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !file.type.startsWith("image/")) return

      // Resize client-side to stay under Vercel's 4.5MB request limit
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)

      img.onload = () => {
        const MAX_PX = 1024
        const scale = Math.min(1, MAX_PX / Math.max(img.width, img.height))
        const canvas = document.createElement("canvas")
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext("2d")
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85)
        setAttachedImage(dataUrl)
        URL.revokeObjectURL(objectUrl)
      }

      img.src = objectUrl
      // Reset input so the same file can be re-selected
      e.target.value = ""
    },
    []
  )

  // ─── Derived state ────────────────────────────────────────────────────────

  const latestAiMessageIndex = useMemo(
    () =>
      messages.reduce(
        (maxIdx: number, msg, idx) =>
          msg.role === "assistant" && idx > maxIdx ? idx : maxIdx,
        -1
      ),
    [messages]
  )

  // Exposed to artifacts (e.g. the code-exercise "Review" button) so they can
  // send the learner's work back into the chat for the tutor to assess.
  const chatActions = useMemo(() => ({ sendUserMessage }), [sendUserMessage])

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
    <ChatActionsProvider value={chatActions}>
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

              {messages.map((msg, i) => {
                // Previous assistant message's text — lets the bubble suppress
                // duplicate exercise sandboxes when the tutor echoes a spec.
                let prevAssistant: string | undefined
                if (msg.role === "assistant") {
                  for (let j = i - 1; j >= 0; j--) {
                    if (messages[j].role === "assistant") {
                      const c = messages[j].content
                      prevAssistant = typeof c === "string" ? c : undefined
                      break
                    }
                  }
                }
                return (
                  <ErrorBoundary key={msg.id || i} label="message">
                    <ChatBubble
                      message={msg}
                      nodes={skill?.roadmapJSON?.nodes || []}
                      isLatestAiResponse={i === latestAiMessageIndex && !isLoading}
                      isStreaming={isLoading && i === messages.length - 1 && msg.role === "assistant"}
                      prevAssistantContent={prevAssistant}
                      activeNodeId={activeNode}
                      setActiveNode={setActiveNode}
                      sendUserMessage={sendUserMessage}
                      skillId={skillId}
                    />
                  </ErrorBoundary>
                )
              })}

              {/* Typing indicator — shown only while waiting for the first token.
                  Once useChat adds the streaming assistant message to the list
                  the skeleton is replaced by the live streaming text. */}
              {isLoading && messages[messages.length - 1]?.role !== "assistant" && <AiSkeleton />}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="border border-r bg-white dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700 rounded-3xl p-2 sm:p-2 max-w-[95%] sm:max-w-3xl mx-auto w-full mb-4 sm:mb-8">
        {/* Image preview strip */}
        {attachedImage && (
          <div className="flex items-center gap-2 mb-2 px-2">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachedImage}
                alt="Attached"
                className="h-14 w-14 object-cover rounded-lg border border-neutral-200 dark:border-neutral-700"
              />
              <button
                onClick={() => setAttachedImage(null)}
                className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-neutral-700 text-white flex items-center justify-center hover:bg-neutral-900"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
            <span className="text-xs text-neutral-400">Image attached</span>
          </div>
        )}

        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isListening ? "Listening…" : "Type your question..."}
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
            {/* Image upload button */}
            <Button
              variant="outline"
              className="rounded-full p-2.5 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[hsl(0,0%,18%)] hover:bg-gray-100 dark:hover:bg-neutral-800"
              onClick={() => fileInputRef.current?.click()}
              title="Attach an image"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>

            {/* Voice input button — hidden when SpeechRecognition is unavailable */}
            {speechSupported && (
              <Button
                variant="outline"
                className={`rounded-full p-2.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[hsl(0,0%,18%)] hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors ${
                  isListening
                    ? "text-red-500 dark:text-red-400 hover:text-red-600 border-red-300 dark:border-red-700 animate-pulse"
                    : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                }`}
                onClick={isListening ? stopListening : startListening}
                title={isListening ? "Stop listening" : "Speak your question"}
              >
                {isListening ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
          <div className="flex justify-end gap-2 mb-2 mr-2">
            {isLoading ? (
              // Mid-stream the send button becomes a stop button — long or
              // off-track responses shouldn't be unkillable.
              <Button
                className="rounded-full p-2.5"
                variant="destructive"
                onClick={() => stop()}
                aria-label="Stop generating"
                title="Stop generating"
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                className="rounded-full p-2.5"
                onClick={handleSend}
                disabled={!input.trim() && !attachedImage}
                aria-label="Send message"
              >
                <FaArrowUp className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
    </ChatActionsProvider>
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
  isStreaming,
  prevAssistantContent,
  activeNodeId,
  setActiveNode,
  sendUserMessage,
  skillId,
}: ChatBubbleProps) {
  const { user } = useAuthContext()
  const { toast } = useToast()

  const { role, content } = message

  // Robustly pull any code-exercise spec out of the assistant text by shape (not
  // by fence tag) so it always renders as a sandbox, and the raw JSON is hidden.
  // Specs the PREVIOUS assistant turn already rendered are suppressed — the
  // tutor sometimes echoes the exercise back while reviewing a solution, which
  // would otherwise produce a duplicate sandbox.
  const assistantText = typeof content === "string" ? content : ""
  const { cleaned, exercises, preparing } = useMemo(() => {
    if (role !== "assistant")
      return { cleaned: assistantText, exercises: [] as string[], preparing: false }
    const result = extractExercises(assistantText, !!isStreaming)
    if (result.exercises.length === 0) return result

    const seen = new Set<string>(
      prevAssistantContent
        ? extractExercises(prevAssistantContent, false).exercises.map(exerciseKey)
        : []
    )
    const novel: string[] = []
    for (const ex of result.exercises) {
      const key = exerciseKey(ex)
      if (seen.has(key)) continue // duplicate (echo or repeat within message)
      seen.add(key)
      novel.push(ex)
    }
    return { ...result, exercises: novel }
  }, [role, assistantText, isStreaming, prevAssistantContent])

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
          <div className="flex-1 text-neutral-900 dark:text-white text-sm break-words overflow-x-auto">
            <MarkdownRenderer content={cleaned} isStreaming={isStreaming} />
          </div>

          {/* While an exercise is still streaming, show a placeholder (raw JSON hidden) */}
          {preparing && (
            <div className="my-3 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-600 p-4 text-center">
              <span className="text-xs text-neutral-500 dark:text-neutral-400 animate-pulse">
                Preparing exercise…
              </span>
            </div>
          )}

          {/* Exercises extracted from the message text by shape (tag-independent) */}
          {exercises.map((ex, i) => (
            <ArtifactPanel
              key={`exercise-${i}`}
              payload={{
                artifactId: `exercise-${message.id ?? "m"}-${i}`,
                type: "code-exercise",
                title: "Exercise",
                content: ex,
              }}
            />
          ))}

          {/* Render artifacts emitted by the LLM via the renderArtifact tool */}
          {message.toolInvocations
            ?.filter(
              (t) => t.toolName === "renderArtifact" && t.state === "result"
            )
            .map((t) => {
              // Type is narrowed by the filter above; cast to access .result
              const inv = t as typeof t & { result: unknown }
              return (
                <ArtifactPanel
                  key={t.toolCallId}
                  payload={inv.result as ArtifactPayload}
                />
              )
            })}
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

  // User message — images travel in experimental_attachments (set on send and
  // restored from Firestore on reload), text is the plain string content.
  const imageAttachments = (message.experimental_attachments ?? []).filter(
    (a) => a.contentType?.startsWith("image/")
  )
  const textContent = typeof content === "string" ? content : ""

  // Render user text as markdown so pasted/sent code (e.g. exercise Review
  // messages with ```fences) displays as proper code blocks, not raw backticks.
  return (
    <div className="flex justify-end">
      {/* Heading sizes are scaled down inside the bubble — a user typing "# hi"
          shouldn't get a page-title-sized message. */}
      <div className="bg-neutral-100 dark:bg-[hsl(0,0%,20%)] text-neutral-900 dark:text-white text-sm px-4 py-1 rounded-3xl max-w-xl mb-4 break-words overflow-hidden [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_h1]:mt-2 [&_h2]:mt-2 [&_h1]:mb-1 [&_h2]:mb-1">
        {imageAttachments.map((a, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={a.url.slice(0, 32) + i}
            src={a.url}
            alt={a.name || "Attached image"}
            className="rounded-xl my-2 max-h-48 object-contain"
          />
        ))}
        <MarkdownRenderer content={textContent} />
      </div>
    </div>
  )
})
