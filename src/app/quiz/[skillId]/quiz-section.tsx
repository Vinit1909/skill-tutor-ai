// app/quiz/[skillId]/quiz-section.tsx
"use client"

import React, { useState, useEffect } from "react"
import { useAuthContext } from "@/context/authcontext"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, XCircle, X, ChevronRight, ChevronDown, SquareStack, Loader } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getCompletedNodes, getQuizQuestions, saveQuizResult, Quiz } from "@/lib/quiz" // Import Quiz interface
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Select, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { SelectTrigger } from "@radix-ui/react-select"

interface QuizQuestion {
  type: "multiple-choice" | "fill-in-the-blank" | "matching"
  question: string
  options?: string[]
  pairs?: { term: string; definition: string }[]
  correctAnswer: string | { term: string; definition: string }[]
}

interface QuizSectionProps {
  skillId?: string
  skill: any
}

export default function QuizSection({ skillId, skill }: QuizSectionProps) {
  const { user } = useAuthContext()
  const [completedNodes, setCompletedNodes] = useState<string[]>([])
  const [nodeTitles, setNodeTitles] = useState<{ [key: string]: string }>({})
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [selectedType, setSelectedType] = useState<string>("multiple-choice")
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState<(string | { [term: string]: string })[]>([])
  const [quizId, setQuizId] = useState<string | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [showTypeSelection, setShowTypeSelection] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [quizHistory, setQuizHistory] = useState<any[]>([])
  const [currentInput, setCurrentInput] = useState<string>("")
  const [selectedResult, setSelectedResult] = useState<any | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (user?.uid && skillId) {
      setIsLoading(true)
      getCompletedNodes(user.uid, skillId).then((nodes) => {
        setCompletedNodes(nodes)
        fetchNodeTitles(nodes)
      }).catch(err => {
        console.error("Error fetching completed nodes:", err)
        toast({ title: "Error", description: "Failed to load completed topics", variant: "destructive" })
      })
      .finally(() => setIsLoading(false))
      fetchQuizHistory()
    }
  }, [user, skillId])

  const fetchNodeTitles = (nodeIds: string[]) => {
    if (!skill?.roadmapJSON?.nodes) return
    const titles = nodeIds.reduce((acc, id) => {
      const node = skill.roadmapJSON.nodes.flatMap((n: any) => n.children || []).find((c: any) => c.id === id)
      if (node) acc[id] = node.title
      return acc
    }, {} as { [key: string]: string })
    setNodeTitles(titles)
  }

  const fetchQuizHistory = async () => {
    if (!user?.uid || !skillId) return
    try {
      const quizResultsCollection = collection(db, "users", user.uid, "skillspaces", skillId, "quizResults")
      const quizResultsSnapshot = await getDocs(quizResultsCollection)
      const results = quizResultsSnapshot.docs.map((doc, index) => ({
        id: doc.id,
        number: index + 1,
        ...doc.data(),
      }))
      setQuizHistory(results)
    } catch (err) {
      console.error("Error fetching quiz history:", err)
      toast({ title: "Error", description: "Failed to load quiz history", variant: "destructive" })
    }
  }

  const toggleTopic = (nodeId: string) => {
    setSelectedTopics(prev =>
      prev.includes(nodeId) ? prev.filter(id => id !== nodeId) : [...prev, nodeId]
    )
  }

  const startQuiz = async () => {
    if (!user?.uid || !skillId || !selectedTopics.length) {
      toast({ title: "Oops!", description: "Select at least one topic!", variant: "destructive" })
      return
    }
    setIsLoading(true)
    try {
      const quizQuestions = await getQuizQuestions(user.uid, skillId, selectedTopics, selectedType)
      if (quizQuestions.length < 5) {
        toast({ title: "Not enough questions", description: `Only ${quizQuestions.length} ${selectedType} questions available`, variant: "destructive" })
        setIsLoading(false)
        return
      }
      setQuestions(quizQuestions.slice(0, 5))
      const quizCollection = collection(db, "users", user.uid, "skillspaces", skillId, "quizzes")
      const quizSnapshot = await getDocs(quizCollection)
      const latestQuiz = quizSnapshot.docs
        .map(doc => {
          const data = doc.data() as Omit<Quiz, 'id'>;
          return { id: doc.id, ...data };
        })
        .sort((a, b) => {
          const aSeconds = a.createdAt?.seconds || 0 // Fallback to 0 if undefined
          const bSeconds = b.createdAt?.seconds || 0
          return bSeconds - aSeconds // Latest first
        })[0]
      setQuizId(latestQuiz?.id || null)
      setCurrentQuestionIndex(0)
      setUserAnswers([])
      setShowResults(false)
    } catch (err: any) {
      console.error("Failed to start quiz:", err)
      toast({ title: "Error", description: err.message || "Failed to start quiz", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAnswer = (answer: string | { [term: string]: string }) => {
    const currentQuestion = questions[currentQuestionIndex]
    if (currentQuestion.type === "matching") {
      const currentAnswer = (userAnswers[currentQuestionIndex] || {}) as { [term: string]: string }
      const updatedAnswer = { ...currentAnswer, ...(answer as { [term: string]: string }) }
      setUserAnswers(prev => {
        const newAnswers = prev.length === 0 ? Array(questions.length).fill(null) : [...prev]
        newAnswers[currentQuestionIndex] = updatedAnswer
        return newAnswers
      })
    } else {
      setUserAnswers(prev => {
        const newAnswers = prev.length === 0 ? Array(questions.length).fill(null) : [...prev]
        newAnswers[currentQuestionIndex] = answer as string
        if (currentQuestionIndex < questions.length - 1) {
          setCurrentQuestionIndex(currentQuestionIndex + 1)
          setCurrentInput("")
        } else {
          setShowResults(true)
        }
        return newAnswers
      })
    }
  }

  const calculateScore = () => {
    return userAnswers.reduce((acc: number, answer, idx) => {
      const q = questions[idx]
      if (!q || idx >= questions.length) return acc
      if (q.type === "multiple-choice") {
        return acc + ((answer as string) === q.correctAnswer ? 1 : 0)
      } else if (q.type === "fill-in-the-blank") {
        return acc + ((answer as string)?.toLowerCase() === (q.correctAnswer as string)?.toLowerCase() ? 1 : 0)
      } else if (q.type === "matching") {
        const userPairs = answer as { [term: string]: string }
        const correctPairs = q.correctAnswer as { term: string; definition: string }[]
        const isCorrect = correctPairs.every(cp => userPairs[cp.term] === cp.definition) && 
                         Object.keys(userPairs).length === correctPairs.length &&
                         correctPairs.every(cp => Object.keys(userPairs).includes(cp.term))
        return acc + (isCorrect ? 1 : 0)
      }
      return acc
    }, 0)
  }

  const handleQuizSubmit = async () => {
    if (!user?.uid || !skillId || !quizId) return
    try {
      const score = calculateScore()
      await saveQuizResult(user.uid, skillId, quizId, selectedTopics, userAnswers, questions, selectedType)
      toast({ title: "Well Done!", description: `You scored ${score}/5!` })
      fetchQuizHistory()
      setQuestions([])
      setShowTypeSelection(false)
    } catch (err) {
      console.error("Error saving result:", err)
      toast({ title: "Error", description: "Failed to save result", variant: "destructive" })
    }
  }

  const isMatchingCorrect = (userAnswer: string | { [term: string]: string }, correctAnswer: string | { term: string; definition: string }[]): boolean => {
    const userPairs = userAnswer as { [term: string]: string }
    const correctPairs = correctAnswer as { term: string; definition: string }[]
    return correctPairs.every(cp => userPairs[cp.term] === cp.definition) && 
           Object.keys(userPairs).length === correctPairs.length &&
           correctPairs.every(cp => Object.keys(userPairs).includes(cp.term))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-neutral-800">
        <div className="text-md text-neutral-500 dark:text-neutral-400 flex gap-2 animate-pulse">
          <Loader className="animate-spin" />
        </div>
      </div>
    )
  }

  if (!completedNodes.length) {
    return (
      <div className="text-center text-neutral-500 dark:text-neutral-400 py-12">
        <p className="text-lg">Complete at least one section to unlock quizzes!</p>
      </div>
    )
  }

  const needsScrolling = quizHistory.length > 5

  return (
    <div className="w-full max-w-3xl mx-auto py-6 px-4">
      {!showTypeSelection && !questions.length ? (
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Take a Quiz</h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {completedNodes.map(nodeId => (
              <div
                key={nodeId}
                onClick={() => toggleTopic(nodeId)}
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                  selectedTopics.includes(nodeId)
                    ? "bg-neutral-100 rounded-xl dark:bg-neutral-700 border-2 border-neutral-400 dark:border-neutral-400"
                    : "rounded-xl bg-white dark:bg-[hsl(0,0%,18%)] border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                }`}
              >
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{nodeTitles[nodeId] || nodeId}</p>
              </div>
            ))}
          </div>
            <Button
            onClick={() => setShowTypeSelection(true)}
            disabled={!selectedTopics.length}
            className="w-full sm:w-auto bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-700 dark:hover:bg-neutral-600 dark:text-white"
            >
            Next
            </Button>
          {quizHistory.length > 0 && (
            <div className="mt-8 w-full">
            <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">Quiz History</h2>
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[hsl(0,0%,18%)]/10 overflow-hidden shadow-sm">
              {/* Header - visible on md screens and up */}
              <div className="hidden md:grid md:grid-cols-4 gap-4 p-4 bg-neutral-50 dark:bg-[hsl(0,0%,18%)]/10 text-sm font-medium text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800">
                <div>Quiz #</div>
                <div>Score</div>
                <div>Date</div>
                <div>Type</div>
              </div>

              {/* Scrollable content - fixed height for 5 rows */}
              <div
                className={`${
                  needsScrolling
                    ? "custom-scrollbar overflow-y-auto dark:bg-[hsl(0,0%,18%)]"
                    : ""
                }`}
                style={{
                  maxHeight: needsScrolling ? "285px" : "auto", // Height for 5 rows (5 * 57px)
                }}
              >
                {quizHistory.map((result) => (
                  <div
                    key={result.id}
                    onClick={() => setSelectedResult(result)}
                    className="group flex flex-col md:grid md:grid-cols-4 gap-2 md:gap-4 p-4 border-b last:border-b-0 border-neutral-200 dark:border-neutral-800 text-sm text-neutral-900 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800/80 transition-colors cursor-pointer"
                  >
                    {/* Mobile view - stacked layout */}
                    <div className="flex justify-between items-center md:hidden">
                      <div className="font-medium">Quiz #{result.number}</div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{result.score}/5</span>
                        <ChevronRight className="h-4 w-4 text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-neutral-100 transition-colors" />
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400 md:hidden">
                      <div>{new Date(result.timestamp.seconds * 1000).toLocaleDateString()}</div>
                      <div className="uppercase">{new String(result.quizType).replace(/-/g, " ")}</div>
                    </div>

                    {/* Desktop view - grid layout */}
                    <div className="hidden md:block">{result.number}</div>
                    <div className="hidden md:block font-medium">{result.score}/5</div>
                    <div className="hidden md:block">{new Date(result.timestamp.seconds * 1000).toLocaleDateString()}</div>
                    <div className="hidden md:block uppercase">{new String(result.quizType).replace(/-/g, " ")}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
         )}
        </div>
      ) : !questions.length ? (
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Choose Quiz Type</h1>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {["multiple-choice", "fill-in-the-blank", "matching"].map(type => (
              <div
                key={type}
                onClick={() => setSelectedType(type)}
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                  selectedType === type
                    ? "bg-neutral-100 rounded-xl dark:bg-neutral-700 border-2 border-neutral-400 dark:border-neutral-400"
                    : "bg-white rounded-xl dark:bg-[hsl(0,0%,18%)] border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                }`}
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{type.replace(/-/g, " ").toUpperCase()}</p>
                </div>
              </div>
            ))}
          </div>
          <Button
            onClick={startQuiz}
            disabled={isLoading}
            className="w-full sm:w-auto bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-700 dark:hover:bg-neutral-600"
          >
            {isLoading ? "Loading..." : "Start Quiz"}
          </Button>
        </div>
      ) : showResults ? (
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Your Results</h1>
          <div className="flex items-center justify-center gap-4">
            <p className="text-4xl font-bold text-neutral-900 dark:text-neutral-100">{calculateScore()}</p>
            <p className="text-lg text-neutral-500 dark:text-neutral-400">/ 5</p>
          </div>
          <div className="bg-white dark:bg-[hsl(0,0%,18%)] rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
            {questions.map((q, i) => (
              <div key={i} className="py-3 border-b border-neutral-200 dark:border-neutral-700 last:border-b-0">
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{q.question}</p>
                <div className="mt-2">
                  {q.type === "multiple-choice" && (
                    <p className={`${(userAnswers[i] as string) === q.correctAnswer ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} text-sm flex items-center gap-2`}>
                      <span>Your answer: {q.options![["a", "b", "c", "d"].indexOf(userAnswers[i] as string)]}</span>
                      {(userAnswers[i] as string) === q.correctAnswer ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    </p>
                  )}
                  {q.type === "fill-in-the-blank" && (
                    <p className={`${(userAnswers[i] as string)?.toLowerCase() === (q.correctAnswer as string)?.toLowerCase() ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} text-sm flex items-center gap-2`}>
                      <span>Your answer: {userAnswers[i] as string}</span>
                      {(userAnswers[i] as string)?.toLowerCase() === (q.correctAnswer as string)?.toLowerCase() ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    </p>
                  )}
                  {q.type === "matching" && (
                    <p className={`${isMatchingCorrect(userAnswers[i], q.correctAnswer) ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} text-sm flex items-center gap-2`}>
                      <span>Your matches: {Object.entries(userAnswers[i] as { [term: string]: string }).map(([term, def]) => `${term}: ${def}`).join(", ")}</span>
                      {isMatchingCorrect(userAnswers[i], q.correctAnswer) ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    </p>
                  )}
                  {(q.type === "multiple-choice" && (userAnswers[i] as string) !== q.correctAnswer) ||
                   (q.type === "fill-in-the-blank" && (userAnswers[i] as string)?.toLowerCase() !== (q.correctAnswer as string)?.toLowerCase()) ||
                   (q.type === "matching" && !isMatchingCorrect(userAnswers[i], q.correctAnswer)) ? (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                      Correct: {q.type === "multiple-choice" 
                        ? q.options![["a", "b", "c", "d"].indexOf(q.correctAnswer as string)] 
                        : q.type === "matching" 
                          ? (q.correctAnswer as { term: string; definition: string }[]).map(cp => `${cp.term}: ${cp.definition}`).join(", ")
                          : String(q.correctAnswer)}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 justify-center">
            <Button onClick={handleQuizSubmit} className="bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-700 dark:hover:bg-neutral-600">Save Results</Button>
            <Button variant="outline" onClick={() => setQuestions([])}>Try Again</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[hsl(0,0%,18%)] rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
            <Progress value={(currentQuestionIndex + 1) / questions.length * 100} className="mb-4" />
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">Question {currentQuestionIndex + 1} of {questions.length}</p>
            <p className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">{questions[currentQuestionIndex].question}</p>
            {questions[currentQuestionIndex].type === "multiple-choice" && (
              <div className="grid grid-cols-1 gap-2">
                {questions[currentQuestionIndex].options!.map((opt, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    onClick={() => handleAnswer(opt.split(".")[0].trim())}
                    className="w-full text-left justify-start border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            )}
            {questions[currentQuestionIndex].type === "fill-in-the-blank" && (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && currentInput.trim()) handleAnswer(currentInput.trim()) }}
                  className="w-full p-2 border rounded border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  placeholder="Type your answer..."
                />
                <Button
                  onClick={() => currentInput.trim() && handleAnswer(currentInput.trim())}
                  disabled={!currentInput.trim()}
                  className="self-end bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-700 dark:hover:bg-neutral-600"
                >
                  Submit
                </Button>
              </div>
            )}
            {questions[currentQuestionIndex].type === "matching" && (
              <div className="space-y-3">
                {questions[currentQuestionIndex].pairs!.map((pair, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-neutral-900 dark:text-neutral-100 w-1/3 truncate">{pair.term}</span>
                    <Select>
                      <SelectTrigger className="w-2/3 p-2 border rounded-xl border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-neutral-100">
                        <div className="flex justify-between items-center gap-2">
                          <SelectValue placeholder="Select" />
                          <ChevronDown className="h-4 w-4 text-neutral-400" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-neutral-800 rounded-xl">
                        {questions[currentQuestionIndex].pairs!.map(p => (
                          <SelectItem className="hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl" key={p.definition} value={p.definition}>
                            {p.definition}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <Button
                  onClick={() => {
                    const currentAnswer = userAnswers[currentQuestionIndex] as { [term: string]: string }
                    if (currentAnswer && questions[currentQuestionIndex].pairs!.every(pair => currentAnswer[pair.term])) {
                      if (currentQuestionIndex < questions.length - 1) {
                        setCurrentQuestionIndex(currentQuestionIndex + 1)
                      } else {
                        setShowResults(true)
                      }
                    } else {
                      toast({ title: "Incomplete", description: "Please match all pairs!" })
                    }
                  }}
                  className="w-full mt-4 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-700 dark:hover:bg-neutral-600"
                >
                  {currentQuestionIndex < questions.length - 1 ? "Next" : "Finish"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal for detailed quiz results */}
      {selectedResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[hsl(0,0%,18%)] rounded-lg border border-neutral-200 dark:border-neutral-700 custom-scrollbar w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6 relative">
            <button
              onClick={() => setSelectedResult(null)}
              className="absolute top-4 right-4 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Quiz #{selectedResult.number} Results</h2>
            <div className="flex items-center justify-center gap-4 mb-4">
              <p className="text-4xl font-bold text-neutral-900 dark:text-neutral-100">{selectedResult.score}</p>
              <p className="text-lg text-neutral-500 dark:text-neutral-400">/ 5</p>
            </div>
            <div className="space-y-4">
              {selectedResult.questions.map((q: QuizQuestion, i: number) => (
                <div key={i} className="py-3 border-b border-neutral-200 dark:border-neutral-700 last:border-b-0">
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{q.question}</p>
                  <div className="mt-2">
                    {q.type === "multiple-choice" && (
                      <p className={`${(selectedResult.userAnswers[i] as string) === q.correctAnswer ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} text-sm flex items-center gap-2`}>
                        <span>Your answer: {q.options![["a", "b", "c", "d"].indexOf(selectedResult.userAnswers[i] as string)]}</span>
                        {(selectedResult.userAnswers[i] as string) === q.correctAnswer ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      </p>
                    )}
                    {q.type === "fill-in-the-blank" && (
                      <p className={`${(selectedResult.userAnswers[i] as string)?.toLowerCase() === (q.correctAnswer as string)?.toLowerCase() ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} text-sm flex items-center gap-2`}>
                        <span>Your answer: {selectedResult.userAnswers[i] as string}</span>
                        {(selectedResult.userAnswers[i] as string)?.toLowerCase() === (q.correctAnswer as string)?.toLowerCase() ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      </p>
                    )}
                    {q.type === "matching" && (
                      <p className={`${isMatchingCorrect(selectedResult.userAnswers[i], q.correctAnswer) ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} text-sm flex items-center gap-2`}>
                        <span>Your matches: {Object.entries(selectedResult.userAnswers[i] as { [term: string]: string }).map(([term, def]) => `${term}: ${def}`).join(", ")}</span>
                        {isMatchingCorrect(selectedResult.userAnswers[i], q.correctAnswer) ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      </p>
                    )}
                    {(q.type === "multiple-choice" && (selectedResult.userAnswers[i] as string) !== q.correctAnswer) ||
                     (q.type === "fill-in-the-blank" && (selectedResult.userAnswers[i] as string)?.toLowerCase() !== (q.correctAnswer as string)?.toLowerCase()) ||
                     (q.type === "matching" && !isMatchingCorrect(selectedResult.userAnswers[i], q.correctAnswer)) ? (
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                        Correct: {q.type === "multiple-choice" 
                          ? q.options![["a", "b", "c", "d"].indexOf(q.correctAnswer as string)] 
                          : q.type === "matching" 
                            ? (q.correctAnswer as { term: string; definition: string }[]).map(cp => `${cp.term}: ${cp.definition}`).join(", ")
                            : String(q.correctAnswer)}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}