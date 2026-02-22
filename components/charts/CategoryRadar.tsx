"use client"

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts"
import type { ModelWithScores, Categories } from "@/lib/types"
import { getModelColor, CATEGORY_COLORS } from "@/lib/colors"
import { useLocale } from "@/lib/i18n-context"

interface CategoryRadarProps {
  models: ModelWithScores[]
  categories: Categories
  onCategoryClick?: (categoryKey: string) => void
}

export default function CategoryRadar({
  models,
  categories,
  onCategoryClick,
}: CategoryRadarProps) {
  const { getCategoryLabel } = useLocale()
  const categoryKeys = Object.keys(categories)

  const data = categoryKeys.map((key) => {
    const point: Record<string, string | number> = {
      category: getCategoryLabel(key),
      categoryKey: key,
      fullMark: 100,
    }
    models.forEach((m) => {
      const cs = m.categoryScores[key]
      point[m.slug] = cs ? Math.round(cs.score) : 0
    })
    return point
  })

  const CustomTick = ({
    x,
    y,
    payload,
  }: {
    x: number
    y: number
    payload: { value: string; index: number }
  }) => {
    const catKey = categoryKeys[payload.index]
    return (
      <g
        onClick={() => onCategoryClick?.(catKey)}
        style={{ cursor: onCategoryClick ? "pointer" : "default" }}
      >
        <text
          x={x}
          y={y}
          textAnchor="middle"
          fill={CATEGORY_COLORS[catKey] || "#94a3b8"}
          fontSize={12}
          fontWeight={500}
          fontFamily="'EB Garamond', serif"
        >
          {payload.value}
        </text>
      </g>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={420}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
        <PolarGrid stroke="var(--color-border)" />
        <PolarAngleAxis
          dataKey="category"
          tick={CustomTick as any}
          tickLine={false}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: "var(--color-txt-muted)" }}
          tickCount={5}
          stroke="var(--color-border)"
        />
        {models.map((m, i) => (
          <Radar
            key={m.slug}
            name={m.name}
            dataKey={m.slug}
            stroke={getModelColor(i)}
            fill={getModelColor(i)}
            fillOpacity={0.12}
            strokeWidth={2}
          />
        ))}
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "0",
            fontSize: "13px",
            fontFamily: "'VT323', monospace",
            color: "var(--color-txt-primary)",
            boxShadow: "4px 4px 0 var(--color-border)",
          }}
          formatter={(value: number, name: string) => {
            const model = models.find((m) => m.slug === name)
            return [`${value}/100`, model?.name ?? name]
          }}
          itemStyle={{ color: "var(--color-txt-primary)" }}
          labelStyle={{ color: "var(--color-txt-secondary)", fontFamily: "'EB Garamond', serif" }}
        />
        <Legend
          wrapperStyle={{ fontSize: "13px", paddingTop: "10px", color: "var(--color-txt-secondary)" }}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
