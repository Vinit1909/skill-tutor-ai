"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthContext } from "@/context/authcontext"
import { createSkillSpace, getAllSkillSpaces, type SkillSpaceData } from "@/lib/skillspace"
import SkillSpace from "@/components/skill-space/skillspace"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CircleFadingPlus, Loader, Orbit, Rocket } from "lucide-react"
import Image from "next/image"
import UserProfileBadge from "@/components/user-profile-badge"

export default function DashboardPage() {
  const { user, loading } = useAuthContext()
  const router = useRouter()

  const [skillSpaces, setSkillSpaces] = useState<SkillSpaceData[]>([])
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [openDialog, setOpenDialog] = useState(false)
  const [loadingSkillSpaces, setLoadingSkillSpaces] = useState(false)

  // If user not logged in once loading is done, redirect
  useEffect(() => {
    if (!loading && !user) {
      router.push("/sign-in")
    }
  }, [loading, user, router])

  // Fetch skillSpaces if a user
  useEffect(() => {
    if (!loading && user?.uid) {
      fetchSkillSpaces()
    }
  }, [loading, user])

  // Log user object for debugging
  useEffect(() => {
    if (user) {
      console.log("User Object:", user)
    }
  }, [user])

  async function fetchSkillSpaces() {
    if (!user?.uid) return
    try {
      setLoadingSkillSpaces(true)
      const data = await getAllSkillSpaces(user.uid)
      setSkillSpaces(data)
    } catch (err) {
      console.error("Error fetching skill spaces:", err)
    } finally {
      setLoadingSkillSpaces(false)
    }
  }

  async function handleCreateSkillSpace() {
    if (!user?.uid) return
    try {
      await createSkillSpace(user.uid, newName, newDesc)
      setNewName("")
      setNewDesc("")
      setOpenDialog(false)
      fetchSkillSpaces()
    } catch (err) {
      console.error("Error creating skill space:", err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-neutral-800">
        <div className="text-md text-neutral-500 dark:text-neutral-400">
          <div className="flex gap-2">
            <Loader className="animate-spin" />
            Loading
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-neutral-800">
        <div className="text-md text-neutral-500 dark:text-neutral-400">No user signed in</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-800">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/20 dark:bg-neutral-800/70 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-700">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Orbit className="h-6 w-6 text-[#6c63ff] dark:text-[#7a83ff]" />
            <h2 className="text-xl font-semibold text-neutral-700 dark:text-neutral-300">SkillSpace</h2>
          </div>

          <div className="flex items-center gap-3">
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex gap-2 text-neutral-700 dark:text-neutral-300 dark:bg-[hsl(0,0%,18%)] hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 border border-neutral-300/50 dark:border-neutral-700/50 rounded-full"
                >
                  <CircleFadingPlus className="h-4 w-4" />
                  <span className="hidden sm:inline">Create SkillSpace</span>
                  <span className="inline sm:hidden">Create</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
                <DialogHeader>
                  <DialogTitle>Create SkillSpace</DialogTitle>
                  <DialogDescription>Provide a name and description for your new skill space.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
                    <Label htmlFor="name" className="sm:text-right">
                      Skill Name
                    </Label>
                    <Input
                      id="name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="col-span-1 sm:col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
                    <Label htmlFor="desc" className="sm:text-right">
                      Description
                    </Label>
                    <Input
                      id="desc"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      className="col-span-1 sm:col-span-3"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button className="w-full sm:w-auto" variant="default" onClick={handleCreateSkillSpace}>
                    <div className="flex items-center gap-2"><Rocket className="h-4 w-4"/> Create</div>
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <UserProfileBadge />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {loadingSkillSpaces ? (
          <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
            <div className="text-md text-neutral-500 dark:text-neutral-400">
              <div className="flex gap-2">
                <Loader className="animate-spin" />
                Loading SkillSpace
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto">
            {skillSpaces.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Alert className="flex flex-col items-center justify-center max-w-md w-full p-6 rounded-lg border border-neutral-200 dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700">
                  <Image className="mx-auto" alt="empty" src="/empty.svg" width={200} height={200} />
                  <AlertTitle className="text-center mt-4 text-xl font-semibold text-neutral-700 dark:text-neutral-400">
                    No SkillSpace Yet
                  </AlertTitle>
                  <AlertDescription className="text-center mt-2 text-neutral-500">
                    Fill your Headspace with a new SkillSpace
                  </AlertDescription>
                  <Button onClick={() => setOpenDialog(true)} className="mt-4" variant="default">
                    <CircleFadingPlus className="h-4 w-4 mr-2" />
                    Create SkillSpace
                  </Button>
                </Alert>
              </div>
            ) : (
              <div className="space-y-4">
                <h1 
                  className="text-xl font-medium text-neutral-700 dark:text-neutral-300 mb-4"
                >
                  {user?.displayName ? `${user.displayName.split(' ')[0]}'s` : `Your`} Space
                </h1>
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                  <SkillSpace skills={skillSpaces} onUpdated={fetchSkillSpaces} />
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}