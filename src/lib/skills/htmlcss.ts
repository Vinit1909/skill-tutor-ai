import type { Skill } from "./types"

export const htmlCssSkill: Skill = {
  id: "html",
  summary: "Live HTML/CSS preview — render UI, layout, and styling concepts.",
  instructions: `HTML / CSS PREVIEW — when teaching anything visual (layout, flexbox, grid,
styling, a small component), show it RENDERED so the learner sees the result.
Emit via renderArtifact (type "html") OR a \`\`\`html fenced block — both render
live in a sandboxed frame with a Preview/Code toggle.

RULES:
- content is a self-contained HTML document or fragment. Put CSS in a <style> tag
  (in <head> or inline at the top of the fragment) — combine HTML + CSS together.
- NO external resources (CDNs, web fonts, remote images, scripts) — they will not
  load in the sandbox. Use system fonts and inline SVG/data-URIs if needed.
- Keep it small and focused on the concept (one component / one layout), not a full page.
- It is fine to include a little <script> for interactivity; it runs sandboxed.`,
}
