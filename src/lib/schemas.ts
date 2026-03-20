/**
 * Shared Zod schemas for structured LLM outputs.
 * Using generateObject with these schemas eliminates brittle JSON.parse calls
 * and gives full type-safety on LLM responses.
 */

import { z } from "zod"

// ─── Quiz Schemas ─────────────────────────────────────────────────────────────

/**
 * A single quiz question — intentionally permissive on optional fields so
 * generateObject can work across all providers without strict oneOf constraints.
 * Type-specific validation (e.g., MCQ needs 4 options) is enforced in the
 * route after parsing.
 */
export const QuizQuestionSchema = z.object({
  type: z.enum(["multiple-choice", "fill-in-the-blank", "matching"]),
  question: z.string().min(5),
  /** Multiple-choice only: 4 options labelled "a. …", "b. …", "c. …", "d. …" */
  options: z.array(z.string()).optional(),
  /** Matching only: term-definition pairs */
  pairs: z
    .array(z.object({ term: z.string(), definition: z.string() }))
    .optional(),
  /** MCQ → "a"|"b"|"c"|"d". Fill-in-blank → short phrase. Matching → array of pairs. */
  correctAnswer: z.union([
    z.string(),
    z.array(z.object({ term: z.string(), definition: z.string() })),
  ]),
})

/** Top-level object returned by generateObject for quiz generation */
export const QuizResponseSchema = z.object({
  questions: z.array(QuizQuestionSchema).min(5).max(30),
})

export type QuizQuestion = z.infer<typeof QuizQuestionSchema>
export type QuizResponse = z.infer<typeof QuizResponseSchema>

// ─── Roadmap Schemas ──────────────────────────────────────────────────────────

/** A child node — a self-contained learning unit (~30–60 min session) */
const RoadmapChildSchema = z.object({
  id: z.string().describe("Unique camelCase ID, e.g. 'reactHooks'"),
  title: z.string().describe("Specific, action-oriented topic title"),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]).default("NOT_STARTED"),
  weight: z.number().int().min(1).max(5).default(1)
    .describe("Importance for progress tracking. Foundational = 2–3, advanced = 1–2"),
})

/** A parent node grouping 2–4 related child learning units */
const RoadmapParentSchema = z.object({
  id: z.string().describe("Unique camelCase ID for this topic area"),
  title: z.string().describe("Major topic area title — engaging and descriptive"),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]).default("NOT_STARTED"),
  weight: z.number().int().min(1).max(5).default(1),
  children: z.array(RoadmapChildSchema).min(2).max(4)
    .describe("2–4 child learning units within this topic area"),
})

/** Starter question cards shown on the learn page empty state */
const StarterQuestionSchema = z.object({
  nodeId: z.string().describe("ID of the child node this question relates to"),
  question: z.string().describe("A practical or thought-provoking question the learner would genuinely want to ask"),
  shortDesc: z.string().max(25).describe("2-word topic tag, e.g. 'Array Methods'"),
})

/** Full schema for generateObject roadmap generation — eliminates JSON.parse + fixRoadmapStructure */
export const RoadmapGenerationSchema = z.object({
  roadmap: z.object({
    title: z.string(),
    nodes: z.array(RoadmapParentSchema).min(3).max(5)
      .describe("3–4 parent topic areas, each with 2–4 child nodes"),
  }),
  questions: z.array(StarterQuestionSchema).min(4).max(10)
    .describe("4–8 engaging starter questions referencing child node IDs"),
})

export type RoadmapGeneration = z.infer<typeof RoadmapGenerationSchema>
