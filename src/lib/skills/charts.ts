import type { Skill } from "./types"

export const chartsSkill: Skill = {
  id: "recharts",
  summary: "Data charts (bar/line/pie) for comparing values or trends.",
  instructions: `CHARTS — to compare values or show a trend, emit renderArtifact with type
"recharts" and content = a JSON string:
{"chartType":"BarChart"|"LineChart"|"PieChart","data":[{"name":"A","value":10}],"xKey":"name","yKey":"value"}
Keep data to ≤ 8 points. Use a real labeled dataset, not placeholders.`,
}
