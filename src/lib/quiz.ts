// src/lib/quiz.ts
import { collection, doc, getDoc, getDocs, setDoc, Timestamp } from "firebase/firestore"
import { db } from "./firebase"
import { getSkillSpace } from "./skillspace"

interface RoadmapNode {
  id: string
  children?: RoadmapChild[]
}

interface RoadmapChild {
  id: string
  status: string
}

export interface QuizQuestion {
  type: "multiple-choice" | "fill-in-the-blank" | "matching"
  question: string
  options?: string[]
  pairs?: { term: string; definition: string }[]
  correctAnswer: string | { term: string; definition: string }[]
}

export interface Quiz {
  nodeIds: string[]
  questions: QuizQuestion[]
  createdAt: Timestamp
}

export interface QuizResult {
  quizId: string
  nodeIds: string[]
  userAnswers: (number | string | { [term: string]: string })[]
  score: number
  timestamp: Timestamp
  quizType: string
  questions: QuizQuestion[]
}

export async function getCompletedNodes(uid: string, skillId: string): Promise<string[]> {
  const skill = await getSkillSpace(uid, skillId)
  if (!skill?.roadmapJSON?.nodes) return []
  return skill.roadmapJSON.nodes
    .flatMap((node: RoadmapNode) => node.children || [])
    .filter((child: RoadmapChild) => child.status === "COMPLETED")
    .map((child: RoadmapChild) => child.id)
}

export async function generateQuizQuestions(uid: string, skillId: string, nodeIds: string[]): Promise<Quiz & { id: string }> {
  const skill = await getSkillSpace(uid, skillId)
  if (!skill) throw new Error("Skill not found")

  const response = await fetch("/api/quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid, skillId, nodeIds }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    console.error("API /quiz failed:", errorData.error)
    throw new Error(errorData.error || "Failed to generate questions")
  }

  const questions: QuizQuestion[] = await response.json()
  console.log("Generated questions:", questions)

  const quiz = {
    nodeIds,
    questions,
    createdAt: Timestamp.now(),
  }

  const quizRef = doc(collection(db, "users", uid, "skillspaces", skillId, "quizzes"))
  await setDoc(quizRef, quiz)
  return { ...quiz, id: quizRef.id }
}

export async function getQuizQuestions(uid: string, skillId: string, nodeIds: string[], type: string): Promise<QuizQuestion[]> {
  const quizCollection = collection(db, "users", uid, "skillspaces", skillId, "quizzes")
  const quizResultsCollection = collection(db, "users", uid, "skillspaces", skillId, "quizResults")
  const quizSnapshot = await getDocs(quizCollection)
  const resultsSnapshot = await getDocs(quizResultsCollection)

  const quizzes = quizSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Quiz & { id: string }))
    .filter(quiz => nodeIds.every(id => quiz.nodeIds.includes(id)))
  const results = resultsSnapshot.docs
    .map(doc => doc.data() as QuizResult)
    .filter(result => nodeIds.every(id => result.nodeIds.includes(id)) && type === result.quizId.split("-")[0]) // Assuming quizId format like "multiple-choice-..."

  let allQuestions = quizzes.flatMap(quiz => quiz.questions.filter(q => q.type === type))
  const attemptCount = results.length

  if (allQuestions.length < 5 || attemptCount >= 5) {
    console.log(`Regenerating questions: attempts=${attemptCount}, existing=${allQuestions.length}`)
    const newQuiz = await generateQuizQuestions(uid, skillId, nodeIds)
    allQuestions = newQuiz.questions.filter(q => q.type === type)
  } else if (attemptCount >= 2) {
    console.log(`Shuffling questions: attempts=${attemptCount}`)
    allQuestions = shuffleArray(allQuestions)
  }

  if (allQuestions.length < 5) {
    throw new Error(`Not enough ${type} questions available (${allQuestions.length})`)
  }

  return shuffleArray(allQuestions).slice(0, 5) // Always 5
}

export async function saveQuizResult(
  uid: string,
  skillId: string,
  quizId: string,
  nodeIds: string[],
  userAnswers: (number | string | { [term: string]: string })[],
  questions: QuizQuestion[],
  quizType: string
): Promise<string> {
  const quizRef = doc(db, "users", uid, "skillspaces", skillId, "quizzes", quizId)
  const quizSnap = await getDoc(quizRef)
  if (!quizSnap.exists()) {
    console.error("Quiz not found:", quizId)
    throw new Error("Quiz not found")
  }

  const score = userAnswers.reduce<number>((acc, answer, idx) => {
    const q = questions[idx]
    if (q.type === "multiple-choice") {
      const letterToIndex: { [key in 'a' | 'b' | 'c' | 'd']: number } = { "a": 0, "b": 1, "c": 2, "d": 3 }
      return acc + (letterToIndex[answer as 'a' | 'b' | 'c' | 'd'] === letterToIndex[q.correctAnswer as 'a' | 'b' | 'c' | 'd'] ? 1 : 0)
    } else if (q.type === "fill-in-the-blank") {
      return acc + ((answer as string).toLowerCase() === (q.correctAnswer as string).toLowerCase() ? 1 : 0)
    } else if (q.type === "matching") {
      const userPairs = answer as { [term: string]: string }
      const correctPairs = q.correctAnswer as { term: string; definition: string }[]
      const isCorrect = correctPairs.every(cp => userPairs[cp.term] === cp.definition) && 
                       Object.keys(userPairs).length === correctPairs.length &&
                       correctPairs.every(cp => Object.keys(userPairs).includes(cp.term))
      if (!isCorrect) console.log(`Mismatch at question ${idx}: User: ${JSON.stringify(userPairs)}, Correct: ${JSON.stringify(correctPairs)}`)
      return acc + (isCorrect ? 1 : 0)
    }
    return acc
  }, 0)

  const result = {
    quizId,
    nodeIds,
    userAnswers,
    score,
    timestamp: Timestamp.now(),
    quizType,
    questions
  }

  const resultRef = doc(collection(db, "users", uid, "skillspaces", skillId, "quizResults"))
  await setDoc(resultRef, result)
  return resultRef.id
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}