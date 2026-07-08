import type { Skill } from "./types"

export const codeRunnableSkill: Skill = {
  id: "code-runnable",
  summary: "Editable, runnable code the learner executes in-app (14 languages).",
  instructions: `RUNNABLE CODE — when the learner should run or tinker with code (not just read
it), emit renderArtifact with type "code-runnable" and a "language". The panel is
a full editor (syntax highlighting, auto-indent) with a Run button.

SUPPORTED LANGUAGES:
- Instant, in-browser: python, javascript, typescript
- Via execution server: java, c, cpp, csharp, go, rust, ruby, php, bash

RULES:
- Make it self-contained and SELF-PRINTING: use print() / console.log() /
  System.out.println() etc. so running it shows visible output.
- Compiled languages must be complete programs (includes/imports + entry point).
  JAVA: the class MUST be \`public class Main\` (the runner compiles Main.java).
- No file system, no network, no stdin — hard-code sample data.
- Keep it focused (≈ <40 lines). For a problem the learner should SOLVE themselves,
  use a code-exercise instead (see the exercise skill).`,
}
