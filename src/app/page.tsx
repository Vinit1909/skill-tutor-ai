"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthContext } from "@/context/authcontext"
import {
  BookOpen,
  ChevronRight,
  Lock,
  Orbit,
  Origami,
  LogIn,
  UserPlus,
} from "lucide-react"
import { FaBarsProgress } from "react-icons/fa6";
import { RiRoadMapFill, RiLightbulbFlashFill  } from "react-icons/ri";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { MarkdownRenderer } from "@/components/learn-page/markdownrenderer"
import { QuestionCard, QuestionData } from "@/components/learn-page/question-card"
import LoadingBubble from "@/components/learn-page/ai-loading"
import DarkModeToggle from "@/components/dark-mode-toggle"
import UserProfileBadge from "@/components/user-profile-badge"
import AppHeader from "@/components/app-header"
import { FaArrowUp } from "react-icons/fa"
import { Menu, Dices } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { useIsMobile } from "@/hooks/use-mobile"
import { shuffleArray } from "@/lib/utils"
import { COLORS, ICONS } from "@/lib/constants"
import { InteractiveHoverButton } from "@/components/magicui/hover-button"
import { Highlighter } from "@/components/magicui/highlighter"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { CheckCircle, Play, HelpCircle } from "lucide-react"
import Link from "next/link"

// Mock data for the interactive demo
const mockRoadmapData = {
  title: "React Development",
  nodes: [
    {
      id: "fundamentals",
      title: "React Fundamentals",
      status: "COMPLETED",
      children: [
        { id: "jsx", title: "JSX Syntax", status: "COMPLETED" },
        { id: "components", title: "Components", status: "COMPLETED" },
        { id: "props", title: "Props", status: "IN_PROGRESS" }
      ]
    },
    {
      id: "hooks",
      title: "React Hooks",
      status: "IN_PROGRESS",
      children: [
        { id: "useState", title: "useState Hook", status: "IN_PROGRESS" },
        { id: "useEffect", title: "useEffect Hook", status: "NOT_STARTED" }
      ]
    }
  ]
}

const mockInitialMessage = "Welcome to your React learning journey! I'm here to help you master React step by step. I can see you're currently working on **Props** in the fundamentals section. \n\nWould you like to:\n- Review what you've learned about JSX and Components\n- Dive deeper into how Props work\n- Practice with some interactive examples\n\nWhat sounds most helpful right now?"

const suggestedQuestions = [
  { id: "1", question: "How do props work in React?", shortDesc: "Understanding component data flow" },
  { id: "2", question: "Show me JSX examples", shortDesc: "Practical JSX syntax" },
  { id: "3", question: "Props vs state", shortDesc: "Core React concepts" },
  { id: "4", question: "Help me practice components", shortDesc: "Hands-on component building" }
]

interface RoadmapChild {
  id: string
  title: string
  status: "COMPLETED" | "IN_PROGRESS" | "NOT_STARTED"
}

interface RoadmapParent {
  id: string
  title: string
  status?: string
  children?: RoadmapChild[]
}

interface DemoRoadmap {
  title: string
  nodes: RoadmapParent[]
}

interface RoadmapNodeProps {
  node: RoadmapParent
  index: number
}

function RoadmapStep({ node, index }: RoadmapNodeProps) {
  const [isOpen, setIsOpen] = useState(index === 0)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED": return "bg-green-100 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400"
      case "IN_PROGRESS": return "bg-yellow-100 text-yellow-600 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400"
      default: return "bg-neutral-100 text-neutral-600 hover:bg-neutral-100 dark:bg-neutral-700/20 dark:text-neutral-400"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED": return "✓"
      case "IN_PROGRESS": return "○"
      default: return "·"
    }
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-3 h-auto">
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">{index + 1}</div>
            <div className="text-left">
              <div className="font-medium">{node.title}</div>
              <Badge className={`text-xs mt-1 ${getStatusColor(node.status || "")}`}>
                {(node.status || "").replace?.("_", " ").toLowerCase()}
              </Badge>
            </div>
          </div>
          <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-6 space-y-1">
        {node.children?.map((child: RoadmapChild) => (
          <div key={child.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
            <span className="text-sm">{child.title}</span>
            <Badge className={`text-xs ${getStatusColor(child.status)}`}>
              {getStatusIcon(child.status)}
            </Badge>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

export default function LandingPage() {
  const router = useRouter()
  const { user, loading } = useAuthContext()
  const isMobile = useIsMobile()
  const [demoInput, setDemoInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [randomCards, setRandomCards] = useState<{ question: QuestionData; Icon: React.ComponentType; iconColor: string }[]>([])
  type DemoMessage = { role: "assistant" | "user"; content: string }
  const [demoMessages, setDemoMessages] = useState<DemoMessage[]>([
    { role: "assistant", content: mockInitialMessage }
  ])
  const [showQuestions, setShowQuestions] = useState(true)
  const [demoRoadmap, setDemoRoadmap] = useState<DemoRoadmap>(mockRoadmapData as DemoRoadmap)
  const [activeDemoNode, setActiveDemoNode] = useState<string | null>(null)

  const handleDemoSend = async () => {
    if (!demoInput.trim()) return

    // Add user message
    const userMessage = { role: "user" as const, content: demoInput }
    setDemoMessages(prev => [...prev, userMessage])
    setShowQuestions(false)
    setIsTyping(true)
    
    const currentInput = demoInput
    setDemoInput("")

    // The landing demo is intentionally scripted. It previously fetched
    // /api/llm — a route that doesn't exist (every message 404'd into a
    // fallback) — and a real unauthenticated LLM endpoint would let anyone
    // drain the provider quota. The live tutor starts after sign-up.
    await new Promise((r) => setTimeout(r, 900))
    setDemoMessages(prev => [...prev, {
      role: "assistant" as const,
      content: `Great question about "${currentInput}"! In the full app I'd answer with a tailored explanation, interactive diagrams, runnable code, and practice exercises that update your personal roadmap as you learn. Sign up to start your learning journey!`
    }])
    setIsTyping(false)
  }

  const handleSuggestionClick = (suggestion: string) => {
    setDemoInput(suggestion)
  }

  useEffect(() => {
    const iconShuffled = shuffleArray(ICONS).slice(0, 4)
    const colorShuffled = shuffleArray(COLORS).slice(0, 4)
    setRandomCards(suggestedQuestions.map((q, i) => ({
      question: q,
      Icon: iconShuffled[i],
      iconColor: colorShuffled[i],
    })))
  }, [])

  // initialize demo active node to first IN_PROGRESS child or first child
  useEffect(() => {
    if (!activeDemoNode) {
      for (const parent of demoRoadmap.nodes) {
        const inProg = parent.children?.find((c: RoadmapChild) => c.status === "IN_PROGRESS")
        if (inProg) {
          setActiveDemoNode(inProg.id)
          return
        }
      }
      // fallback to first child
      const firstChild = demoRoadmap.nodes[0]?.children?.[0]
      setActiveDemoNode(firstChild?.id || null)
    }
  }, [demoRoadmap, activeDemoNode])


  const handleDemoNodeSelect = (selectedNodeId: string) => {
    setActiveDemoNode(selectedNodeId)
  }

  const handleDemoStatusUpdate = (newStatus: RoadmapChild["status"]) => {
    if (!activeDemoNode) return
    const next: DemoRoadmap = {
      ...demoRoadmap,
      nodes: demoRoadmap.nodes.map((p: RoadmapParent) => ({
        ...p,
        children: p.children?.map((c: RoadmapChild) => c.id === activeDemoNode ? { ...c, status: newStatus } : c)
      }))
    }
    setDemoRoadmap(next)
    // If completed, try to advance to next child
    if (newStatus === "COMPLETED") {
      for (const parent of next.nodes) {
        const idx = parent.children?.findIndex((c: RoadmapChild) => c.id === activeDemoNode)
        if (idx != null && idx >= 0) {
          const nextChild = parent.children?.[idx + 1]
          if (nextChild) {
            setActiveDemoNode(nextChild.id)
            return
          }
        }
      }
      // otherwise pick first available
      const first = next.nodes[0]?.children?.[0]
      setActiveDemoNode(first?.id || null)
    }
  }

  const handleDemoNeedHelp = (text = "Explain this more") => {
    // reuse demo input/send flow
    setDemoInput(text)
    handleDemoSend()
  }

  // Redirect logged-in users to dashboard. While auth is loading, don't render the page
  useEffect(() => {
    if (!loading && user) {
      // replace so back button doesn't return to landing
      router.replace("/dashboard")
    }
  }, [user, loading, router])

  // Avoid showing landing page during auth check or while redirecting
  if (loading || user) return null


  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <AppHeader>
        <Button variant="ghost" onClick={() => router.push("/sign-in")} size={isMobile ? "icon" : "default"} className={isMobile ? "relative flex h-10 w-10 items-center justify-center rounded-full text-neutral-700 dark:text-neutral-300 dark:bg-[hsl(0,0%,18%)] hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 border border-neutral-300/50 dark:border-neutral-700/50" : "flex gap-2 text-neutral-700 dark:text-neutral-300 dark:bg-[hsl(0,0%,18%)] hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 border border-neutral-300/50 dark:border-neutral-700/50 rounded-full"}>
          <LogIn className="h-4 w-4" />
          <span className="hidden sm:inline">Sign In</span>
        </Button>
        <Button variant="ghost" onClick={() => router.push("/sign-up")} size={isMobile ? "icon" : "default"} className={isMobile ? "relative flex h-10 w-10 items-center justify-center rounded-full text-neutral-700 dark:text-neutral-300 dark:bg-[hsl(0,0%,18%)] hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 border border-neutral-300/50 dark:border-neutral-700/50" : "flex gap-2 text-neutral-700 dark:text-neutral-300 dark:bg-[hsl(0,0%,18%)] hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 border border-neutral-300/50 dark:border-neutral-700/50 rounded-full"}>
          <UserPlus className="h-4 w-4" />
          <span className="hidden sm:inline">Get Started</span>
        </Button>
        <DarkModeToggle/>
      </AppHeader>

      {/* Hero Section */}
      <section className="py-12 px-4 bg-neutral-50/50 dark:bg-neutral-900/50">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full border dark:border-neutral-700 text-sm">
            <Origami className="h-4 w-4" />
            AI-Powered Learning Platform
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Choose a <Highlighter action="underline" color="#6c63ff">Skill</Highlighter>
            <br />
            <div className="pt-2">Master It with AI</div>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Get AI-generated roadmaps, interactive chat tutoring, and track your progress as you learn any skill from beginner to expert.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <div>
              <InteractiveHoverButton 
                className="dark:bg-[hsl(0,0%,18%)] border border-neutral-300/50 dark:border-neutral-700/50"
                onClick={() => router.push("/sign-up")} 
              >
                Start Learning
              </InteractiveHoverButton>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section className="py-12 px-4 bg-neutral-50/50 dark:bg-neutral-900/50">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">
              Experience Interactive Learning
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Try the learning interface with a real roadmap and AI tutor. This is a working demo with actual responses!
            </p>
          </div>

          {/* Demo Interface - Contained within boundaries */}
          <div className="max-w-6xl mx-auto">
            <div className="rounded-lg border bg-background shadow-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700">
                <div className="hidden sm:flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <div className="flex-1 text-center">
                  <div className="flex items-center justify-center text-sm rounded-lg p-2 bg-neutral-100 dark:bg-[hsl(0,0%,11%)] text-neutral-600 dark:text-muted-foreground">
                    <Lock className="h-4 w-4" />
                    <span className="ml-2">skill-tutor-ai.vercel.app</span>
                  </div>
                </div>
              </div>

              {/* Manual sidebar layout without SidebarProvider */}
              <div className="flex flex-col md:flex-row md:h-[550px] relative">
                {/* Manual Roadmap Sidebar (hidden on small screens) */}
                <div className="hidden md:flex md:w-80 border-r bg-sidebar text-sidebar-foreground md:flex-col">
                  <div className="border-b border-sidebar-border px-6 py-4">
                    <div className="flex place-items-center justify-between">
                      <h2 className="text-lg font-semibold text-sidebar-foreground">React Development</h2>
                      {/* <Button variant="ghost" className="p-2.5 rounded-lg">
                        <WandSparkles className="h-4 w-4"/>
                      </Button> */}
                    </div>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-2">
                      {demoRoadmap.nodes.map((node, index) => (
                        <RoadmapStep key={node.id} node={node as RoadmapParent} index={index} />
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-w-0 overflow-visible text-sm mt-1">
                  <header className="flex h-12 shrink-0 items-center gap-2 sticky top-0 bg-white z-10 dark:bg-neutral-800 px-2 sm:px-3">
                  <div className="flex items-center gap-2 px-2">
                    {/* <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Menu className="h-4 w-4" />
                    </Button>
                    <Separator orientation="vertical" className="mr-2 h-4" /> */}

                    <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="md:hidden p-2 rounded-full hover:bg-muted dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 hover:dark:text-white hover:text-neutral-900">
                      <Menu className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="dark:bg-[hsl(0,0%,18%)]">
                      <DropdownMenuItem asChild>
                      <Link href="/dashboard" className="flex gap-2 text-sm">
                        <Orbit className="h-4 w-4 text-neutral-500 dark:text-neutral-400" /> Your Skills
                      </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                      <Link href="/quiz/demo" className="flex gap-2 text-sm">
                        <Dices className="h-4 w-4 text-neutral-500 dark:text-neutral-400" /> Quiz
                      </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                    </DropdownMenu>

                    {/* breadcrumb */}
                    <div className="hidden md:flex">
                    <div className="flex items-center gap-1 text-sm">
                      <div className="hover:cursor-pointer text-neutral-500 hover:bg-muted hover:text-black dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-700 p-1.5 rounded-full text-sm">
                      <div className="flex gap-1 items-center text-sm"><Orbit className="h-4 w-4"/>Your Skills</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      <div className="hover:cursor-pointer text-neutral-500 hover:bg-muted hover:text-black dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-700 p-1.5 rounded-full text-sm">
                      <div className="flex gap-1 items-center"><BookOpen className="h-4 w-4"/><span className="text-sm">Learn React</span></div>
                      </div>
                      <Separator orientation="vertical" className="mr-2 h-4" />
                      <div className="hover:cursor-pointer text-neutral-500 hover:bg-muted hover:text-black dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-700 p-1.5 rounded-full text-sm">
                      <div className="flex gap-1 items-center"><Dices className="h-4 w-4"/>Quiz</div>
                      </div>
                    </div>
                    </div>
                  </div>
                  <div className="px-2 sm:px-3 ml-auto">
                    <UserProfileBadge/>
                  </div>
                  </header>

                  {/* Mobile roadmap selector (visible only on small screens) */}
                  <div className="md:hidden px-4 py-2 border-b bg-sidebar text-sidebar-foreground">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {demoRoadmap.nodes.map((parent: RoadmapParent) => (
                        parent.children?.map((child: RoadmapChild) => (
                          <button
                            key={child.id}
                            onClick={() => handleDemoNodeSelect(child.id)}
                            className={`whitespace-nowrap px-3 py-1 rounded-lg text-sm ${child.id === activeDemoNode ? 'bg-primary/10 text-primary' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'}`}
                          >
                            {child.title}
                          </button>
                        ))
                      ))}
                    </div>
                  </div>

                  {/* Chat interface */}
                  <div className="flex-1 min-h-0 overflow-auto">
                  <div className="flex flex-col h-full overflow-hidden">
                    <ScrollArea className="flex-1 px-4 sm:px-6 pl-2 space-y-2 scroll-smooth w-full sm:overflow-x-auto" style={{ height: "100%" }}>
                    <div className="flex h-full items-center justify-center min-w-0">
                      {showQuestions && demoMessages.length === 1 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 place-items-center my-10 w-full sm:max-w-xl mx-auto overflow-hidden">
                        {randomCards.map(({ question, Icon, iconColor }, idx) => (
                        <QuestionCard
                          key={question.id || idx}
                          question={question}
                          Icon={Icon}
                          iconColorClass={iconColor}
                          onQuestionClick={handleSuggestionClick}
                        />
                        ))}
                      </div>
                      ) : (
                      <div className="flex flex-col gap-2 w-full sm:max-w-xl mx-auto py-3">
                        {demoMessages.map((msg, i) => (
                        <div key={i}>
                          {msg.role === "assistant" ? (
                          <div className="flex items-start w-full rounded-lg gap-3">
                            <Orbit className="flex-shrink-0 mr-2 mt-2 h-6 w-6 rounded-full p-0.5 overflow-visible border border-neutral-300 dark:border-neutral-600 text-[#6c63ff] dark:text-[#7a83ff]" />
                            <div className="flex flex-col mb-3 w-full">
                                        <div className="flex-1 text-neutral-900 dark:text-white text-sm break-words overflow-x-auto">
                                          <MarkdownRenderer content={msg.content} />
                                        </div>
                                        {/* Demo action bar: show for latest AI response */}
                                        {(() => {
                                          const latestAiIndex = demoMessages.reduce((maxIdx, m, idx) => m.role === "assistant" && idx > maxIdx ? idx : maxIdx, -1)
                                          if (i === latestAiIndex && activeDemoNode) {
                                            return (
                                              <div className="flex flex-wrap gap-2 sm:gap-4 items-center mt-3 -ml-2 px-2 sm:px-0">
                                                <DropdownMenu>
                                                      <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="flex gap-1 text-neutral-500 dark:text-neutral-400 hover:dark:text-white p-2 rounded-full hover:bg-muted dark:hover:bg-neutral-700">
                                                      <ChevronRight className="h-4 w-4" />
                                                      {demoRoadmap.nodes.find((n: RoadmapParent) => n.id === activeDemoNode || n.children?.some((c: RoadmapChild) => c.id === activeDemoNode))?.children?.find((c: RoadmapChild) => c.id === activeDemoNode)?.title ||
                                                        demoRoadmap.nodes.find((n: RoadmapParent) => n.id === activeDemoNode)?.title ||
                                                        "Select Topic"}
                                                    </Button>
                                                  </DropdownMenuTrigger>
                                                  <DropdownMenuContent className="dark:bg-[hsl(0,0%,18%)] max-h-60 overflow-y-auto custom-scrollbar">
                                                    {demoRoadmap.nodes.map((parentNode: RoadmapParent, idx: number) => (
                                                      <React.Fragment key={parentNode.id}>
                                                        {parentNode.children && parentNode.children.map((child: RoadmapChild) => (
                                                          <DropdownMenuItem key={child.id} onClick={() => handleDemoNodeSelect(child.id)} className={child.id === activeDemoNode ? "bg-neutral-100 dark:bg-neutral-700" : ""}>
                                                            {child.title}
                                                          </DropdownMenuItem>
                                                        ))}
                                                        {idx < demoRoadmap.nodes.length - 1 && <DropdownMenuSeparator className="my-1" />}
                                                      </React.Fragment>
                                                    ))}
                                                  </DropdownMenuContent>
                                                </DropdownMenu>

                                                <TooltipProvider>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <Button className="flex text-neutral-500 hover:bg-muted hover:text-black p-2 rounded-full dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-700 text-xs sm:text-sm" variant="ghost" onClick={() => handleDemoStatusUpdate("COMPLETED") }>
                                                                                      <CheckCircle className="h-4 w-4" /> <span className="hidden sm:inline">Complete</span>
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
                                                      <Button className="flex text-neutral-500 hover:bg-muted hover:text-black p-2 rounded-full dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-700 text-xs sm:text-sm" variant="ghost" onClick={() => handleDemoStatusUpdate("IN_PROGRESS") }>
                                                        <Play className="h-4 w-4" /> <span className="hidden sm:inline">Start</span>
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
                                                      <Button className="flex text-neutral-500 hover:bg-muted hover:text-black p-2 rounded-full dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-700 text-xs sm:text-sm" variant="ghost" onClick={() => handleDemoNeedHelp() }>
                                                        <HelpCircle className="h-4 w-4" /> <span className="hidden sm:inline">Help</span>
                                                      </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="bottom" className="text-white font-semibold bg-neutral-900">
                                                      Ask for more explanation
                                                    </TooltipContent>
                                                  </Tooltip>
                                                </TooltipProvider>
                                              </div>
                                            )
                                          }
                                          return null
                                        })()}
                                      </div>
                                    </div>
                                  ) : (
                          <div className="flex justify-end">
                            <div className="bg-neutral-100 dark:bg-[hsl(0,0%,20%)] text-neutral-900 dark:text-white text-xs p-2 rounded-xl max-w-lg mb-3 break-words overflow-hidden">
                            {msg.content}
                            </div>
                          </div>
                          )}
                        </div>
                        ))}
                        {isTyping && <LoadingBubble />}
                      </div>
                      )}
                    </div>
                    </ScrollArea>

                    <div className="border border-r bg-white dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700 rounded-xl p-3 w-full sm:max-w-xl mx-auto mb-3 sm:mb-4">
                      <Textarea
                        value={demoInput}
                        onChange={(e) => setDemoInput(e.target.value)}
                        placeholder="Type your question..."
                        onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          handleDemoSend()
                        }
                        }}
                        className="bg-white dark:bg-[hsl(0,0%,18%)] resize-none min-h-[2rem] max-h-28 w-full rounded-lg mb-1 px-4 sm:px-6 custom-scrollbar text-sm"
                      />
                      <div className="flex justify-between place-items-center">
                        <div className="flex justify-start gap-2 mb-2 ml-1">
                          
                        </div>
                        <div className="flex justify-end gap-2 mb-2 mr-1">
                          <Button
                            className="h-7 w-7 rounded-full p-2 flex items-center justify-center"
                            onClick={handleDemoSend}
                            disabled={isTyping}
                            aria-label="Send"
                          >
                            <FaArrowUp className="h-4 w-4" />
                          </Button>
                        </div>
                    </div>
                    </div>
                  </div>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-center text-muted-foreground mt-4 text-sm">
              ↑ Try asking questions about React.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4  bg-neutral-50/50 dark:bg-neutral-900/50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">
              Everything You Need to Learn Effectively
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From AI-generated roadmaps to interactive quizzes, this platform provides the complete learning experience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: RiRoadMapFill,
                title: "AI-Generated Roadmaps",
                description: "Get personalized learning paths tailored to your goals, experience level, and learning style."
              },
              {
                icon: RiLightbulbFlashFill,
                title: "Interactive AI Tutor",
                description: "Ask questions, get explanations, and receive guidance from your dedicated AI learning assistant."
              },
              {
                icon: FaBarsProgress,
                title: "Progress Tracking",
                description: "Monitor your learning journey with detailed progress tracking and performance analytics."
              }
            ].map((feature, i) => (
              <Card key={i} className="text-center dark:bg-neutral-900 dark:border-neutral-800">
                <CardHeader>
                  <div className="flex items-center flex-col">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="h-6 w-6 text-[#6c63ff] dark:text-[#7a83ff]" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4  bg-neutral-50/50 dark:bg-neutral-900/50">
        <div className="container mx-auto max-w-7xl">
          <Separator className="my-4" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Orbit className="h-6 w-6 text-[#6c63ff] dark:text-[#7a83ff]" />
              <span className="text-xl font-semibold text-neutral-700 dark:text-neutral-300">SkillSpace</span>
            </div>
            <div className="text-center text-sm text-muted-foreground">
              © 2025 SkillSpace. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}