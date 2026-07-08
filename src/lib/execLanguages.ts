/**
 * Single source of truth for code-execution languages.
 *
 * Execution tiers:
 *  - CLIENT: JavaScript, TypeScript (sucrase-transpiled), Python (Pyodide) run
 *    fully in-browser — instant, free, offline-capable, auto-gradable.
 *  - SERVER: compiled/JVM languages execute via /api/execute, which fails over
 *    across providers (Judge0 when JUDGE0_API_KEY is set, then Wandbox keyless).
 *
 * Provider facts below were verified by live smoke tests (2026-06-10):
 *  - The public Piston API went whitelist-only (2026-02-15) — NOT usable.
 *  - Wandbox runs C, C++, Java (class must not be `public` — adapter strips it),
 *    C# (Mono), Go, Rust, Ruby, PHP, Bash. Its Swift runtime is broken.
 *  - Kotlin and Swift therefore require Judge0 (optional key).
 *
 * Pure module — no React, no env access — unit-tested.
 */

export interface ExecLanguage {
  /** Canonical id used across the app. */
  id: string
  /** Human label for UI. */
  label: string
  /** Where it executes. */
  tier: "client" | "server"
  /** Judge0 CE language_id (stable, documented). */
  judge0Id?: number
  /** Wandbox `language` field from /api/list.json, for compiler discovery. */
  wandboxLanguage?: string
  /** Preferred Wandbox compiler-name prefix (e.g. pick Mono over dotnetcore). */
  wandboxPrefer?: string
  /** Accepted aliases (lowercase). */
  aliases: string[]
}

const LANGUAGES: ExecLanguage[] = [
  { id: "javascript", label: "JavaScript", tier: "client", judge0Id: 63, aliases: ["js", "node", "nodejs"] },
  { id: "typescript", label: "TypeScript", tier: "client", judge0Id: 74, aliases: ["ts"] },
  { id: "python", label: "Python", tier: "client", judge0Id: 71, aliases: ["py", "python3"] },
  { id: "java", label: "Java", tier: "server", judge0Id: 62, wandboxLanguage: "Java", aliases: [] },
  { id: "c", label: "C", tier: "server", judge0Id: 50, wandboxLanguage: "C", wandboxPrefer: "gcc", aliases: [] },
  { id: "cpp", label: "C++", tier: "server", judge0Id: 54, wandboxLanguage: "C++", wandboxPrefer: "gcc", aliases: ["c++", "cplusplus"] },
  { id: "csharp", label: "C#", tier: "server", judge0Id: 51, wandboxLanguage: "C#", wandboxPrefer: "mono", aliases: ["c#", "cs", "dotnet"] },
  { id: "go", label: "Go", tier: "server", judge0Id: 60, wandboxLanguage: "Go", aliases: ["golang"] },
  { id: "rust", label: "Rust", tier: "server", judge0Id: 73, wandboxLanguage: "Rust", aliases: ["rs"] },
  { id: "ruby", label: "Ruby", tier: "server", judge0Id: 72, wandboxLanguage: "Ruby", aliases: ["rb"] },
  { id: "php", label: "PHP", tier: "server", judge0Id: 68, wandboxLanguage: "PHP", aliases: [] },
  { id: "bash", label: "Bash", tier: "server", judge0Id: 46, wandboxLanguage: "Bash script", aliases: ["sh", "shell"] },
  // Judge0-only (Wandbox lacks Kotlin; its Swift runtime is broken)
  { id: "kotlin", label: "Kotlin", tier: "server", judge0Id: 78, aliases: ["kt"] },
  { id: "swift", label: "Swift", tier: "server", judge0Id: 83, aliases: [] },
]

const BY_KEY = new Map<string, ExecLanguage>()
for (const lang of LANGUAGES) {
  BY_KEY.set(lang.id, lang)
  for (const a of lang.aliases) BY_KEY.set(a, lang)
}

/** Resolve any user/model-supplied language string to a canonical entry, or null. */
export function resolveLanguage(raw: string | undefined | null): ExecLanguage | null {
  if (!raw) return null
  return BY_KEY.get(raw.trim().toLowerCase()) ?? null
}

/** True when the language executes fully in-browser (also: auto-gradable). */
export function isClientRunnable(raw: string | undefined | null): boolean {
  return resolveLanguage(raw)?.tier === "client"
}

/** True when we can execute the language at all (either tier). */
export function isExecutable(raw: string | undefined | null): boolean {
  return resolveLanguage(raw) !== null
}

/** Server-tier languages. */
export function serverLanguages(): ExecLanguage[] {
  return LANGUAGES.filter((l) => l.tier === "server")
}

export function allLanguageIds(): string[] {
  return LANGUAGES.map((l) => l.id)
}

/**
 * Picks the best Wandbox compiler for a language from the live /api/list.json
 * entries. Preference: explicit prefix match (e.g. Mono for C#) → "-head"
 * builds → first listed (newest). Pure — unit-tested with a fixture list.
 */
export function pickWandboxCompiler(
  lang: ExecLanguage,
  list: Array<{ name: string; language: string }>
): string | null {
  if (!lang.wandboxLanguage) return null
  const candidates = list.filter((e) => e.language === lang.wandboxLanguage)
  if (candidates.length === 0) return null

  if (lang.wandboxPrefer) {
    const preferred = candidates.find((e) => e.name.startsWith(lang.wandboxPrefer!))
    if (preferred) return preferred.name
  }
  const head = candidates.find((e) => e.name.includes("head"))
  if (head) return head.name
  return candidates[0].name
}

/**
 * Wandbox compiles Java as `prog.java`, so a `public` top-level class fails to
 * compile ("class Main is public, should be declared in a file named Main.java").
 * Judge0 (and our skill prompts) use the `public class Main` convention — this
 * adapter strips the modifier transparently for Wandbox submissions.
 */
export function adaptJavaForWandbox(code: string): string {
  return code.replace(/\bpublic\s+(final\s+|abstract\s+)?class\b/g, "$1class")
}
