import { describe, it, expect } from "vitest"
import { parseExerciseSpec, balanceCall, isRunnableLanguage } from "@/lib/artifactParse"

const validSpec = JSON.stringify({
  prompt: "Sum the even numbers.",
  language: "python",
  starterCode: "def sum_even(arr):\n    pass",
  tests: [
    { call: "sum_even([1,2,3,4])", expected: "6", explanation: "2+4" },
    { call: "sum_even([])", expected: "0" },
  ],
})

describe("parseExerciseSpec", () => {
  it("parses a valid spec", () => {
    const spec = parseExerciseSpec(validSpec)
    expect(spec).not.toBeNull()
    expect(spec!.language).toBe("python")
    expect(spec!.tests).toHaveLength(2)
  })

  it("repairs backtick-quoted starterCode (observed model failure)", () => {
    const raw =
      '{ "prompt": "P", "language": "typescript", "starterCode": `\nfunction f(n: number) {\n  return n\n}\n`, "tests": [{ "call": "f(1)", "expected": "1" }] }'
    const spec = parseExerciseSpec(raw)
    expect(spec).not.toBeNull()
    expect(spec!.starterCode).toContain("function f")
  })

  it("repairs Python literals None/True/False in value positions (observed)", () => {
    const raw =
      '{ "prompt": "P", "language": "python", "starterCode": "def f():\\n  pass", "tests": [{ "call": "f()", "expected": None }, { "call": "g()", "expected": True }] }'
    const spec = parseExerciseSpec(raw)
    expect(spec).not.toBeNull()
    expect(spec!.tests[0].expected).toBe("null")
    expect(spec!.tests[1].expected).toBe("true")
  })

  it("balances unclosed parens in test calls (observed model failure)", () => {
    const raw = JSON.stringify({
      prompt: "P",
      language: "python",
      starterCode: "def f(a):\n  pass",
      tests: [{ call: "f([2, 1, 3, 5, 3, 2]", expected: 3 }],
    })
    const spec = parseExerciseSpec(raw)
    expect(spec!.tests[0].call).toBe("f([2, 1, 3, 5, 3, 2])")
  })

  it("stringifies numeric and null expected values canonically", () => {
    const raw = JSON.stringify({
      prompt: "P",
      language: "python",
      starterCode: "x",
      tests: [
        { call: "f()", expected: 12 },
        { call: "g()", expected: null },
        { call: "h()", expected: [0, 1] },
      ],
    })
    const spec = parseExerciseSpec(raw)
    expect(spec!.tests.map((t) => t.expected)).toEqual(["12", "null", "[0,1]"])
  })

  it("rejects non-exercise JSON", () => {
    expect(parseExerciseSpec('{"chartType":"BarChart","data":[]}')).toBeNull()
    expect(parseExerciseSpec("not json at all")).toBeNull()
    expect(parseExerciseSpec('{"prompt":"x","starterCode":"y","tests":[]}')).toBeNull() // empty tests
  })

  it("defaults missing language to python", () => {
    const raw = JSON.stringify({
      prompt: "P",
      starterCode: "x",
      tests: [{ call: "f()", expected: "1" }],
    })
    expect(parseExerciseSpec(raw)!.language).toBe("python")
  })
})

describe("balanceCall", () => {
  it("closes brackets before parens", () => {
    expect(balanceCall("f([1,2")).toBe("f([1,2])")
  })
  it("leaves balanced calls untouched", () => {
    expect(balanceCall("two_sum([3,3], 6)")).toBe("two_sum([3,3], 6)")
  })
})

describe("isRunnableLanguage (auto-gradable in-browser)", () => {
  it("accepts python, javascript, and typescript (transpiled) variants", () => {
    expect(isRunnableLanguage("Python")).toBe(true)
    expect(isRunnableLanguage("javascript")).toBe(true)
    expect(isRunnableLanguage("js")).toBe(true)
    expect(isRunnableLanguage("typescript")).toBe(true)
    expect(isRunnableLanguage("ts")).toBe(true)
  })
  it("rejects server-tier and unknown languages", () => {
    expect(isRunnableLanguage("go")).toBe(false)
    expect(isRunnableLanguage("java")).toBe(false)
    expect(isRunnableLanguage("cobol")).toBe(false)
  })
})
