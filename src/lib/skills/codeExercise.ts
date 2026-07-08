import type { Skill } from "./types"

export const codeExerciseSkill: Skill = {
  id: "code-exercise",
  summary: "LeetCode-style practice problem with editor + auto-graded tests.",
  instructions: `CODING EXERCISE (LeetCode-style) — when the learner wants to PRACTICE or be
TESTED ("give me a problem", "let me try", "quiz me"), output a fenced block tagged
\`code-exercise\` containing a JSON spec. Use the FENCE (not prose, not a tool call,
not a \`json\` fence) so it renders as an interactive sandbox:

\`\`\`code-exercise
{
  "prompt": "Return the indices of the two numbers that add up to target.",
  "language": "python",
  "starterCode": "def two_sum(nums, target):\\n    # your code here\\n    pass",
  "tests": [
    { "call": "two_sum([2,7,11,15], 9)", "expected": "[0, 1]", "explanation": "2+7=9" },
    { "call": "two_sum([3,2,4], 6)", "expected": "[1, 2]" },
    { "call": "two_sum([3,3], 6)", "expected": "[0, 1]" }
  ]
}
\`\`\`

STRICT JSON RULES (the spec must parse):
- Valid JSON only. Double-quoted strings everywhere. NO backticks, NO template literals.
- Put newlines in starterCode as \\n (escaped). Do not write real line breaks inside the JSON string.

CONTENT RULES:
- "language": "python", "javascript", and "typescript" auto-run and AUTO-GRADE
  in-browser — prefer them. Other languages (java, c, cpp, csharp, go, rust, ruby,
  php) are also fine: the learner gets a full editor and can RUN their program on
  the execution server, but tests are not auto-graded — they click Review for your
  verdict. For those, starterCode must be a COMPLETE runnable program
  (Java: \`public class Main\` with a main method calling the function to implement).
- starterCode defines ONE function the learner completes. Do NOT include the solution.
- The function must RETURN its answer (the grader checks the return value, not prints).
- Each "call" invokes that function; "expected" is its result JSON-style: [0, 1], 5, "foo", true.
- Provide 3–5 tests: a normal case plus edge cases (empty, duplicates, boundaries).
- Match difficulty to the learner's level and current topic.
- After the learner clicks Review, their code comes back to you — assess correctness,
  edge cases, and style; give a hint before a full solution; be specific and encouraging.`,
}
