"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuthContext } from "@/context/authcontext"
import { useIsMobile } from "@/hooks/use-mobile"
import { createSkillSpace, getAllSkillSpaces, type SkillSpaceData } from "@/lib/skillspace"
import SkillSpace, { type SkillViewMode } from "@/components/skill-space/skillspace"

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
import { CircleFadingPlus, GalleryHorizontalEnd, LayoutGrid, List, Loader, Orbit, Rocket, Search, X } from "lucide-react"
import Image from "next/image"
import UserProfileBadge from "@/components/user-profile-badge"

export default function DashboardPage() {
  const { user, loading } = useAuthContext()
  const router = useRouter()
  const isMobile = useIsMobile()

  const [skillSpaces, setSkillSpaces] = useState<SkillSpaceData[]>([])
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [openDialog, setOpenDialog] = useState(false)
  const [loadingSkillSpaces, setLoadingSkillSpaces] = useState(false)
  const [query, setQuery] = useState("")
  const [view, setView] = useState<SkillViewMode>("grid")

  // Restore the last-used view (client-only, after hydration)
  useEffect(() => {
    const stored = localStorage.getItem("dashboard:view")
    if (stored === "grid" || stored === "gallery" || stored === "list") {
      setView(stored)
    }
  }, [])

  function changeView(next: SkillViewMode) {
    setView(next)
    localStorage.setItem("dashboard:view", next)
  }

  // If user not logged in once loading is done, redirect
  useEffect(() => {
    if (!loading && !user) {
      router.push("/sign-in")
    }
  }, [loading, user, router])

  const fetchSkillSpaces = useCallback(async () => {
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
  }, [user?.uid])

  // Fetch skillSpaces if a user
  useEffect(() => {
    if (!loading && user?.uid) {
      fetchSkillSpaces()
    }
  }, [loading, user?.uid, fetchSkillSpaces])

  // Search filters on name + description, case-insensitive
  const filteredSkills = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return skillSpaces
    return skillSpaces.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q)
    )
  }, [skillSpaces, query])

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
                  size={isMobile ? "icon" : "default"}
                  className={
                    isMobile
                      ? "relative flex h-10 w-10 items-center justify-center rounded-full text-neutral-700 dark:text-neutral-300 dark:bg-[hsl(0,0%,18%)] hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 border border-neutral-300/50 dark:border-neutral-700/50"
                      : "flex gap-2 text-neutral-700 dark:text-neutral-300 dark:bg-[hsl(0,0%,18%)] hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 border border-neutral-300/50 dark:border-neutral-700/50 rounded-full"
                  }
                >
                  <CircleFadingPlus className="h-10 w-10" />
                  {isMobile ? "" : "Create SkillSpace"}
                </Button>
              </DialogTrigger>
                <DialogContent className={`bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 ${isMobile ? "w-5/6" : "w-full max-w-md"}`}>
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
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
          <div className={`w-full ${isMobile ? "max-w-[95%]" : "max-w-5xl"} mx-auto`}>
            {skillSpaces.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Alert className={`flex flex-col items-center justify-center max-w-md w-full ${isMobile ? "max-w-[85%]" : "max-w-md"} p-4 sm:p-6 rounded-lg border border-neutral-200 dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700`}>
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
              <div className={`space-y-${isMobile ? "2" : "4"} sm:space-y-6`}>
                <div className="flex items-baseline gap-3 mb-4">
                  <h1 className="text-xl font-medium text-neutral-700 dark:text-neutral-300">
                    {user?.displayName ? `${user.displayName.split(' ')[0]}'s` : `Your`} Space
                  </h1>
                  <span className="text-sm text-neutral-400 dark:text-neutral-500">
                    {skillSpaces.length} {skillSpaces.length === 1 ? "skill" : "skills"}
                  </span>
                </div>

                {/* Toolbar: search + view switcher */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search skills..."
                      aria-label="Search skills"
                      className="pl-10 pr-9 rounded-full bg-white dark:bg-[hsl(0,0%,18%)] border-neutral-300/50 dark:border-neutral-700/50 focus-visible:ring-1"
                    />
                    {query && (
                      <button
                        onClick={() => setQuery("")}
                        aria-label="Clear search"
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div
                    role="group"
                    aria-label="View"
                    className="flex items-center gap-1 self-end sm:self-auto rounded-full border border-neutral-300/50 dark:border-neutral-700/50 bg-white dark:bg-[hsl(0,0%,18%)] p-1"
                  >
                    {(
                      [
                        { mode: "grid", Icon: LayoutGrid, label: "Grid view" },
                        { mode: "gallery", Icon: GalleryHorizontalEnd, label: "Gallery view" },
                        { mode: "list", Icon: List, label: "List view" },
                      ] as const
                    ).map(({ mode, Icon, label }) => (
                      <Button
                        key={mode}
                        variant="ghost"
                        size="icon"
                        title={label}
                        aria-label={label}
                        aria-pressed={view === mode}
                        onClick={() => changeView(mode)}
                        className={`h-8 w-8 rounded-full ${
                          view === mode
                            ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-700 dark:text-white"
                            : "text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </Button>
                    ))}
                  </div>
                </div>

                {filteredSkills.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-700 py-16 text-center">
                    <Search className="h-8 w-8 text-neutral-300 dark:text-neutral-600 mb-3" />
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      No skills match &ldquo;{query}&rdquo;
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setQuery("")}
                      className="mt-2 rounded-full text-neutral-500 dark:text-neutral-400"
                    >
                      Clear search
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                    <SkillSpace skills={filteredSkills} onUpdated={fetchSkillSpaces} view={view} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}