"use client"

import { useMemo, useState, useRef, useEffect } from "react"
import type { ModelWithScores, Categories, BenchmarkDef } from "@/lib/types"
import { CATEGORY_COLORS } from "@/lib/colors"
import { useLocale } from "@/lib/i18n-context"

interface BenchmarkRankingProps {
  models: ModelWithScores[]
  categories: Categories
  selectedSlugs: string[]
}

interface RankedModel {
  model: ModelWithScores
  score: number
  rank: number
  barWidth: number
  isSelected: boolean
}

const LABELS = {
  zh: {
    selectBenchmark: "选择 Benchmark",
    rank: "排名",
    model: "模型",
    score: "分数",
    noData: "暂无数据",
  },
  en: {
    selectBenchmark: "Select Benchmark",
    rank: "Rank",
    model: "Model",
    score: "Score",
    noData: "No data",
  },
} as const

// Layout constants
const ROW_HEIGHT = 36
const RANK_COL_WIDTH = 44
const NAME_COL_WIDTH = 180
const SCORE_COL_WIDTH = 90
const BAR_LEFT = RANK_COL_WIDTH + NAME_COL_WIDTH
const BAR_RIGHT_PADDING = SCORE_COL_WIDTH + 16
const HEADER_HEIGHT = 32

export default function BenchmarkRanking({
  models,
  categories,
  selectedSlugs,
}: BenchmarkRankingProps) {
  const { locale } = useLocale()
  const l = LABELS[locale] || LABELS.en
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)

  // Build flat list of all benchmarks grouped by category
  const benchmarkOptions = useMemo(() => {
    const groups: { categoryKey: string; categoryLabel: string; benchmarks: BenchmarkDef[] }[] = []
    for (const [catKey, catDef] of Object.entries(categories)) {
      if (catDef.benchmarks.length > 0) {
        groups.push({
          categoryKey: catKey,
          categoryLabel: catDef.label,
          benchmarks: catDef.benchmarks,
        })
      }
    }
    return groups
  }, [categories])

  // Default to first benchmark of first category
  const defaultBenchmarkKey = useMemo(() => {
    for (const group of benchmarkOptions) {
      if (group.benchmarks.length > 0) return group.benchmarks[0].key
    }
    return ""
  }, [benchmarkOptions])

  const [selectedBenchmark, setSelectedBenchmark] = useState(defaultBenchmarkKey)
  const [animatedKey, setAnimatedKey] = useState(0)

  // Find the selected benchmark definition
  const benchmarkDef = useMemo(() => {
    for (const group of benchmarkOptions) {
      for (const b of group.benchmarks) {
        if (b.key === selectedBenchmark) return b
      }
    }
    return null
  }, [benchmarkOptions, selectedBenchmark])

  // Rank models by selected benchmark
  const rankedModels: RankedModel[] = useMemo(() => {
    if (!benchmarkDef) return []

    // Filter models that have this benchmark score
    const withScores = models
      .filter((m) => m.benchmarks[selectedBenchmark] != null)
      .map((m) => ({
        model: m,
        score: m.benchmarks[selectedBenchmark],
        isSelected: selectedSlugs.includes(m.slug),
      }))

    // Sort
    withScores.sort((a, b) =>
      benchmarkDef.higher_is_better ? b.score - a.score : a.score - b.score
    )

    // Compute bar widths
    const scores = withScores.map((w) => w.score)
    const minScore = Math.min(...scores)
    const maxScore = Math.max(...scores)

    const isEloLike = benchmarkDef.max_score === null && !benchmarkDef.unit.includes("%")

    return withScores.map((w, i) => {
      let barWidth: number
      if (isEloLike) {
        // ELO-style: relative to min/max range
        const range = maxScore - minScore
        barWidth = range > 0 ? ((w.score - minScore) / range) * 100 : 50
      } else {
        // Percentage/scored benchmarks: relative to max_score
        const cap = benchmarkDef.max_score ?? 100
        barWidth = (w.score / cap) * 100
      }
      barWidth = Math.max(barWidth, 2) // minimum visible bar

      return {
        ...w,
        rank: i + 1,
        barWidth,
      }
    })
  }, [models, selectedBenchmark, benchmarkDef, selectedSlugs])

  // Trigger re-animation on benchmark change
  useEffect(() => {
    setAnimatedKey((k) => k + 1)
  }, [selectedBenchmark])

  // Observe container width
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const svgHeight = HEADER_HEIGHT + rankedModels.length * ROW_HEIGHT + 8
  const barMaxWidth = Math.max(containerWidth - BAR_LEFT - BAR_RIGHT_PADDING, 60)

  // Format score with unit
  const formatScore = (score: number, def: BenchmarkDef) => {
    if (def.unit === "%") return `${score.toFixed(1)}%`
    if (def.unit === "ELO" || def.unit === "elo") return `${Math.round(score)} ELO`
    if (def.unit) return `${score.toFixed(1)} ${def.unit}`
    return score.toFixed(1)
  }

  // Get category color for a benchmark
  const getCategoryForBenchmark = (benchmarkKey: string): string | null => {
    for (const [catKey, catDef] of Object.entries(categories)) {
      if (catDef.benchmarks.some((b) => b.key === benchmarkKey)) return catKey
    }
    return null
  }

  const activeCategoryKey = getCategoryForBenchmark(selectedBenchmark)
  const accentColor = activeCategoryKey ? CATEGORY_COLORS[activeCategoryKey] || "#3b82f6" : "#3b82f6"

  return (
    <div ref={containerRef} className="paper-card w-full overflow-hidden">
      {/* Dropdown */}
      <div className="flex items-center gap-3 mb-4 px-1">
        <label className="text-txt-muted text-sm font-heading shrink-0">
          {l.selectBenchmark}
        </label>
        <select
          value={selectedBenchmark}
          onChange={(e) => setSelectedBenchmark(e.target.value)}
          className="
            flex-1 max-w-xs px-3 py-1.5 text-sm rounded-lg
            border border-white/10 bg-card text-txt-primary
            font-mono cursor-pointer
            focus:outline-none focus:ring-2 focus:ring-accent-blue/50
            transition-colors
          "
        >
          {benchmarkOptions.map((group) => (
            <optgroup key={group.categoryKey} label={group.categoryLabel}>
              {group.benchmarks.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label} ({b.unit || "score"})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* SVG Bar Chart */}
      {rankedModels.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-txt-muted text-sm">
          {l.noData}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <svg
            key={animatedKey}
            width={containerWidth}
            height={svgHeight}
            className="block"
            style={{ minWidth: BAR_LEFT + BAR_RIGHT_PADDING + 60 }}
          >
            {/* Header row */}
            <text
              x={RANK_COL_WIDTH / 2}
              y={HEADER_HEIGHT - 8}
              textAnchor="middle"
              className="fill-txt-muted text-[11px] font-heading"
            >
              {l.rank}
            </text>
            <text
              x={RANK_COL_WIDTH + 8}
              y={HEADER_HEIGHT - 8}
              textAnchor="start"
              className="fill-txt-muted text-[11px] font-heading"
            >
              {l.model}
            </text>
            <text
              x={containerWidth - 12}
              y={HEADER_HEIGHT - 8}
              textAnchor="end"
              className="fill-txt-muted text-[11px] font-heading"
            >
              {l.score}
            </text>

            {/* Header divider */}
            <line
              x1={4}
              y1={HEADER_HEIGHT}
              x2={containerWidth - 4}
              y2={HEADER_HEIGHT}
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeWidth={1}
            />

            {/* Rows */}
            {rankedModels.map((rm, i) => {
              const y = HEADER_HEIGHT + i * ROW_HEIGHT
              const centerY = y + ROW_HEIGHT / 2
              const barColor = rm.isSelected ? rm.model.providerColor : "#94a3b8"
              const barOpacity = rm.isSelected ? 1 : 0.3
              const textOpacity = rm.isSelected ? 1 : 0.5
              const barPixelWidth = (rm.barWidth / 100) * barMaxWidth

              return (
                <g key={rm.model.slug}>
                  {/* Row background on hover (via CSS) */}
                  <rect
                    x={0}
                    y={y + 2}
                    width={containerWidth}
                    height={ROW_HEIGHT - 4}
                    rx={4}
                    fill="currentColor"
                    fillOpacity={0}
                    className="transition-all duration-200 hover:fill-white/[0.03]"
                  />

                  {/* Rank badge */}
                  <g>
                    <rect
                      x={RANK_COL_WIDTH / 2 - 12}
                      y={centerY - 10}
                      width={24}
                      height={20}
                      rx={6}
                      fill={rm.rank <= 3 && rm.isSelected ? accentColor : "transparent"}
                      fillOpacity={rm.rank <= 3 && rm.isSelected ? 0.15 : 0}
                    />
                    <text
                      x={RANK_COL_WIDTH / 2}
                      y={centerY + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={rm.rank <= 3 && rm.isSelected ? accentColor : "currentColor"}
                      fillOpacity={rm.rank <= 3 ? 0.9 : textOpacity}
                      className="text-[12px] font-mono font-bold"
                    >
                      {rm.rank}
                    </text>
                  </g>

                  {/* Model name */}
                  <text
                    x={RANK_COL_WIDTH + 8}
                    y={centerY + 1}
                    textAnchor="start"
                    dominantBaseline="middle"
                    fill="currentColor"
                    fillOpacity={textOpacity}
                    className="text-[12px] font-heading"
                  >
                    {/* Truncate long names */}
                    {rm.model.name.length > 22
                      ? rm.model.name.slice(0, 20) + "..."
                      : rm.model.name}
                  </text>

                  {/* Bar background track */}
                  <rect
                    x={BAR_LEFT}
                    y={centerY - 6}
                    width={barMaxWidth}
                    height={12}
                    rx={3}
                    fill="currentColor"
                    fillOpacity={0.04}
                  />

                  {/* Animated bar */}
                  <rect
                    x={BAR_LEFT}
                    y={centerY - 6}
                    width={barPixelWidth}
                    height={12}
                    rx={3}
                    fill={barColor}
                    fillOpacity={barOpacity}
                    style={{
                      transition: "width 500ms cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  />

                  {/* Score value */}
                  <text
                    x={containerWidth - 12}
                    y={centerY + 1}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fill="currentColor"
                    fillOpacity={textOpacity}
                    className="text-[11px] font-mono"
                  >
                    {benchmarkDef ? formatScore(rm.score, benchmarkDef) : rm.score}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      )}
    </div>
  )
}
