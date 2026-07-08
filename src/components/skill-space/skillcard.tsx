import { useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Trash2, CalendarIcon, Dices, BookOpenText } from 'lucide-react'
import { useAuthContext } from "@/context/authcontext"
import { Progress } from "@/components/ui/progress"
import { SkillSpaceData, deleteSkillSpaceDeep, updateSkillSpace } from "@/lib/skillspace"
import { InlineEdit } from "@/components/ui/inline-edit"
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface SkillCardProps {
  skill: SkillSpaceData
  onUpdated?: () => void
  /** "grid" = compact fixed-width card; "gallery" = full-width card with
   *  visible description and created date for a more browsable layout. */
  variant?: "grid" | "gallery"
}

/** Trash button + confirm dialog, shared across the grid/gallery/list views. */
export function DeleteSkillButton({
  name,
  onConfirm,
}: {
  name: string
  onConfirm: () => void
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 dark:text-neutral-500 dark:hover:text-red-400"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the skill space and all its chat history. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="dark:bg-neutral-800 dark:border-neutral-700 dark:hover:bg-neutral-700">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-600"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function formatSkillCreatedAt(skill: SkillSpaceData): string {
  if (!skill.createdAt?.seconds) return 'Unknown date'
  return new Date(skill.createdAt.seconds * 1000).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function SkillCard({ skill, onUpdated, variant = "grid" }: SkillCardProps) {
  const router = useRouter()
  const { user } = useAuthContext()
  // Local name state so renaming reflects immediately without waiting for parent re-fetch
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

  function handleGoLearn() {
    router.push(`/learn/${skill.id}`)
  }

  function handleGoQuiz() {
    router.push(`/quiz/${skill.id}`)
  }

  const isGallery = variant === "gallery"

  return (
    <Card
      className={`${isGallery ? "w-full" : "w-64"} h-38 overflow-hidden transition-all duration-300 ease-in-out hover:shadow-lg dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700 dark:hover:shadow-xl`}
    >
      <CardHeader className="pb-4 place-items-center">
        <div className="flex items-center justify-between w-full space-x-2">
          <div className="flex items-center min-w-0 space-x-3">
            {/* <div className="flex-shrink-0 bg-primary-background dark:bg-primary-background">
              <HoverCard>
                <HoverCardTrigger asChild>
                  <div
                    className={`p-2 rounded-full hover:cursor-pointer dark:hover:text-blue-300  dark:hover:bg-blue-950/40 hover:text-blue-600 hover:bg-blue-50`}
                  >
                    <Info className="h-4 w-4" />
                  </div>
                </HoverCardTrigger>
                <HoverCardContent className="w-60 dark:bg-[hsl(0,0%,18%)]">
                  <div className="flex justify-between space-x-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold">{localName}</h4>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        {skill.description}
                      </p>
                      <div className="flex items-center pt-2">
                        <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                        <span className="text-xs text-muted-foreground">
                          {formatSkillCreatedAt(skill)}
                        </span>
                      </div>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div> */}

            {/* Inline-editable skill name */}
            <div className="flex gap-2 min-w-0">
              <CardTitle
                className="text-base font-medium truncate"
                style={isGallery ? undefined : { maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                <InlineEdit
                  value={localName}
                  onSave={handleRename}
                  className="text-base font-medium"
                  inputClassName="text-base font-medium"
                />
              </CardTitle>
            </div>
          </div>

          <DeleteSkillButton name={localName} onConfirm={handleDelete} />
        </div>
      </CardHeader>

      {/* Gallery view surfaces the description and created date directly on the
          card — no hover needed — for a more browsable, visual layout. */}
      {isGallery && (
        <CardContent className="px-4 pt-0 pb-3">
          <div className="flex items-center pt-2 text-xs text-muted-foreground">
            <CalendarIcon className="mr-2 h-3.5 w-3.5 opacity-70" />
            {formatSkillCreatedAt(skill)}
          </div>
        </CardContent>
      )}

      <CardContent className='px-4 pt-0 pb-2'>
        <div className='flex gap-2'>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start border border-r rounded-full text-muted-foreground dark:border-neutral-700"
            onClick={handleGoLearn}
          >
            <div className='flex gap-2'>
              <BookOpenText className='h-4 w-4 mr-2' /> Learn
            </div>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start border border-r rounded-full text-muted-foreground dark:border-neutral-700"
            onClick={handleGoQuiz}
          >
            <div className='flex gap-2'>
              <Dices className='h-4 w-4 mr-2' /> Quiz
            </div>
          </Button>
        </div>
      </CardContent>

      <CardContent className='p-4 pt-2'>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{skill.value} / {skill.max} • {progressPercentage}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
      </CardContent>
    </Card>
  )
}
