"use client"

import { useMemo, useState, useCallback } from "react"
import type { ModelWithScores, Categories } from "@/lib/types"
import { getModelColor, CATEGORY_COLORS } from "@/lib/colors"
import { useChartDimensions } from "./useChartDimensions"
import { useChartTheme } from "./useChartTheme"
import {
  getVertexPositions,
  getPentagonPath,
  getModelPolygonPath,
  getAxisLabelPosition,
  getScoreVertex,
} from "./RadarHelpers"
import { ChartTooltip, useTooltip } from "./ChartTooltip"
import ChartLegend from "./ChartLegend"
import { useLocale } from "@/lib/i18n-context"

// Category icon SVG paths (inline, no foreignObject)
const CATEGORY_ICON_PATHS: Record<string, { path: string; viewBox: string }> = {
  reasoning: {
    path: "M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17a1 1 0 001 1h6a1 1 0 001-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z",
    viewBox: "0 0 24 24",
  },
  coding: {
    path: "M16 18l6-6-6-6M8 6l-6 6 6 6",
    viewBox: "0 0 24 24",
  },
  math: {
    path: "M4.5 6h3l-3 12h3M12 6v12M9.5 12h5M17 6l3.5 12M17 12h3.5",
    viewBox: "0 0 24 24",
  },
  chat: {
    path: "M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z",
    viewBox: "0 0 24 24",
  },
  agentic: {
    path: "M5 4h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zM9 16v2a2 2 0 002 2h2a2 2 0 002-2v-2",
    viewBox: "0 0 24 24",
  },
}

interface D3RadarChartProps {
  models: ModelWithScores[]
  categories: Categories
  onCategoryClick?: (categoryKey: string) => void
}

export default function D3RadarChart({
  models,
  categories,
  onCategoryClick,
}: D3RadarChartProps) {
  const [containerRef, { width }] = useChartDimensions()
  const theme = useChartTheme()
  const { tooltip, showTooltip, moveTooltip, hideTooltip } = useTooltip()
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null)
  const { getCategoryLabel, locale } = useLocale()

  const categoryKeys = useMemo(() => Object.keys(categories), [categories])
  const axisCount = categoryKeys.length

  // Responsive sizing — keep square aspect ratio for symmetric pentagon
  const size = Math.min(width, 520)
  const height = size > 0 ? size : 420
  const cx = size / 2
  const cy = height / 2
  const maxRadius = Math.min(cx, cy) - 55

  // Grid layers at 20/40/60/80/100
  const gridLevels = [20, 40, 60, 80, 100]

  // Axis lines from center to vertices
  const outerVertices = useMemo(
    () => getVertexPositions(cx, cy, maxRadius, axisCount),
    [cx, cy, maxRadius, axisCount]
  )

  // Model polygons
  const modelPolygons = useMemo(
    () =>
      models.map((m, i) => {
        const scores = categoryKeys.map((key) => {
          const cs = m.categoryScores[key]
          return cs ? Math.round(cs.score) : 0
        })
        const vertices = scores.map((score, idx) =>
          getScoreVertex(score, idx, categoryKeys.length, cx, cy, maxRadius)
        )
        return {
          model: m,
          index: i,
          path: getModelPolygonPath(scores, cx, cy, maxRadius),
          scores,
          color: getModelColor(i),
          vertices,
        }
      }),
    [models, categoryKeys, cx, cy, maxRadius]
  )

  // Distance squared from point (px,py) to the nearest point on segment (ax,ay)-(bx,by)
  const distSqToSegment = useCallback(
    (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
      const abx = bx - ax, aby = by - ay
      const apx = px - ax, apy = py - ay
      const ab2 = abx * abx + aby * aby
      if (ab2 === 0) return apx * apx + apy * apy
      const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2))
      const projX = ax + t * abx, projY = ay + t * aby
      const dx = px - projX, dy = py - projY
      return dx * dx + dy * dy
    },
    []
  )

  // Find nearest model by minimum distance to polygon edges (line segments)
  const findNearestModel = useCallback(
    (px: number, py: number) => {
      let bestSlug: string | null = null
      let bestDist = Infinity
      for (const mp of modelPolygons) {
        const verts = mp.vertices
        const n = verts.length
        let minDist = Infinity
        for (let i = 0; i < n; i++) {
          const a = verts[i], b = verts[(i + 1) % n]
          const d = distSqToSegment(px, py, a.x, a.y, b.x, b.y)
          if (d < minDist) minDist = d
        }
        if (minDist < bestDist) {
          bestDist = minDist
          bestSlug = mp.model.slug
        }
      }
      // Only highlight if pointer is reasonably close
      if (bestDist > maxRadius * maxRadius) return null
      return bestSlug
    },
    [modelPolygons, maxRadius, distSqToSegment]
  )

  const handleOverlayMouseMove = useCallback(
    (e: React.MouseEvent<SVGRectElement>) => {
      const svg = e.currentTarget.closest("svg")
      if (!svg) return
      const pt = svg.createSVGPoint()
      pt.x = e.clientX
      pt.y = e.clientY
      const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse())
      const nearest = findNearestModel(svgPt.x, svgPt.y)
      setHoveredSlug(nearest)
      if (nearest) {
        const mp = modelPolygons.find((m) => m.model.slug === nearest)
        if (mp) {
          const scores = categoryKeys.map((key, idx) => ({
            label: getCategoryLabel(key),
            score: mp.scores[idx],
            color: CATEGORY_COLORS[key] || "#94a3b8",
          }))
          showTooltip(
            e,
            <div>
              <p className="font-heading font-semibold text-txt-primary mb-1.5">
                {mp.model.name}
              </p>
              {scores.map((s) => (
                <div
                  key={s.label}
                  className="flex items-center gap-2 font-mono text-xs"
                >
                  <span
                    className="w-2 h-2 inline-block flex-shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-txt-secondary">{s.label}</span>
                  <span className="text-txt-primary ml-auto font-semibold">
                    {s.score}
                  </span>
                </div>
              ))}
              <div className="border-t border-border mt-1.5 pt-1.5 flex justify-between font-mono text-xs">
                <span className="text-txt-secondary">Radar Score</span>
                <span className="text-accent-blue font-semibold">
                  {Math.round(mp.model.compositeScore)}
                </span>
              </div>
            </div>
          )
        }
      } else {
        hideTooltip()
      }
      moveTooltip(e)
    },
    [findNearestModel, modelPolygons, categoryKeys, getCategoryLabel, showTooltip, moveTooltip, hideTooltip, locale]
  )

  const handleOverlayMouseLeave = useCallback(() => {
    setHoveredSlug(null)
    hideTooltip()
  }, [hideTooltip])

  if (size === 0) {
    return <div ref={containerRef as React.RefObject<HTMLDivElement>} className="w-full" style={{ minHeight: 420 }} />
  }

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="w-full">
      <svg width={size} height={height} className="mx-auto block">
        <defs>
          {/* Gradients for each model polygon */}
          {modelPolygons.map((mp) => (
            <linearGradient
              key={`grad-${mp.model.slug}`}
              id={`radar-grad-${mp.model.slug}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor={mp.color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={mp.color} stopOpacity={0.08} />
            </linearGradient>
          ))}
        </defs>

        {/* Pentagon grid lines */}
        {gridLevels.map((level) => {
          const r = (level / 100) * maxRadius
          return (
            <path
              key={`grid-${level}`}
              d={getPentagonPath(cx, cy, r, axisCount)}
              transform={`translate(${cx}, ${cy})`}
              fill="none"
              stroke={theme.borderColor}
              strokeWidth={level === 100 ? 1 : 0.5}
              opacity={level === 100 ? 0.6 : 0.3}
            />
          )
        })}

        {/* Axis lines from center to vertices */}
        {outerVertices.map((v, i) => (
          <line
            key={`axis-${i}`}
            x1={cx}
            y1={cy}
            x2={v.x}
            y2={v.y}
            stroke={theme.borderColor}
            strokeWidth={0.5}
            opacity={0.4}
          />
        ))}

        {/* Grid level labels (on first axis) */}
        {gridLevels.map((level) => {
          const r = (level / 100) * maxRadius
          return (
            <text
              key={`label-${level}`}
              x={cx + 3}
              y={cy - r - 2}
              fontSize={10}
              fontFamily="'VT323', monospace"
              fill={theme.textMuted}
              opacity={0.6}
            >
              {level}
            </text>
          )
        })}

        {/* Model polygons */}
        {modelPolygons.map((mp) => {
          const isHovered = hoveredSlug === mp.model.slug
          const isOtherHovered = hoveredSlug !== null && !isHovered

          return (
            <g key={mp.model.slug} style={{ pointerEvents: "none" }}>
              {/* Filled polygon */}
              <path
                d={mp.path}
                fill={`url(#radar-grad-${mp.model.slug})`}
                stroke={mp.color}
                strokeWidth={isHovered ? 2.5 : 1.5}
                opacity={isOtherHovered ? 0.15 : 1}
                style={{ transition: "opacity 0.2s ease, stroke-width 0.2s ease" }}
              />

              {/* Score dots at vertices when hovered */}
              {isHovered &&
                mp.scores.map((score, idx) => {
                  const pos = getScoreVertex(score, idx, axisCount, cx, cy, maxRadius)
                  return (
                    <g key={idx}>
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={4}
                        fill={mp.color}
                        stroke="var(--bg-card)"
                        strokeWidth={2}
                      />
                      <text
                        x={pos.x}
                        y={pos.y - 10}
                        fontSize={11}
                        fontFamily="'VT323', monospace"
                        fill={mp.color}
                        textAnchor="middle"
                        fontWeight="bold"
                      >
                        {score}
                      </text>
                    </g>
                  )
                })}
            </g>
          )
        })}

        {/* Invisible overlay for proximity-based hover detection */}
        <rect
          x={0}
          y={0}
          width={size}
          height={height}
          fill="transparent"
          onMouseMove={handleOverlayMouseMove}
          onMouseLeave={handleOverlayMouseLeave}
        />

        {/* Axis labels with icons */}
        {categoryKeys.map((key, i) => {
          const labelPos = getAxisLabelPosition(cx, cy, maxRadius, i, axisCount, 32)
          const icon = CATEGORY_ICON_PATHS[key]
          const iconSize = 16
          const iconOffset = -22

          return (
            <g
              key={key}
              onClick={() => onCategoryClick?.(key)}
              style={{ cursor: onCategoryClick ? "pointer" : "default" }}
            >
              {/* Category icon */}
              {icon && (
                <g
                  transform={`translate(${labelPos.x - iconSize / 2}, ${labelPos.y + iconOffset - iconSize / 2})`}
                >
                  <path
                    d={icon.path}
                    fill="none"
                    stroke={CATEGORY_COLORS[key] || "#94a3b8"}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    transform={`scale(${iconSize / 24})`}
                    opacity={0.7}
                  />
                </g>
              )}
              {/* Category label */}
              <text
                x={labelPos.x}
                y={labelPos.y}
                textAnchor={labelPos.textAnchor}
                dy={labelPos.dy}
                fontSize={13}
                fontFamily="'EB Garamond', serif"
                fontStyle="italic"
                fill={CATEGORY_COLORS[key] || "#94a3b8"}
                fontWeight={500}
              >
                {getCategoryLabel(key)}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <ChartLegend
        models={models}
        hoveredSlug={hoveredSlug}
        onHover={setHoveredSlug}
      />

      <ChartTooltip data={tooltip} />
    </div>
  )
}
