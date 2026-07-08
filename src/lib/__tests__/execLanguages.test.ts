import { describe, it, expect } from "vitest"
import {
  resolveLanguage,
  isClientRunnable,
  isExecutable,
  serverLanguages,
  allLanguageIds,
  pickWandboxCompiler,
  adaptJavaForWandbox,
} from "@/lib/execLanguages"

describe("resolveLanguage", () => {
  it("resolves canonical ids", () => {
    expect(resolveLanguage("python")?.id).toBe("python")
    expect(resolveLanguage("java")?.id).toBe("java")
  })

  it("resolves aliases case-insensitively", () => {
    expect(resolveLanguage("JS")?.id).toBe("javascript")
    expect(resolveLanguage("py")?.id).toBe("python")
    expect(resolveLanguage("C++")?.id).toBe("cpp")
    expect(resolveLanguage("c#")?.id).toBe("csharp")
    expect(resolveLanguage("TS")?.id).toBe("typescript")
    expect(resolveLanguage("golang")?.id).toBe("go")
    expect(resolveLanguage("sh")?.id).toBe("bash")
  })

  it("trims whitespace and rejects unknown/empty input", () => {
    expect(resolveLanguage("  rust  ")?.id).toBe("rust")
    expect(resolveLanguage("brainfuck")).toBeNull()
    expect(resolveLanguage("")).toBeNull()
    expect(resolveLanguage(undefined)).toBeNull()
    expect(resolveLanguage(null)).toBeNull()
  })
})

describe("execution tiers", () => {
  it("javascript, typescript, python run client-side (auto-gradable)", () => {
    expect(isClientRunnable("javascript")).toBe(true)
    expect(isClientRunnable("typescript")).toBe(true)
    expect(isClientRunnable("python")).toBe(true)
    expect(isClientRunnable("java")).toBe(false)
    expect(isClientRunnable("go")).toBe(false)
  })

  it("all well-known languages are executable somewhere", () => {
    for (const lang of [
      "python", "javascript", "typescript", "java", "c", "cpp",
      "csharp", "go", "rust", "ruby", "php", "kotlin", "swift", "bash",
    ]) {
      expect(isExecutable(lang), `${lang} should be executable`).toBe(true)
    }
  })

  it("unknown languages are not executable", () => {
    expect(isExecutable("cobol")).toBe(false)
  })
})

describe("provider config", () => {
  it("every server language has at least one provider (judge0 or wandbox)", () => {
    for (const lang of serverLanguages()) {
      expect(
        Boolean(lang.judge0Id || lang.wandboxLanguage),
        `${lang.id} needs a provider`
      ).toBe(true)
    }
  })

  it("kotlin and swift are judge0-only (wandbox lacks/breaks them — verified live)", () => {
    expect(resolveLanguage("kotlin")?.wandboxLanguage).toBeUndefined()
    expect(resolveLanguage("swift")?.wandboxLanguage).toBeUndefined()
    expect(resolveLanguage("kotlin")?.judge0Id).toBeTruthy()
    expect(resolveLanguage("swift")?.judge0Id).toBeTruthy()
  })

  it("ids are unique", () => {
    const ids = allLanguageIds()
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe("pickWandboxCompiler", () => {
  // Fixture mirrors the live /api/list.json shape (verified 2026-06-10)
  const list = [
    { name: "gcc-head", language: "C++" },
    { name: "gcc-13.2.0", language: "C++" },
    { name: "clang-head", language: "C++" },
    { name: "gcc-head-c", language: "C" },
    { name: "clang-head-c", language: "C" },
    { name: "mono-6.12.0.199", language: "C#" },
    { name: "dotnetcore-8.0.402", language: "C#" },
    { name: "openjdk-jdk-22+36", language: "Java" },
    { name: "go-1.23.2", language: "Go" },
  ]

  it("prefers the configured prefix (Mono over dotnetcore for C#)", () => {
    expect(pickWandboxCompiler(resolveLanguage("csharp")!, list)).toBe("mono-6.12.0.199")
  })

  it("prefers gcc head builds for C/C++", () => {
    expect(pickWandboxCompiler(resolveLanguage("cpp")!, list)).toBe("gcc-head")
    expect(pickWandboxCompiler(resolveLanguage("c")!, list)).toBe("gcc-head-c")
  })

  it("falls back to the first (newest) entry when no preference matches", () => {
    expect(pickWandboxCompiler(resolveLanguage("java")!, list)).toBe("openjdk-jdk-22+36")
    expect(pickWandboxCompiler(resolveLanguage("go")!, list)).toBe("go-1.23.2")
  })

  it("returns null when the language is missing from the list", () => {
    expect(pickWandboxCompiler(resolveLanguage("rust")!, list)).toBeNull()
    expect(pickWandboxCompiler(resolveLanguage("kotlin")!, list)).toBeNull() // no wandbox support
  })
})

describe("adaptJavaForWandbox", () => {
  it("strips public from the class so prog.java compiles (verified live)", () => {
    expect(adaptJavaForWandbox("public class Main { }")).toBe("class Main { }")
    expect(adaptJavaForWandbox("public final class Main { }")).toBe("final class Main { }")
  })

  it("leaves public methods/fields alone", () => {
    const code = "class Main { public static void main(String[] a) {} }"
    expect(adaptJavaForWandbox(code)).toBe(code)
  })
})
