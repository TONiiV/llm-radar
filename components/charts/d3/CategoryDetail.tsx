"use client"

import { useMemo, useState } from "react"
import type { CategoryDef, ModelWithScores, BenchmarkDef, Sources } from "@/lib/types"
import { getModelColor, getCategoryColor } from "@/lib/colors"
import { useChartDimensions } from "./useChartDimensions"
import { useChartTheme } from "./useChartTheme"
import { useLocale } from "@/lib/i18n-context"
import SourceIcon from "@/components/SourceIcon"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CategoryDetailProps {
  categoryKey: string
  category: CategoryDef
  models: ModelWithScores[]
  sources: Sources
  onClose: () => void
}

// ---------------------------------------------------------------------------
// i18n helpers (inline until i18n.ts is extended)
// ---------------------------------------------------------------------------

const L = {
  close: { zh: "收起", en: "Close" },
  normalized: { zh: "归一化分数", en: "Normalized" },
  coverage: { zh: "覆盖率", en: "Coverage" },
  items: { zh: "项", en: "items" },
  insufficient: { zh: "数据不足", en: "Insufficient" },
  lowerBetter: { zh: "越低越好", en: "lower is better" },
  noData: { zh: "N/A", en: "N/A" },
} as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface BenchmarkGroup {
  unit: string
  benchmarks: BenchmarkDef[]
}

function groupByUnit(benchmarks: BenchmarkDef[]): BenchmarkGroup[] {
  const map = new Map<string, BenchmarkDef[]>()
  for (const b of benchmarks) {
    const list = map.get(b.unit) ?? []
    list.push(b)
    map.set(b.unit, list)
  }
  return Array.from(map.entries()).map(([unit, benchmarks]) => ({
    unit,
    benchmarks,
  }))
}

/** Determine the x-axis max for a group of benchmarks. */
function getGroupMax(
  group: BenchmarkGroup,
  models: ModelWithScores[]
): number {
  // If all benchmarks in the group share the same max_score, use it.
  const maxScores = group.benchmarks
    .map((b) => b.max_score)
    .filter((v): v is number => v !== null)

  if (maxScores.length === group.benchmarks.length) {
    // All have max_score — use the largest one for a shared scale.
    return Math.max(...maxScores)
  }

  // Otherwise fall back to the maximum observed value + 10% headroom.
  let observed = 0
  for (const b of group.benchmarks) {
    for (const m of models) {
      const v = m.benchmarks[b.key]
      if (v !== undefined && v > observed) observed = v
    }
  }
  return observed > 0 ? observed * 1.1 : 100
}

function getCoverageLevel(coverage: number): "solid" | "warn" | "insufficient" {
  if (coverage >= 0.75) return "solid"
  if (coverage >= 0.5) return "warn"
  return "insufficient"
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BAR_HEIGHT = 16
const BAR_GAP = 3
const BENCHMARK_GAP = 10
const LEFT_LABEL_WIDTH = 140
const RIGHT_VALUE_WIDTH = 54
const CHART_PADDING_TOP = 8
const CHART_PADDING_BOTTOM = 24 // room for x-axis ticks

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CategoryDetail({
  categoryKey,
  category,
  models,
  sources,
  onClose,
}: CategoryDetailProps) {
  const [containerRef, { width: containerWidth }] = useChartDimensions()
  const theme = useChartTheme()
  const { locale, getCategoryLabel } = useLocale()
  const lang = locale === "zh" ? "zh" : "en"

  const [hoveredBar, setHoveredBar] = useState<string | null>(null)

  const catColor = getCategoryColor(categoryKey)

  // Group benchmarks by unit
  const groups = useMemo(() => groupByUnit(category.benchmarks), [category])

  // Available chart width after labels
  const chartWidth = Math.max(
    Math.min(containerWidth - LEFT_LABEL_WIDTH - RIGHT_VALUE_WIDTH - 32, 800),
    80
  )

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------

  function renderBarGroup(group: BenchmarkGroup, groupIdx: number) {
    const groupMax = getGroupMax(group, models)
    const benchmarks = group.benchmarks
    const modelCount = models.length

    // Compute total SVG height for this group
    const benchmarkBlockHeight =
      modelCount * (BAR_HEIGHT + BAR_GAP) - BAR_GAP
    const totalHeight =
      CHART_PADDING_TOP +
      benchmarks.length * (benchmarkBlockHeight + BENCHMARK_GAP) -
      BENCHMARK_GAP +
      CHART_PADDING_BOTTOM

    // X-axis tick values (4 evenly spaced)
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) =>
      Math.round(groupMax * p)
    )

    return (
      <div key={group.unit} className={groupIdx > 0 ? "mt-6" : ""}>
        {/* Unit header */}
        <p
          className="text-xs mb-2 tracking-wide uppercase"
          style={{
            fontFamily: "'VT323', monospace",
            color: theme.textMuted,
          }}
        >
          {group.unit}
        </p>

        <div className="flex">
          {/* Left: benchmark labels */}
          <div
            className="flex-shrink-0 flex flex-col justify-start"
            style={{
              width: LEFT_LABEL_WIDTH,
              paddingTop: CHART_PADDING_TOP,
            }}
          >
            {benchmarks.map((b, bIdx) => {
              const blockOffset =
                bIdx * (benchmarkBlockHeight + BENCHMARK_GAP)
              return (
                <div
                  key={b.key}
                  className="flex flex-col justify-center"
                  style={{
                    height: benchmarkBlockHeight,
                    marginTop: bIdx > 0 ? BENCHMARK_GAP : 0,
                  }}
                >
                  <span className="inline-flex items-center gap-0.5 max-w-full">
                    <span
                      className="text-xs leading-tight truncate"
                      style={{
                        fontFamily: "'EB Garamond', serif",
                        color: theme.textPrimary,
                      }}
                      title={b.label}
                    >
                      {b.label}
                    </span>
                    {b.source && (
                      <SourceIcon sourceKey={b.source} sources={sources} size={12} url={b.sourceUrl} />
                    )}
                  </span>
                  {!b.higher_is_better && (
                    <span
                      className="text-[10px] leading-none mt-0.5"
                      style={{
                        fontFamily: "'VT323', monospace",
                        color: theme.textMuted,
                      }}
                    >
                      {L.lowerBetter[lang]}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Center: SVG bars */}
          <svg
            width={chartWidth}
            height={totalHeight}
            className="flex-shrink-0"
          >
            {/* Vertical grid lines */}
            {ticks.map((tick) => {
              const x = (tick / groupMax) * chartWidth
              return (
                <line
                  key={`grid-${tick}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={totalHeight - CHART_PADDING_BOTTOM}
                  stroke={theme.borderColor}
                  strokeWidth={0.5}
                  opacity={0.4}
                />
              )
            })}

            {/* X-axis tick labels */}
            {ticks.map((tick) => {
              const x = (tick / groupMax) * chartWidth
              return (
                <text
                  key={`tick-${tick}`}
                  x={x}
                  y={totalHeight - 6}
                  textAnchor="middle"
                  fontSize={10}
                  fontFamily="'VT323', monospace"
                  fill={theme.textMuted}
                >
                  {tick}
                </text>
              )
            })}

            {/* Bars */}
            {benchmarks.map((b, bIdx) => {
              const blockY =
                CHART_PADDING_TOP +
                bIdx * (benchmarkBlockHeight + BENCHMARK_GAP)

              return (
                <g key={b.key}>
                  {models.map((m, mIdx) => {
                    const value = m.benchmarks[b.key]
                    const barY =
                      blockY + mIdx * (BAR_HEIGHT + BAR_GAP)
                    const barKey = `${b.key}-${m.slug}`
                    const isHovered = hoveredBar === barKey
                    const color = getModelColor(mIdx)

                    if (value === undefined) {
                      // No data — show dashed placeholder
                      return (
                        <g key={barKey}>
                          <rect
                            x={0}
                            y={barY}
                            width={chartWidth * 0.15}
                            height={BAR_HEIGHT}
                            fill={theme.borderColor}
                            opacity={0.15}
                            rx={2}
                            strokeDasharray="4 2"
                            stroke={theme.textMuted}
                            strokeWidth={0.5}
                          />
                          <text
                            x={chartWidth * 0.15 + 6}
                            y={barY + BAR_HEIGHT / 2}
                            dominantBaseline="central"
                            fontSize={11}
                            fontFamily="'VT323', monospace"
                            fill={theme.textMuted}
                          >
                            {L.noData[lang]}
                          </text>
                        </g>
                      )
                    }

                    // For "lower is better", we still draw bar proportionally
                    // but use a subtle visual cue (left-pointing arrow)
                    const barWidth = Math.max(
                      (value / groupMax) * chartWidth,
                      2
                    )

                    return (
                      <g
                        key={barKey}
                        onMouseEnter={() => setHoveredBar(barKey)}
                        onMouseLeave={() => setHoveredBar(null)}
                        style={{ cursor: "default" }}
                      >
                        {/* Background track */}
                        <rect
                          x={0}
                          y={barY}
                          width={chartWidth}
                          height={BAR_HEIGHT}
                          fill={theme.borderColor}
                          opacity={0.08}
                          rx={2}
                        />
                        {/* Bar */}
                        <rect
                          x={0}
                          y={barY}
                          width={barWidth}
                          height={BAR_HEIGHT}
                          fill={color}
                          opacity={isHovered ? 0.95 : 0.75}
                          rx={2}
                          style={{
                            transition: "width 0.6s cubic-bezier(0.22,1,0.36,1), opacity 0.2s ease",
                          }}
                        />
                        {/* Lower-is-better indicator arrow */}
                        {!b.higher_is_better && (
                          <path
                            d={`M${Math.min(barWidth + 2, chartWidth - 8)},${barY + BAR_HEIGHT / 2 - 3} l-5,3 l5,3`}
                            fill={color}
                            opacity={0.6}
                          />
                        )}
                      </g>
                    )
                  })}
                </g>
              )
            })}
          </svg>

          {/* Right: raw values */}
          <div
            className="flex-shrink-0 flex flex-col justify-start"
            style={{
              width: RIGHT_VALUE_WIDTH,
              paddingTop: CHART_PADDING_TOP,
              paddingLeft: 8,
            }}
          >
            {benchmarks.map((b, bIdx) => (
              <div
                key={b.key}
                className="flex flex-col justify-center"
                style={{
                  height:
                    models.length * (BAR_HEIGHT + BAR_GAP) - BAR_GAP,
                  marginTop: bIdx > 0 ? BENCHMARK_GAP : 0,
                }}
              >
                {models.map((m, mIdx) => {
                  const value = m.benchmarks[b.key]
                  return (
                    <div
                      key={m.slug}
                      className="flex items-center"
                      style={{
                        height: BAR_HEIGHT,
                        marginTop: mIdx > 0 ? BAR_GAP : 0,
                      }}
                    >
                      <span
                        className="text-xs tabular-nums"
                        style={{
                          fontFamily: "'VT323', monospace",
                          color:
                            value !== undefined
                              ? getModelColor(mIdx)
                              : theme.textMuted,
                        }}
                      >
                        {value !== undefined
                          ? typeof value === "number"
                            ? value % 1 === 0
                              ? value
                              : value.toFixed(1)
                            : value
                          : "--"}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Coverage footer
  // ------------------------------------------------------------------

  function renderCoverage() {
    return (
      <div
        className="mt-4 pt-3 flex flex-wrap gap-x-6 gap-y-2"
        style={{ borderTop: `1px solid ${theme.borderColor}` }}
      >
        {models.map((m, mIdx) => {
          const cs = m.categoryScores[categoryKey]
          if (!cs) return null

          const level = getCoverageLevel(cs.coverage)
          const color = getModelColor(mIdx)

          const coveragePct = Math.round(cs.score)
          const coverageText = `${cs.availableCount}/${cs.benchmarkCount} ${L.items[lang]}`

          let borderStyle: string
          let textColor: string
          let bgOpacity: number

          switch (level) {
            case "solid":
              borderStyle = `2px solid ${color}`
              textColor = color
              bgOpacity = 0.08
              break
            case "warn":
              borderStyle = `2px dashed ${color}`
              textColor = color
              bgOpacity = 0.05
              break
            case "insufficient":
              borderStyle = `2px dashed ${theme.textMuted}`
              textColor = theme.textMuted
              bgOpacity = 0.03
              break
          }

          return (
            <div
              key={m.slug}
              className="flex items-center gap-2 px-3 py-1.5 rounded"
              style={{
                border: borderStyle,
                backgroundColor:
                  level === "insufficient"
                    ? `${theme.textMuted}${Math.round(bgOpacity * 255)
                        .toString(16)
                        .padStart(2, "0")}`
                    : `${color}${Math.round(bgOpacity * 255)
                        .toString(16)
                        .padStart(2, "0")}`,
              }}
            >
              {/* Color dot */}
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              {/* Model name */}
              <span
                className="text-xs truncate max-w-[100px]"
                style={{
                  fontFamily: "'EB Garamond', serif",
                  color: theme.textPrimary,
                }}
                title={m.name}
              >
                {m.name}
              </span>
              {/* Score */}
              <span
                className="text-sm font-bold tabular-nums"
                style={{
                  fontFamily: "'VT323', monospace",
                  color: textColor,
                }}
              >
                {coveragePct}
              </span>
              {/* Coverage fraction */}
              <span
                className="text-[10px]"
                style={{
                  fontFamily: "'VT323', monospace",
                  color: theme.textMuted,
                }}
              >
                ({coverageText}
                {level === "solid" ? " \u2713" : ""}
                {level === "insufficient"
                  ? ` ${L.insufficient[lang]}`
                  : ""}
                )
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Main render
  // ------------------------------------------------------------------

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className="paper-card-flat w-full mt-4 p-4 sm:p-6 overflow-hidden"
      style={{
        animation: "categoryDetailSlideIn 0.3s ease-out",
      }}
    >
      {/* Inline keyframes for mount animation */}
      <style>{`
        @keyframes categoryDetailSlideIn {
          from {
            opacity: 0;
            transform: translateY(-12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {/* Category icon */}
          {category.icon && (
            <span className="text-lg" aria-hidden>
              {category.icon}
            </span>
          )}
          {/* Category label */}
          <h3
            className="text-lg font-semibold"
            style={{
              fontFamily: "'EB Garamond', serif",
              color: catColor,
            }}
          >
            {getCategoryLabel(categoryKey)}
          </h3>
          {/* Benchmark count badge */}
          <span
            className="text-[11px] px-1.5 py-0.5 rounded"
            style={{
              fontFamily: "'VT323', monospace",
              color: theme.textMuted,
              border: `1px solid ${theme.borderColor}`,
            }}
          >
            {category.benchmarks.length} benchmarks
          </span>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors
                     hover:bg-[var(--border-color)]"
          style={{
            fontFamily: "'VT323', monospace",
            color: theme.textSecondary,
            border: `1px solid ${theme.borderColor}`,
          }}
          aria-label={L.close[lang]}
        >
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
          {L.close[lang]}
        </button>
      </div>

      {/* Model legend (compact, inline) */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4">
        {models.map((m, i) => (
          <div key={m.slug} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: getModelColor(i) }}
            />
            <span
              className="text-xs"
              style={{
                fontFamily: "'EB Garamond', serif",
                color: theme.textPrimary,
              }}
            >
              {m.name}
            </span>
          </div>
        ))}
      </div>

      {/* Bar chart groups (responsive: stacked on mobile) */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: 360 }}>
          {groups.map((g, idx) => renderBarGroup(g, idx))}
        </div>
      </div>

      {/* Coverage footer */}
      <div>
        <p
          className="text-xs mt-4 mb-0"
          style={{
            fontFamily: "'VT323', monospace",
            color: theme.textMuted,
          }}
        >
          {L.normalized[lang]} / {L.coverage[lang]}
        </p>
        {renderCoverage()}
      </div>
    </div>
  )
}
