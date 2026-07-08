import { describe, it, expect } from "vitest"
import { extractExercises, exerciseKey } from "@/lib/extractArtifacts"

const spec = [
  "{",
  '  "prompt": "Sum the even numbers.",',
  '  "language": "python",',
  '  "starterCode": "def sum_even(arr):\\n    pass",',
  '  "tests": [',
  '    { "call": "sum_even([1,2,3,4])", "expected": 6 },',
  '    { "call": "sum_even([])", "expected": 0 }',
  "  ]",
  "}",
].join("\n")

describe("extractExercises", () => {
  it("extracts a spec regardless of fence tag and hides the raw JSON", () => {
    for (const tag of ["code-exercise", "json", "code", ""]) {
      const msg = `Here's an exercise:\n\n\`\`\`${tag}\n${spec}\n\`\`\`\nGood luck!`
      const r = extractExercises(msg, false)
      expect(r.exercises).toHaveLength(1)
      expect(r.cleaned).not.toContain("starterCode")
      expect(r.cleaned).toContain("Good luck!")
    }
  })

  it("extracts a spec with no fence at all", () => {
    const r = extractExercises(`Try this:\n${spec}\nHave fun!`, false)
    expect(r.exercises).toHaveLength(1)
    expect(r.cleaned).not.toContain('"tests"')
  })

  it("hides a mid-stream spec behind 'preparing'", () => {
    const partial = 'Here you go:\n\n```code\n{\n  "prompt": "Sum.",\n  "starterCode": "def f('
    const r = extractExercises(partial, true)
    expect(r.preparing).toBe(true)
    expect(r.cleaned).not.toContain("starterCode")
    // The dangling fence opener is also removed
    expect(r.cleaned.trim().endsWith("```code")).toBe(false)
  })

  it("returns messages without exercises untouched", () => {
    const msg = "Plain explanation with `inline code` and a list."
    const r = extractExercises(msg, false)
    expect(r.cleaned).toBe(msg)
    expect(r.exercises).toHaveLength(0)
    expect(r.preparing).toBe(false)
  })

  it("does not treat ordinary JSON (e.g. chart config) as an exercise", () => {
    const msg = 'Chart config:\n```json\n{"chartType":"BarChart","data":[{"x":1}]}\n```'
    const r = extractExercises(msg, false)
    expect(r.exercises).toHaveLength(0)
    expect(r.cleaned).toContain("chartType")
  })
})

describe("exerciseKey", () => {
  it("is whitespace-insensitive so echoed specs match the original", () => {
    const reformatted = spec.replace(/\n\s*/g, " ")
    expect(exerciseKey(spec)).toBe(exerciseKey(reformatted))
  })
})
