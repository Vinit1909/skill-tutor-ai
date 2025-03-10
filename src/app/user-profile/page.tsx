"use client"

import { useState, useEffect } from "react"
import { useAuthContext } from "@/context/authcontext"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import {
  AlignStartHorizontal,
  ArrowRight,
  ArrowUpNarrowWide,
  Asterisk,
  Award,
  BarChart3,
  BookOpen,
  ChartBarBig,
  FlagTriangleRight,
  Flame,
  LineChartIcon,
  ListChecks,
  Loader,
  Orbit,
  PieChartIcon,
  ShieldMinus,
  ShieldPlus,
  UserCircle2,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip,
  Label,
} from "recharts"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import UserProfileBadge from "@/components/user-profile-badge"
import { ShineBorder } from "@/components/magicui/shine-border"
import { Separator } from "@/components/ui/separator"

interface SkillProgress {
  skillId: string
  name: string
  completedNodes: number
  totalNodes: number
  completionPercentage: number
}

interface QuizResult {
  skillId: string
  score: number
  quizType: string
  timestamp: { seconds: number }
  timeToComplete?: number
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
]

const chartConfig = {
  value: { label: "Progress" },
  score: { label: "Score" },
  "multiple-choice": { label: "Multiple Choice", color: "hsl(var(--primary))" },
  "fill-in-the-blank": { label: "Fill in the Blank", color: "hsl(var(--chart-2))" },
  matching: { label: "Matching", color: "hsl(var(--chart-3))" },
} as const

export default function UserProfileDashboard() {
  const { user } = useAuthContext()
  const [skillProgress, setSkillProgress] = useState<SkillProgress[]>([])
  const [quizResults, setQuizResults] = useState<QuizResult[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
    if (!user?.uid) return
    fetchDashboardData()
  }, [user])

  const fetchDashboardData = async () => {
    if (!user?.uid) return
    setLoading(true)
    try {
      const skillspacesRef = collection(db, "users", user.uid, "skillspaces")
      const skillspacesSnap = await getDocs(skillspacesRef)
      const skillsData: SkillProgress[] = skillspacesSnap.docs
        .map((doc) => {
          const skillId = doc.id
          const skillData = doc.data()
          const nodes = skillData.roadmapJSON?.nodes?.flatMap((n: any) => n.children || []) || []
          const completedNodes = nodes.filter((n: any) => n.status === "COMPLETED").length
          const totalNodes = nodes.length
          return {
            skillId,
            name: skillData.name || "Unnamed Skill",
            completedNodes,
            totalNodes,
            completionPercentage: totalNodes ? (completedNodes / totalNodes) * 100 : 0,
          }
        })
        .sort((a, b) => b.completionPercentage - a.completionPercentage) // Sort descending
      setSkillProgress(skillsData)

      const quizResultsData: QuizResult[] = []
      for (const skillDoc of skillspacesSnap.docs) {
        const skillId = skillDoc.id
        const resultsRef = collection(db, "users", user.uid, "skillspaces", skillId, "quizResults")
        const resultsSnap = await getDocs(resultsRef)
        resultsSnap.docs.forEach((doc) => {
          const data = doc.data()
          quizResultsData.push({
            skillId,
            score: data.score,
            quizType: data.quizType,
            timestamp: data.timestamp,
            timeToComplete: data.timeToComplete,
          })
        })
      }
      setQuizResults(quizResultsData.sort((a, b) => a.timestamp.seconds - b.timestamp.seconds))
    } catch (err) {
      console.error("Error fetching dashboard data:", err)
      toast({ title: "Error", description: "Failed to load dashboard data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // Aggregated Stats
  const totalSkills = skillProgress.length
  const totalCompletedNodes = skillProgress.reduce((acc, s) => acc + s.completedNodes, 0)
  const totalNodes = skillProgress.reduce((acc, s) => acc + s.totalNodes, 0)
  const overallCompletion = totalNodes ? ((totalCompletedNodes / totalNodes) * 100).toFixed(1) : "0.0"
  const avgQuizScore = quizResults.length
    ? (quizResults.reduce((acc, r) => acc + r.score, 0) / quizResults.length).toFixed(1)
    : "N/A"
  const highestQuizScore = quizResults.length ? Math.max(...quizResults.map((r) => r.score)) : "N/A"
  const lowestQuizScore = quizResults.length ? Math.min(...quizResults.map((r) => r.score)) : "N/A"
  const quizAttempts = quizResults.length
  const quizTypeDistribution = quizResults.reduce(
    (acc, r) => {
      acc[r.quizType] = (acc[r.quizType] || 0) + 1
      return acc
    },
    {} as { [key: string]: number },
  )

  // Per-skill quiz stats
  const skillQuizStats = skillProgress
    .map((skill) => {
      const skillQuizzes = quizResults.filter((q) => q.skillId === skill.skillId)
      return {
        name: skill.name,
        avgScore: skillQuizzes.length
          ? (skillQuizzes.reduce((acc, q) => acc + q.score, 0) / skillQuizzes.length).toFixed(1)
          : "N/A",
        attempts: skillQuizzes.length,
      }
    })
    .sort((a, b) => (b.avgScore === "N/A" ? -1 : Number(b.avgScore)) - (a.avgScore === "N/A" ? -1 : Number(a.avgScore)))

  // Additional Metrics
  const recentActivity = quizResults
    .slice(-5)
    .reverse()
    .map((quiz) => {
      const skillName = skillProgress.find((s) => s.skillId === quiz.skillId)?.name || "Unknown Skill"
      return {
        skillName,
        quizType: quiz.quizType.replace(/-/g, " "),
        score: quiz.score,
        date: new Date(quiz.timestamp.seconds * 1000).toLocaleDateString(),
      }
    })

  // Calculate learning streaks (days with consecutive activity)
  const quizDates = quizResults.map((q) => new Date(q.timestamp.seconds * 1000).toDateString())
  const uniqueDates = [...new Set(quizDates)]
  const currentStreak = uniqueDates.length ? 1 : 0 // Simplified for demo - would need more logic for actual streaks

  // Calculate average time per quiz if available
  const quizzesWithTime = quizResults.filter((q) => q.timeToComplete)
  const avgQuizTime = quizzesWithTime.length
    ? Math.round(quizzesWithTime.reduce((acc, q) => acc + (q.timeToComplete || 0), 0) / quizzesWithTime.length)
    : null

  // Interesting Facts
  const topFinishedSkills = skillProgress.slice(0, 5)
  const mostVisitedSkills = skillQuizStats.sort((a, b) => b.attempts - a.attempts).slice(0, 5)

  // Skill strengths and weaknesses
  const strengths = skillQuizStats
    .filter((s) => s.avgScore !== "N/A" && Number(s.avgScore) >= 4)
    .slice(0, 3)
    .map((s) => s.name)

  const weaknesses = skillQuizStats
    .filter((s) => s.avgScore !== "N/A" && Number(s.avgScore) < 3)
    .slice(0, 3)
    .map((s) => s.name)

  if (loading) {
    return (
        <div className="flex text-neutral-500 dark:text-neutral-400 gap-2 items-center justify-center h-screen">
            <Loader className=" animate-spin"/> Loading Profile
        </div>
    )
  }

  if (!user)
    return (
      <div className="flex flex-col items-center justify-center h-[70vh]">
        <UserCircle2 className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-medium text-muted-foreground">Please sign in to view your profile</h3>
      </div>
    )

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/20 dark:bg-neutral-800/70 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-700">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Orbit className="h-6 w-6 text-[#6c63ff] dark:text-[#7a83ff]" />
                <h2 className="text-xl font-semibold text-neutral-700 dark:text-neutral-300">SkillSpace</h2>
            </div>

            <div className="flex items-center gap-3">
              <UserProfileBadge />
            </div>
          </div>
      </header>
      <div className="w-full max-w-7xl mx-auto p-6 lg:p-8 pb-16">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{user?.displayName ? `${user.displayName.split(" ")[0]}'s Profile` : "User Profile"}</h1>
            <p className="text-muted-foreground mt-1">Track your progress and performance across all skills</p>
          </div>
          <Badge variant="outline" className="relative hidden dark:bg-neutral-700 rounded-xl md:flex items-center gap-1 px-3 py-1.5 text-sm">
            <ShineBorder shineColor={["#A0A0A0", "#B0B0B0", "#C0C0C0"]}/>
            <Flame className="h-6 w-6 text-primary text-orange-400 dark:text-orange-400" />
            Learning streak: {currentStreak} day{currentStreak !== 1 ? "s" : ""}
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="dark:bg-[hsl(0,0%,18%)]">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">

            {/* Key metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card className="hover:shadow-lg dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700 dark:hover:shadow-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary text-green-400 dark:text-green-500" />
                    Overall Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto custom-scrollbar">
                  <div className="flex flex-col gap-2 mt-2 mb-1">
                    <div className="flex items-end justify-between">
                      <span className="text-3xl font-bold">{overallCompletion}%</span>
                      <span className="text-sm text-muted-foreground">
                        {totalCompletedNodes} / {totalNodes} nodes
                      </span>
                    </div>
                    <Progress value={Number(overallCompletion)} className="h-2" />
                  </div>
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground pt-0">
                  {Number(overallCompletion) < 50 ? "Keep going! You're making progress" : "You're doing great!"}
                </CardFooter>
              </Card>

              <Card className="hover:shadow-lg dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700 dark:hover:shadow-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Award className="h-4 w-4 text-primary dark:text-amber-400 text-amber-500" />
                    Quiz Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto custom-scrollbar">
                  <div className="grid grid-cols-3 place-items-center gap-4 mt-2">
                    <div className="flex flex-col items-center">
                      <span className="text-3xl font-bold">{avgQuizScore}</span>
                      <span className="text-xs text-muted-foreground">Avg. Score</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-3xl font-bold">{highestQuizScore}</span>
                      <span className="text-xs text-muted-foreground">Highest</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-3xl font-bold">{quizAttempts}</span>
                      <span className="text-xs text-muted-foreground">Attempts</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground pt-0">
                  {avgQuizTime ? `Avg. completion time: ${avgQuizTime} seconds` : "Take more quizzes to build your stats"}
                </CardFooter>
              </Card>

              <Card className="hover:shadow-lg dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700 dark:hover:shadow-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary dark:text-blue-400 text-blue-500" />
                    Skills Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto custom-scrollbar">
                  <div className="flex justify-center items-center gap-4 mt-1">
                    <div className="flex flex-col items-center">
                      <span className="text-3xl font-bold">{totalSkills}</span>
                      <span className="text-xs text-muted-foreground">Total Skills</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="text-xs justify-center">
                  <div className="flex gap-4">
                      {topFinishedSkills.slice(0, 3).map((skill, i) => (
                        <div key={i} className="flex items-center mb-1.5">
                          <Badge className="text-xs truncate dark:bg-neutral-700 bg-neutral-100 text-neutral-500 dark:text-neutral-300 pt-0 hover:bg-neutral-100 dark:hover:bg-neutral-700" title={skill.name}>
                            {skill.name}
                          </Badge>
                        </div>
                      ))}
                  </div>
                </CardFooter>
              </Card>
            </div>

            {/* Recent Activity and Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <Card className="hover:shadow-lg dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700 dark:hover:shadow-xl">
                <CardHeader>
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <LineChartIcon className="h-4 w-4 text-primary dark:text-emerald-400 text-emerald-500" />
                    Quiz Score Trend
                  </CardTitle>
                  <CardDescription>Your performance over time</CardDescription>
                </CardHeader>
                <CardContent className="pt-2 overflow-x-auto custom-scrollbar">
                  <ChartContainer config={chartConfig} className="h-[220px]">
                    <ResponsiveContainer>
                      <LineChart
                        data={quizResults.map((q, i) => ({
                          name: `Quiz ${i + 1}`,
                          score: q.score,
                          skillName: skillProgress.find((s) => s.skillId === q.skillId)?.name || "Unknown",
                        }))}
                        margin={{ top: 10, right: 10, left: -15, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 12 }}
                          stroke="hsl(var(--muted-foreground))"
                          axisLine={{ stroke: "hsl(var(--border))" }}
                        />
                        <YAxis
                          domain={[0, 5]}
                          stroke="hsl(var(--muted-foreground))"
                          axisLine={{ stroke: "hsl(var(--border))" }}
                          tickLine={{ stroke: "hsl(var(--border))" }}
                        />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value, name, props) => {
                                if (!props?.payload) return ""
                                return `${props.payload.skillName} - ${typeof props.name === "string" ? props.name : ""}: ${value}/5`
                              }}
                            />
                          }
                        />
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke="hsl(var(--chart-2))"
                          strokeWidth={2}
                          dot={{ stroke: "hsl(var(--chart-2))", strokeWidth: 2, r: 4, fill: "hsl(var(--background))" }}
                          activeDot={{
                            stroke: "hsl(var(--chart-2))",
                            strokeWidth: 2,
                            r: 6,
                            fill: "hsl(var(--background))",
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700 dark:hover:shadow-xl">
                <CardHeader>
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-primary text-lime-500 dark:text-lime-400" />
                    Recent Activity
                  </CardTitle>
                  <CardDescription>Your latest quiz attempts</CardDescription>
                </CardHeader>
                <CardContent className="pt-2 overflow-x-auto custom-scrollbar">
                  <div className="space-y-4">
                    {recentActivity.length > 0 ? (
                      recentActivity.map((activity, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between border-b pb-3 last:border-b-0 dark:border-neutral-700 border-neutral-200 last:pb-0"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{activity.skillName}</span>
                            <span className="text-xs text-muted-foreground capitalize">{activity.quizType}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-neutral-500 dark:text-neutral-400">{activity.date}</span>
                            <Badge
                              className={cn(
                                "text-xs font-medium bg-lime-500 dark:bg-lime-400 text-white dark:text-black hover:bg-lime-500 dark:hover:bg-lime-400 rounded-full px-2 py-1",
                              )}
                              // variant={activity.score >= 4 ? "default" : activity.score >= 3 ? "secondary" : "outline"}
                            >
                              {activity.score}/5
                            </Badge>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">No recent quiz activity</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="skills" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="hover:shadow-lg dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700 dark:hover:shadow-xl">
                <CardHeader>
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                      <FlagTriangleRight className="h-4 w-4 text-primary dark:text-cyan-400 text-cyan-500" />
                      Skill Progress
                  </CardTitle>
                  <CardDescription>Progress across all your skills</CardDescription>
                </CardHeader>
                <CardContent className="-ml-28 pt-2 flex justify-center overflow-x-auto custom-scrollbar">
                  <ChartContainer config={chartConfig} className="h-[300px] w-full max-w-lg">
                    <ResponsiveContainer>
                      <BarChart
                        data={skillProgress.map((s) => ({
                          name: s.name,
                          value: s.completionPercentage,
                        }))}
                        layout="vertical"
                        margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} stroke="hsl(var(--border))" />
                        <XAxis
                          type="number"
                          domain={[0, 100]}
                          stroke="hsl(var(--muted-foreground))"
                          tickFormatter={(value) => `${value}%`}
                          axisLine={{ stroke: "hsl(var(--border))" }}
                        />
                        <YAxis
                          dataKey="name"
                          type="category"
                          width={100}
                          tick={{ fontSize: 12 }}
                          stroke="hsl(var(--muted-foreground))"
                          axisLine={{ stroke: "hsl(var(--border))" }}
                        />
                        <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${Number(value).toFixed(1)}%`} />} />
                        <Bar dataKey="value" fill="hsl(188.7 94.5% 42.7%)" radius={[0, 4, 4, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              <div className="flex flex-col gap-6">
                <Card className="hover:shadow-lg dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700 dark:hover:shadow-xl">
                  <CardHeader>
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                      <ShieldPlus className="h-4 w-4 text-primary dark:text-green-400 text-green-500" />
                      Strengths
                  </CardTitle>
                    <CardDescription>Skills where you excel</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {strengths.length > 0 ? (
                      <div className="space-y-3">
                        {strengths.map((skill, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center">
                              <ArrowRight className="h-4 w-4" />
                            </div>
                            <span>{skill}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        Complete more quizzes to identify your strengths
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700 dark:hover:shadow-xl">
                  <CardHeader>
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      <ShieldMinus className="h-4 w-4 text-primary dark:text-red-400 text-red-500" />
                      Areas for Improvement
                  </CardTitle>
                    <CardDescription>Focus on these skills to progress</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {weaknesses.length > 0 ? (
                      <div className="space-y-3">
                        {weaknesses.map((skill, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center">
                              <ArrowRight className="h-4 w-4" />
                            </div>
                            <span>{skill}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">No specific weaknesses identified yet</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="quizzes" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="hover:shadow-lg dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700 dark:hover:shadow-xl">
                <CardHeader>
                <CardTitle className="text-base font-medium flex items-center gap-2">
                    <ChartBarBig className="h-4 w-4 dark:text-emerald-400 text-emerald-500" />
                      Quiz Performance by Skill
                  </CardTitle>
                  <CardDescription>Average scores across skills</CardDescription>
                </CardHeader>
                <CardContent className="pt-2 overflow-x-auto custom-scrollbar">
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <ResponsiveContainer>
                      <BarChart
                        data={skillQuizStats
                          .filter((s) => s.avgScore !== "N/A")
                          .map((s) => ({
                            name: s.name,
                            value: Number(s.avgScore),
                          }))}
                        margin={{ top: 10, right: 10, left: -15, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 12 }}
                          stroke="hsl(var(--muted-foreground))"
                          axisLine={{ stroke: "hsl(var(--border))" }}
                        />
                        <YAxis
                          domain={[0, 5]}
                          stroke="hsl(var(--muted-foreground))"
                          axisLine={{ stroke: "hsl(var(--border))" }}
                          tickLine={{ stroke: "hsl(var(--border))" }}
                        />
                        <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${value}/5`} />} />
                        <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[10, 10, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700 dark:hover:shadow-xl">
                <CardHeader>
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <PieChartIcon className="h-4 w-4 dark:text-orange-400 text-orange-500" />
                    Quiz Types
                  </CardTitle>
                  <CardDescription>Distribution of quiz formats</CardDescription>
                </CardHeader>
                <CardContent className="pt-2 overflow-x-auto custom-scrollbar">
                  <ChartContainer
                    config={chartConfig}
                    className="mx-auto aspect-square max-h-[250px]"
                  >
                    <PieChart>
                      <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                      <Pie
                        data={Object.entries(quizTypeDistribution).map(([name, value]) => ({
                          name: name.replace(/-/g, " "),
                          quizzes: value,
                        }))}
                        dataKey="quizzes"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        strokeWidth={5}
                      >
                        <Label
                          content={({ viewBox }) => {
                            if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                              return (
                                <text
                                  x={viewBox.cx}
                                  y={viewBox.cy}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                >
                                  <tspan
                                    x={viewBox.cx}
                                    y={viewBox.cy}
                                    className="fill-foreground text-3xl font-bold"
                                  >
                                    {quizAttempts.toLocaleString()}
                                  </tspan>
                                  <tspan
                                    x={viewBox.cx}
                                    y={(viewBox.cy || 0) + 24}
                                    className="fill-muted-foreground"
                                  >
                                    Quizzes
                                  </tspan>
                                </text>
                              )
                            }
                            return null
                          }}
                        />
                        {Object.entries(quizTypeDistribution).map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                            stroke="hsl(var(--background))"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="insights" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="hover:shadow-lg dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700 dark:hover:shadow-xl">
                <CardHeader>
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <AlignStartHorizontal className="h-4 w-4 dark:text-amber-400 text-amber-500" />
                      Top Finished Skills
                  </CardTitle>
                  <CardDescription>Your most completed learning paths</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto custom-scrollbar">
                  <div className="space-y-4">
                    {topFinishedSkills.length > 0 ? (
                      topFinishedSkills.map((skill, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium",
                                i === 0
                                  ? "bg-yellow-500 text-primary-foreground"
                                  : i === 1
                                    ? "bg-zinc-400 text-primary-foreground"
                                    : i === 2
                                      ? "bg-amber-600 text-primary-foreground"
                                      : "bg-muted text-muted-foreground",
                              )}
                            >
                              {i + 1}
                            </div>
                            <span className="font-medium">{skill.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={skill.completionPercentage} className="h-2 w-24" />
                            <span className="text-sm w-12 text-right">{skill.completionPercentage.toFixed(1)}%</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">No completed skills yet</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700 dark:hover:shadow-xl">
                <CardHeader>
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <ArrowUpNarrowWide className="h-4 w-4 dark:text-rose-400 text-rose-500" />
                      Most Practiced Skills
                  </CardTitle>
                  <CardDescription>Based on quiz attempts</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto custom-scrollbar">
                  <div className="space-y-4">
                    {mostVisitedSkills.length > 0 ? (
                      mostVisitedSkills.map((skill, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center">
                              <span className="text-sm font-medium">{i + 1}</span>
                            </div>
                            <div>
                              <p className="font-medium">{skill.name}</p>
                              <p className="text-xs text-muted-foreground">Avg. score: {skill.avgScore}/5</p>
                            </div>
                          </div>
                          <Badge variant="outline">
                            {skill.attempts} quiz{skill.attempts !== 1 ? "zes" : ""}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">No quiz attempts yet</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-6 hover:shadow-lg dark:bg-[hsl(0,0%,18%)] dark:border-neutral-700 dark:hover:shadow-xl">
              <CardHeader>
                <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Asterisk className="h-4 w-4 dark:text-cyan-400 text-cyan-500" />
                      Learning Patterns
                  </CardTitle>
                <CardDescription>Analysis of your learning habits</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto custom-scrollbar">
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-2 bg-neutral-100 dark:bg-neutral-700 rounded-xl p-4">
                    <h3 className="text-sm font-medium">Completion Rate</h3>
                    <div className="flex items-center gap-2">
                      <div className="h-12 w-12 rounded-full flex items-center justify-center">
                        <span className="text-lg font-bold text-primary">{overallCompletion}%</span>
                      </div>
                      <div>
                        <Separator orientation="vertical" className="h-8 mx-2 " />
                      </div>
                      <div className="text-sm">
                        <p>Overall completion across all skills</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {Number(overallCompletion) < 30
                            ? "Just starting out"
                            : Number(overallCompletion) < 60
                              ? "Making good progress"
                              : "Well on your way to mastery"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 bg-neutral-100 dark:bg-neutral-700 rounded-xl p-4">
                    <h3 className="text-sm font-medium">Quiz Performance</h3>
                    <div className="flex items-center gap-2">
                      <div className="h-12 w-12 flex items-center justify-center">
                        <span className="text-lg font-bold text-primary">{avgQuizScore}</span>
                      </div>
                      <div>
                        <Separator orientation="vertical" className="h-8 mx-2 " />
                      </div>
                      <div className="text-sm">
                        <p>Average quiz score (out of 5)</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {avgQuizScore === "N/A"
                            ? "Not enough data"
                            : Number(avgQuizScore) < 3
                              ? "Room for improvement"
                              : Number(avgQuizScore) < 4
                                ? "Good understanding"
                                : "Excellent comprehension"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 bg-neutral-100 dark:bg-neutral-700 rounded-xl p-4">
                    <h3 className="text-sm font-medium">Learning Activity</h3>
                    <div className="flex items-center gap-2">
                      <div className="h-12 w-12 flex items-center justify-center">
                        <span className="text-lg font-bold text-primary">{quizAttempts}</span>
                      </div>
                      <div>
                        <Separator orientation="vertical" className="h-8 mx-2" />
                      </div>
                      <div className="text-sm">
                        <p>Total quiz attempts</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {quizAttempts === 0
                            ? "Time to start practicing!"
                            : quizAttempts < 5
                              ? "Keep practicing to improve"
                              : "Consistent practice habit"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
