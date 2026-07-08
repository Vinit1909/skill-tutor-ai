"use client"

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

interface ChartConfig {
  chartType: "BarChart" | "LineChart" | "PieChart"
  data: Record<string, unknown>[]
  xKey: string
  yKey: string
  title?: string
}

interface RechartsArtifactProps {
  content: string
}

const PIE_COLORS = ["#6c63ff", "#ff6584", "#43b89c", "#f7b731", "#a29bfe"]

export function RechartsArtifact({ content }: RechartsArtifactProps) {
  let config: ChartConfig
  try {
    config = JSON.parse(content)
  } catch {
    return (
      <div className="text-sm text-red-500 dark:text-red-400 p-2">
        Chart data could not be parsed.
      </div>
    )
  }

  const { chartType, data, xKey, yKey } = config

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="text-sm text-neutral-400 p-2">No chart data provided.</div>
    )
  }

  if (chartType === "PieChart") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey={yKey}
            nameKey={xKey}
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={(entry: Record<string, unknown>) => String(entry[xKey] ?? "")}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (chartType === "LineChart") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey={yKey}
            stroke="#6c63ff"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  // Default: BarChart
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Bar dataKey={yKey} fill="#6c63ff" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
