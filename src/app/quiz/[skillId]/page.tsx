// app/quiz/[skillId]/page.tsx
"use client"

import React, { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useAuthContext } from "@/context/authcontext"
import { getSkillSpace } from "@/lib/skillspace"
import { BookOpenText, Dices, LayoutDashboard, Loader } from "lucide-react"
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import QuizSection from "./quiz-section"
import UserProfileBadge from "@/components/user-profile-badge"

export default function QuizPage() {
  const params = useParams()
  const { user, loading } = useAuthContext()
  const [skill, setSkill] = useState<any>(null)
  const [fetching, setFetching] = useState(true)

  let { skillId } = params || {}
  if (Array.isArray(skillId)) skillId = skillId[0]

  useEffect(() => {
    if (!user?.uid || !skillId) return
    getSkillSpace(user.uid, skillId)
      .then((doc) => {
        if (doc) setSkill(doc)
        setFetching(false)
      })
      .catch((err) => console.log(err))
  }, [user, skillId])

  if (loading || (fetching && !skill)) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-neutral-800">
        <div className="text-md text-neutral-500 dark:text-neutral-400 flex gap-2 animate-pulse">
          <Loader className="animate-spin" /> Loading...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-800 flex flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 sticky top-0 bg-white z-10 dark:bg-neutral-800 backdrop-blur-sm border-b border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center gap-2 px-3">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hover:bg-muted hover:text-black p-2 rounded-full dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-700">
                  <BreadcrumbLink href={`/learn/${skillId}`}>
                    <div className="flex gap-1 items-center">
                      <BookOpenText className="h-4 w-4"/> Learn
                    </div>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
          </Breadcrumb>
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hover:bg-muted hover:text-black p-2 rounded-full dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-700">
                <BreadcrumbLink href="/dashboard">
                  <div className = "flex gap-1 items-center"><LayoutDashboard className="h-4 w-4"/> Your Skills</div>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem className="hover:bg-muted hover:text-black p-2 rounded-full dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-700">
                <BreadcrumbLink>
                  <div className="flex gap-1 items-center">
                    <Dices className="h-4 w-4"/> Quiz {skill.name}
                  </div>
                </BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="flex items-center px-6">
          <UserProfileBadge/>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center p-4">
        <QuizSection skillId={skillId} skill={skill} />
      </div>
    </div>
  )
}