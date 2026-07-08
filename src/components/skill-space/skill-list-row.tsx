"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { BookOpenText, Dices } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { InlineEdit } from "@/components/ui/inline-edit"
import { useAuthContext } from "@/context/authcontext"
import { SkillSpaceData, deleteSkillSpaceDeep, updateSkillSpace } from "@/lib/skillspace"
import { DeleteSkillButton, formatSkillCreatedAt } from "./skillcard"

interface SkillListRowProps {
  skill: SkillSpaceData
  onUpdated?: () => void
}

/**
 * Compact list-view row (Notion-style): the whole row opens the skill's learn
 * page; rename, quiz, and delete are inline and stop the row click.
 */
export default function SkillListRow({ skill, onUpdated }: SkillListRowProps) {
  const router = useRouter()
  const { user } = useAuthContext()
  const [localName, setLocalName] = useState(skill.name)

  const progressPercentage = skill.max
    ? Math.round((skill.value / skill.max) * 100)
    : 0

  async function handleDelete() {
    if (!user?.uid || !skill.id) return
    try {
      await deleteSkillSpaceDeep(user.uid, skill.id)
      if (onUpdated) onUpdated()
    } catch (err) {
      console.error("Error deleting skillspace:", err)
      toast.error("Failed to delete skill space.")
    }
  }

  async function handleRename(newName: string) {
    if (!user?.uid || !skill.id) return
    await updateSkillSpace(user.uid, skill.id, { name: newName })
    setLocalName(newName)
    toast.success(`Renamed to "${newName}"`)
    if (onUpdated) onUpdated()
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/learn/${skill.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/learn/${skill.id}`)
      }}
      className="group flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-700/40 focus-visible:outline-none focus-visible:bg-neutral-50 dark:focus-visible:bg-neutral-700/40"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500">
        <BookOpenText className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        {/* Rename is inline — stop the click so it doesn't open the skill */}
        <div onClick={(e) => e.stopPropagation()} className="inline-flex max-w-full">
          <InlineEdit
            value={localName}
            onSave={handleRename}
            className="text-sm font-medium text-neutral-700 dark:text-neutral-300 truncate"
            inputClassName="text-sm font-medium"
          />
        </div>
        {skill.description && (
          <p className="hidden sm:block truncate text-xs text-neutral-500 dark:text-neutral-400">
            {skill.description}
          </p>
        )}
      </div>

      <div className="hidden md:flex items-center gap-2 w-40 shrink-0">
        <Progress value={progressPercentage} className="h-1.5" />
        <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
          {progressPercentage}%
        </span>
      </div>

      <span className="hidden lg:block w-32 shrink-0 text-right text-xs text-muted-foreground">
        {formatSkillCreatedAt(skill)}
      </span>

      <div
        onClick={(e) => e.stopPropagation()}
        className="flex shrink-0 items-center gap-1"
      >
        <Button
          variant="ghost"
          size="icon"
          title="Quiz"
          className="h-8 w-8 rounded-full text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-500 dark:hover:text-white dark:hover:bg-neutral-700"
          onClick={() => router.push(`/quiz/${skill.id}`)}
        >
          <Dices className="h-4 w-4" />
        </Button>
        <DeleteSkillButton name={localName} onConfirm={handleDelete} />
      </div>
    </div>
  )
}
