"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { WandSparkles } from "lucide-react"
import { RiAiGenerate } from "react-icons/ri"
import { ShineBorder } from "../magicui/shine-border"
import { getAuthHeaders } from "@/lib/clientAuth"
import { saveGeneratedRoadmap } from "@/lib/skillspace"

interface OnboardingWizardProps {
  skillName: string
  uid: string
  skillId: string
  onComplete: () => void
}

export default function OnboardingWizard({
  skillName,
  uid,
  skillId,
  onComplete
}: OnboardingWizardProps) {
  const [level, setLevel] = useState("")
  const [goals, setGoals] = useState("")
  const [priorKnowledge, setPriorKnowledge] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit() {
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/generate-roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({
          uid,
          skillId,
          skillName,
          level,
          goals,
          priorKnowledge,
        }),
        // Generation normally takes ~5–15s (each provider has a 45s server-side
        // deadline before failing over). If we're still waiting after 2 minutes,
        // something is genuinely wrong — surface an error instead of an
        // infinite spinner the user will "fix" by refreshing (which would
        // abandon the request entirely).
        signal: AbortSignal.timeout(120_000),
      })
      const data = await res.json()

      if (data.error || !data.roadmap) {
        throw new Error(data.userMessage || data.error || "Roadmap generation failed")
      }

      // The API is pure generation — persistence happens here, where the user
      // is authenticated (locked Firestore rules reject server-side writes).
      // This also fixes a bug where starter questions were never saved at all.
      await saveGeneratedRoadmap(
        uid,
        skillId,
        data.roadmap,
        { level, goals, priorKnowledge },
        data.questions ?? []
      )
      onComplete()
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && /timeout|abort/i.test(err.name + err.message)
      setError(
        isTimeout
          ? "Roadmap generation took too long. Please try again — it usually takes under 20 seconds."
          : err instanceof Error
          ? err.message
          : "An unexpected error occurred"
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
      <Card className="w-[400px] max-h-[90vh] relative overflow-auto dark:bg-neutral-900">
        <ShineBorder shineColor={["#A07CFE", "#FE8FB5", "#FFBE7B"]} />
        <CardHeader>
          <CardTitle><div className="flex gap-2"><WandSparkles className="h-4 w-4"/>Hi I&apos;m your {skillName} Wizard</div></CardTitle>
          <CardDescription>
            Let&apos;s create a tailored roadmap for you!
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* level select */}
          <div className="grid w-full items-center gap-2">
            <Label htmlFor="levelSelect">Your Current Level</Label>
            <Select
              onValueChange={(val) => setLevel(val)}
              defaultValue={level || ""}
            >
              <SelectTrigger id="levelSelect">
                <SelectValue placeholder={<span className="text-xs text-neutral-500">Select your level</span>} />
              </SelectTrigger>
              <SelectContent position="popper" className="dark:bg-neutral-900">
                <SelectItem className="dark:hover:bg-neutral-800" value="Beginner">Beginner</SelectItem>
                <SelectItem className="dark:hover:bg-neutral-800" value="Intermediate">Intermediate</SelectItem>
                <SelectItem className="dark:hover:bg-neutral-800" value="Advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid w-full items-center gap-2">
            <Label htmlFor="goalsArea">Your Goals</Label>
            <textarea
              id="goalsArea"
              className="border p-2 rounded-md w-full min-h-[80px] text-sm placeholder:text-xs placeholder:text-gray-400 dark:bg-neutral-900 dark:placeholder:text-neutral-500"
              placeholder="Describe your main goals..."
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
            />
          </div>

          <div className="grid w-full items-center gap-2">
            <Label htmlFor="knowledgeArea">Prior Knowledge</Label>
            <textarea
              id="knowledgeArea"
              className="border p-2 rounded-md w-full min-h-[60px] text-sm placeholder:text-xs placeholder:text-gray-400 dark:bg-neutral-900 dark:placeholder:text-neutral-500"
              placeholder="What do you already know?"
              value={priorKnowledge}
              onChange={(e) => setPriorKnowledge(e.target.value)}
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={onComplete}
            disabled={loading}
            className="mr-2 dark:bg-neutral-800 dark:hover:bg-neutral-700"
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <div className="flex items-center">
              <svg
                className="animate-spin h-5 w-5 mr-2 dark:text-black"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                ></circle>
                <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Generating...
              </div>
            ) : (
              <div className="flex items-center">
                <RiAiGenerate className="h-5 w-5 mr-2" />
                Generate Roadmap
              </div>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}