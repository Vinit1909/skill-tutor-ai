"use client"

import * as React from "react"
import { useRef } from "react"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar"
import { BookMarked, Dices, LayoutDashboard, Loader, Menu, MessageSquareX, WandSparkles } from "lucide-react"
import Chat, { ChatRef } from "./chat"
import OnboardingWizard from "@/components/learn-page/onboardingWizard"
import { QuestionData } from "@/components/learn-page/question-card"
import { db } from "@/lib/firebase"
import { collection, getDocs } from "firebase/firestore"
import { getSkillSpace, SkillSpaceData } from "@/lib/skillspace"
import { useAuthContext } from "@/context/authcontext"
import { clearChatmessages } from "@/lib/skillChat"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import Roadmap from "./roadmap"
import UserProfileBadge from "@/components/user-profile-badge"
import { Button } from "@/components/ui/button"

export default function LearnPage() {
    const params = useParams()
    let { skillId } = params || {}
    if (Array.isArray(skillId)) {
        skillId = skillId[0]
    }
    return (
        <SidebarProvider defaultOpen={true}>
            <LearnLayout skillId={skillId} />
        </SidebarProvider>
    )
}

function LearnLayout({skillId}: {skillId?: string}) {
    const {user, loading} = useAuthContext()
    const [skill, setSkill] = useState<SkillSpaceData | null>(null)
    const [showWizard, setShowWizard] = useState(false)
    const [questions, setQuestions] = useState<QuestionData[]>([])
    const [fetching, setFetching] = useState(true)

    const chatRef = useRef<ChatRef>(null)

    useEffect(() => {
        if (!user?.uid || !skillId) return
        getSkillSpace(user.uid, skillId)
            .then((doc) => {
                if (doc) {
                    setSkill(doc)
                    if (!doc.roadmapJSON) {
                        setShowWizard(true)
                    }
                } else {
                    console.log("Skill not found!")
                }
                setFetching(false)
            })
            .catch((err) => {
                console.log(err)
                setFetching(false)
            })
    }, [user, skillId])

    useEffect(() => {
        if (!user?.uid || !skillId) return
        fetchQuestions(user.uid, skillId).then((qs) => setQuestions(qs))
    }, [user, skillId])

    async function handleClearChatClick() {
        if (!user?.uid || !skillId) return

        await clearChatmessages(user.uid, skillId)
        if (chatRef.current) {
            chatRef.current.clearLocalChat()
        }
    }

    async function handleWizardComplete() {
        setShowWizard(false)
        if (!user?.uid || !skillId) return
        const updated = await getSkillSpace(user.uid, skillId)
        setSkill(updated)
        const qs = await fetchQuestions(user.uid, skillId)
        setQuestions(qs)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen w-screen">
                <div className="text-md text-neutral-500 dark:text-neutral-400">
                    <div className="flex gap-2 animate-shiny-text"><Loader className="animate-spin"/>Loading</div>
                </div>
            </div>
        )
    }

    if (!skill && !fetching) {
        return (
            <div className="flex items-center justify-center h-screen w-screen">
                <div className="text-md text-neutral-500 dark:text-neutral-400">
                    <div className="flex gap-2 animate-shiny-text"><Loader className="animate-spin"/>Loading Skill</div>
                </div>
            </div>
        )
    }

    if (showWizard && user && skillId) {
        return (
          <OnboardingWizard
            skillName={skill?.name || "Unknown"}
            uid={user.uid}
            skillId={skillId}
            onComplete={handleWizardComplete}
          />
        )
    }
    
    // If we are still fetching skill data, show a loading
    if (fetching) {
        return (
            <div className="text-md text-neutral-500 dark:text-neutral-400 h-screen w-screen flex items-center justify-center">
                <div className="flex gap-2 animate-shiny-text"><Loader className="animate-spin"/>Loading Chat</div>
            </div>
        )
    }

    return (
        <SidebarProvider defaultOpen={true}>
            <Roadmap
                skillId={skill?.id}
                roadmap={skill?.roadmapJSON}
                onCreateRoadmap={() => setShowWizard(true)}
            />

          {showWizard && user && skillId && (
            <OnboardingWizard
                skillName={skill?.name ?? "Unknown"}
                uid={user.uid}
                skillId={skillId}
                onComplete={handleWizardComplete}
            />
          )}
    
          {/* The main content area */}
          <SidebarInset className="flex flex-col h-screen overflow-hidden">
            <header className="flex h-16 shrink-0 items-center gap-2 sticky top-0 bg-white z-10 dark:bg-neutral-800 px-2 sm:px-4 ">
              <div className="flex items-center gap-2 px-3">
                <SidebarTrigger/>
                <Separator orientation="vertical" className="mr-2 h-4" />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="md:hidden p-2.5 rounded-full hover:bg-muted dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 hover:dark:text-white hover:text-neutral-900">
                            <Menu className="h-10 w-10" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="dark:bg-[hsl(0,0%,18%)]">
                        <DropdownMenuItem asChild>
                        <a href="/dashboard" className="flex gap-2">
                            <LayoutDashboard className="h-4 w-4 text-neutral-500 dark:text-neutral-400" /> Your Skills
                        </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                        <a href={`/quiz/${skillId}`} className="flex gap-2">
                            <Dices className="h-4 w-4 text-neutral-500 dark:text-neutral-400" /> Quiz
                        </a>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleClearChatClick} className="text-destructive dark:text-red-500 dark:hover:text-white">
                        <MessageSquareX className="h-4 w-4 mr-2" /> Clear Chat
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* breadcrumb */}
                <Breadcrumb className="hidden md:flex">
                  <BreadcrumbList>
                    <BreadcrumbItem className="hover:bg-muted hover:text-black p-2 rounded-full dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-700">
                      <BreadcrumbLink href="/dashboard">
                          <div className="flex gap-1 place-items-center"><LayoutDashboard className="h-4 w-4"/>Your Skills</div>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator/>
                    <BreadcrumbItem>
                        <BreadcrumbPage className="hover:cursor-pointer text-neutral-500 hover:bg-muted hover:text-black dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-700 p-2 rounded-full">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <div className="flex gap-1 place-items-center"><BookMarked className="h-4 w-4"/><span>Learn {skill?.name}</span></div>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="dark:bg-[hsl(0,0%,18%)]">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem>
                                        <WandSparkles className="h-4 w-4 mr-2 rounded-full"/> Edit Roadmap
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive dark:text-red-500 dark:hover:text-white" onClick={handleClearChatClick} >
                                        <MessageSquareX className="h-4 w-4 mr-2 rounded-full"/> Clear Chat
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
                <Separator orientation="vertical" className="mr-2 h-4 hidden md:block" />
                <Breadcrumb className="hidden md:flex">
                  <BreadcrumbList>
                    <BreadcrumbItem className="hover:bg-muted hover:text-black p-2 rounded-full dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-700">
                      <BreadcrumbLink href={`/quiz/${skillId}`}>
                          <div className="flex gap-1 place-items-center"><Dices className="h-4 w-4"/>Quiz</div>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
              <div className="px-2 sm:px-4 ml-auto place-items-center"><UserProfileBadge/></div>
            </header>

            {/* Chat interface */}
            <div className="flex-1 min-h-0 overflow-auto">
                <Chat 
                    ref={chatRef} 
                    skillId={skillId} 
                    questions={questions}
                />
            </div>
          </SidebarInset>
        </SidebarProvider>
    )
}

async function fetchQuestions(uid: string, skillId: string): Promise<QuestionData[]> {
    const ref = collection(db, "users", uid, "skillspaces", skillId, "questions")
    const snap = await getDocs(ref)
    const qs: QuestionData[] = []
    snap.forEach((docSnap) => {
        qs.push({id: docSnap.id, ...docSnap.data()} as QuestionData)
    })
    return qs
}