"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WandSparkles } from "lucide-react";
import { RiAiGenerate } from "react-icons/ri";
import { FaHatWizard } from "react-icons/fa6";

interface OnboardingWizardProps {
  skillName: string;
  uid: string;
  skillId: string;
  onComplete: () => void;
}

export default function OnboardingWizard({
  skillName,
  uid,
  skillId,
  onComplete
}: OnboardingWizardProps) {
  const [level, setLevel] = useState("");
  const [goals, setGoals] = useState("");
  const [priorKnowledge, setPriorKnowledge] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/generate-roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid,
          skillId,
          level,
          goals,
          priorKnowledge,
        }),
      });
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }
      onComplete();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
      <Card className="w-[400px] max-h-[90vh] overflow-auto">
        <CardHeader>
          <CardTitle><div className="flex gap-2"><WandSparkles className="h-4 w-4"/>Hi I'm your {skillName} Wizard</div></CardTitle>
          <CardDescription>
            Let's create a tailored roadmap for you!
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
                <SelectValue placeholder={<span className="text-xs text-gray-500">Select your level</span>} />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="Beginner">Beginner</SelectItem>
                <SelectItem value="Intermediate">Intermediate</SelectItem>
                <SelectItem value="Advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid w-full items-center gap-2">
            <Label htmlFor="goalsArea">Your Goals</Label>
            <textarea
              id="goalsArea"
              className="border p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 w-full min-h-[80px] text-sm placeholder:text-xs placeholder:text-gray-400"
              placeholder="Describe your main goals..."
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
            />
          </div>

          <div className="grid w-full items-center gap-2">
            <Label htmlFor="knowledgeArea">Prior Knowledge</Label>
            <textarea
              id="knowledgeArea"
              className="border p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 w-full min-h-[60px] text-sm placeholder:text-xs placeholder:text-gray-400"
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
            className="mr-2"
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <div className="flex items-center">
                <svg
                  className="animate-spin h-5 w-5 mr-2 text-white"
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
  );
}