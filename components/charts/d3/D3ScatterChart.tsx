"use client"

import { useMemo, useState } from "react"
import type { ModelWithScores, Sources } from "@/lib/types"
import { getModelColor } from "@/lib/colors"
import { avgPricePer1M, formatPrice } from "@/lib/pricing"
import { useChartDimensions } from "./useChartDimensions"
import { useChartTheme } from "./useChartTheme"
import {
  createScales,
  getXTicks,
  getYTicks,
  getParetoLinePath,
  avoidLabelCollisions,
  getQuadrantHints,
  getTrianglePath,
  type ScatterPoint,
} from "./ScatterHelpers"
import { ChartTooltip, useTooltip } from "./ChartTooltip"
import { useLocale } from "@/lib/i18n-context"
import SourceIcon from "@/components/SourceIcon"

interface D3ScatterChartProps {
  models: ModelWithScores[]
  selectedSlugs: string[]
  paretoSlugs: string[]
  sources: Sources
}

const MARGIN = { top: 25, right: 30, bottom: 50, left: 55 }

export default function D3ScatterChart({
  models,
  selectedSlugs,
  paretoSlugs,
  sources,
}: D3ScatterChartProps) {
  const [containerRef, { width }] = useChartDimensions()
  const theme = useChartTheme()
  const { tooltip, showTooltip, moveTooltip, hideTooltip } = useTooltip()
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null)
  const [pricingMode, setPricingMode] = useState<"average" | "input" | "output">("average")
  const { t, locale } = useLocale()

  const height = Math.max(320, Math.min(width * 0.65, 420))

  // Prepare scatter data
  const data: ScatterPoint[] = useMemo(() => {
    const selected = models.filter((m) => selectedSlugs.includes(m.slug))
    return selected.map((m, i) => {
      let xValue = avgPricePer1M(m.pricing.input_per_1m, m.pricing.output_per_1m)
      if (pricingMode === "input") xValue = m.pricing.input_per_1m
      if (pricingMode === "output") xValue = m.pricing.output_per_1m
      
      return {
        x: xValue,
        y: Math.round(m.compositeScore),
        slug: m.slug,
        name: m.name,
        isPareto: paretoSlugs.includes(m.slug),
        isReasoning: m.is_reasoning_model,
        confirmed: m.pricing.confirmed,
        color: getModelColor(i),
        inputPrice: m.pricing.input_per_1m,
        outputPrice: m.pricing.output_per_1m,
        pricingSource: m.pricing.source,
      }
    })
  }, [models, selectedSlugs, paretoSlugs, pricingMode])

  const { xScale, yScale } = useMemo(
    () => createScales(width, height, MARGIN, data),
    [width, height, data]
  )

  const paretoPoints = useMemo(
    () => data.filter((d) => d.isPareto),
    [data]
  )

  const paretoPath = useMemo(
    () => getParetoLinePath(paretoPoints, xScale, yScale),
    [paretoPoints, xScale, yScale]
  )

  // Labels with collision avoidance
  const labels = useMemo(() => {
    const raw = data.map((d) => ({
      x: xScale(d.x) + 10,
      y: yScale(d.y),
      text: d.name,
      anchor: "start" as const,
    }))
    return avoidLabelCollisions(raw, 14)
  }, [data, xScale, yScale])

  // Median lines
  const medianX = useMemo(() => {
    if (data.length === 0) return 1
    const sorted = [...data.map((d) => d.x)].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]
  }, [data])

  const medianY = useMemo(() => {
    if (data.length === 0) return 50
    const sorted = [...data.map((d) => d.y)].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]
  }, [data])

  // Quadrant hints
  const quadrantHints = useMemo(
    () => getQuadrantHints(xScale, yScale, medianX, medianY),
    [xScale, yScale, medianX, medianY]
  )

  if (width === 0) {
    return <div ref={containerRef as React.RefObject<HTMLDivElement>} className="w-full" style={{ minHeight: 380 }} />
  }

  const xTicks = (() => {
    const rawTicks = getXTicks().filter((v) => {
      const px = xScale(v)
      return px >= MARGIN.left && px <= width - MARGIN.right
    })
    
    // Filter ticks that are too close to each other
    let lastPx = -100
    return rawTicks.filter((v) => {
      const px = Math.round(xScale(v))
      if (px - lastPx < 30) return false
      lastPx = px
      return true
    })
  })();
  const yTicks = getYTicks()

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="w-full flex flex-col">
      <div className="flex justify-end mb-4 mr-4">
        <div className="inline-flex bg-bg-secondary rounded-md p-1 font-mono text-xs">
          <button
            onClick={() => setPricingMode("average")}
            className={`px-3 py-1.5 rounded-sm transition-colors ${
              pricingMode === "average" ? "bg-bg-primary text-txt-primary shadow-sm" : "text-txt-muted hover:text-txt-primary"
            }`}
          >
            {locale === "zh" ? "平均 (Average)" : "Average"}
          </button>
          <button
            onClick={() => setPricingMode("input")}
            className={`px-3 py-1.5 rounded-sm transition-colors ${
              pricingMode === "input" ? "bg-bg-primary text-txt-primary shadow-sm" : "text-txt-muted hover:text-txt-primary"
            }`}
          >
            {locale === "zh" ? "输入 (Input)" : "Input"}
          </button>
          <button
            onClick={() => setPricingMode("output")}
            className={`px-3 py-1.5 rounded-sm transition-colors ${
              pricingMode === "output" ? "bg-bg-primary text-txt-primary shadow-sm" : "text-txt-muted hover:text-txt-primary"
            }`}
          >
            {locale === "zh" ? "输出 (Output)" : "Output"}
          </button>
        </div>
      </div>
      <svg width={width} height={height} className="block">
        {/* Grid lines */}
        {xTicks.map((v) => (
          <line
            key={`xgrid-${v}`}
            x1={xScale(v)}
            y1={MARGIN.top}
            x2={xScale(v)}
            y2={height - MARGIN.bottom}
            stroke={theme.borderColor}
            strokeWidth={0.5}
            opacity={0.3}
          />
        ))}
        {yTicks.map((v) => (
          <line
            key={`ygrid-${v}`}
            x1={MARGIN.left}
            y1={yScale(v)}
            x2={width - MARGIN.right}
            y2={yScale(v)}
            stroke={theme.borderColor}
            strokeWidth={0.5}
            opacity={0.3}
          />
        ))}

        {/* Median reference lines */}
        <line
          x1={xScale(medianX)}
          y1={MARGIN.top}
          x2={xScale(medianX)}
          y2={height - MARGIN.bottom}
          stroke={theme.borderColor}
          strokeWidth={0.5}
          strokeDasharray="6 4"
          opacity={0.2}
        />
        <line
          x1={MARGIN.left}
          y1={yScale(medianY)}
          x2={width - MARGIN.right}
          y2={yScale(medianY)}
          stroke={theme.borderColor}
          strokeWidth={0.5}
          strokeDasharray="6 4"
          opacity={0.2}
        />

        {/* Quadrant hint text */}
        {quadrantHints.map((hint, i) => (
          <text
            key={`quad-${i}`}
            x={hint.x}
            y={hint.y}
            textAnchor="middle"
            fontSize={11}
            fontFamily="'EB Garamond', serif"
            fontStyle="italic"
            fill={theme.textMuted}
            opacity={0.12}
          >
            {locale === "zh" ? hint.text : hint.textEn}
          </text>
        ))}

        {/* X axis */}
        <line
          x1={MARGIN.left}
          y1={height - MARGIN.bottom}
          x2={width - MARGIN.right}
          y2={height - MARGIN.bottom}
          stroke={theme.borderColor}
          strokeWidth={1}
        />
        {xTicks.map((v) => (
          <text
            key={`xtick-${v}`}
            x={xScale(v)}
            y={height - MARGIN.bottom + 16}
            textAnchor="middle"
            fontSize={11}
            fontFamily="'VT323', monospace"
            fill={theme.textMuted}
          >
            ${v}
          </text>
        ))}
        <text
          x={(MARGIN.left + width - MARGIN.right) / 2}
          y={height - 6}
          textAnchor="middle"
          fontSize={12}
          fontFamily="'EB Garamond', serif"
          fontStyle="italic"
          fill={theme.textSecondary}
        >
          {pricingMode === "average" 
            ? t("chart.avgPriceAxis") 
            : pricingMode === "input" 
              ? (locale === "zh" ? "输入价格 / 1M token (Log scale)" : "Input price per 1M tokens (log scale)")
              : (locale === "zh" ? "输出价格 / 1M token (Log scale)" : "Output price per 1M tokens (log scale)")}
        </text>

        {/* Y axis */}
        <line
          x1={MARGIN.left}
          y1={MARGIN.top}
          x2={MARGIN.left}
          y2={height - MARGIN.bottom}
          stroke={theme.borderColor}
          strokeWidth={1}
        />
        {yTicks.map((v) => (
          <text
            key={`ytick-${v}`}
            x={MARGIN.left - 8}
            y={yScale(v) + 4}
            textAnchor="end"
            fontSize={11}
            fontFamily="'VT323', monospace"
            fill={theme.textMuted}
          >
            {v}
          </text>
        ))}
        <text
          x={14}
          y={(MARGIN.top + height - MARGIN.bottom) / 2}
          textAnchor="middle"
          fontSize={12}
          fontFamily="'EB Garamond', serif"
          fontStyle="italic"
          fill={theme.textSecondary}
          transform={`rotate(-90, 14, ${(MARGIN.top + height - MARGIN.bottom) / 2})`}
        >
          {t("chart.compositeAxis")}
        </text>

        {/* Pareto frontier line */}
        {paretoPath && (
          <path
            d={paretoPath}
            fill="none"
            stroke="#22C55E"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            opacity={0.6}
          />
        )}

        {/* Data points */}
        {data.map((d, i) => {
          const px = xScale(d.x)
          const py = yScale(d.y)
          const isHovered = hoveredSlug === d.slug
          const isOtherHovered = hoveredSlug !== null && !isHovered

          return (
            <g
              key={d.slug}
              style={{
                opacity: isOtherHovered ? 0.3 : 1,
                transition: "opacity 0.2s ease",
              }}
              onMouseEnter={(e) => {
                setHoveredSlug(d.slug)
                showTooltip(
                  e,
                  <div>
                    <p className="font-heading font-semibold text-txt-primary">
                      {d.name}
                    </p>
                    <p className="font-mono text-xs text-txt-secondary">
                      {t("chart.overallAbility")}: {d.y}/100
                    </p>
                    <p className="font-mono text-xs text-txt-secondary">
                      {t("chart.input")}: {d.confirmed ? "" : "~"}
                      {formatPrice(d.inputPrice)}/1M
                    </p>
                    <p className="font-mono text-xs text-txt-secondary">
                      {t("chart.output")}: {d.confirmed ? "" : "~"}
                      {formatPrice(d.outputPrice)}/1M
                    </p>
                    <p className="font-mono text-xs text-txt-secondary inline-flex items-center gap-0.5">
                      {pricingMode === "average" 
                        ? t("chart.avgPrice") 
                        : pricingMode === "input" 
                          ? (locale === "zh" ? "输入价格" : "Input Price")
                          : (locale === "zh" ? "输出价格" : "Output Price")}: {formatPrice(d.x)}/1M
                      {d.pricingSource && (
                        <SourceIcon sourceKey={d.pricingSource} sources={sources} size={11} />
                      )}
                    </p>
                    {d.isPareto && (
                      <p className="font-mono text-xs font-medium mt-1" style={{ color: "#22C55E" }}>
                        {t("chart.paretoFrontier")}
                      </p>
                    )}
                    {d.isReasoning && (
                      <p className="font-mono text-xs font-medium text-accent-orange">
                        {t("chart.reasoningModel")}
                      </p>
                    )}
                  </div>
                )
              }}
              onMouseMove={moveTooltip}
              onMouseLeave={() => {
                setHoveredSlug(null)
                hideTooltip()
              }}
            >
              {d.isReasoning ? (
                <path
                  d={getTrianglePath(px, py, isHovered ? 9 : 7)}
                  fill={d.color}
                  stroke={d.isPareto ? "#22C55E" : theme.borderColor}
                  strokeWidth={d.isPareto ? 2 : 1}
                  style={{ transition: "all 0.15s ease" }}
                />
              ) : (
                <circle
                  cx={px}
                  cy={py}
                  r={isHovered ? 8 : 6}
                  fill={d.color}
                  stroke={d.isPareto ? "#22C55E" : theme.borderColor}
                  strokeWidth={d.isPareto ? 2 : 1}
                  style={{ transition: "all 0.15s ease" }}
                />
              )}
            </g>
          )
        })}

        {/* Model name labels */}
        {labels.map((label, i) => {
          const d = data[i]
          if (!d) return null
          const isOtherHovered = hoveredSlug !== null && hoveredSlug !== d.slug
          return (
            <text
              key={`label-${d.slug}`}
              x={label.x}
              y={label.y}
              textAnchor={label.anchor}
              fontSize={11}
              fontFamily="'VT323', monospace"
              fill={theme.textSecondary}
              opacity={isOtherHovered ? 0.2 : 0.8}
              style={{ transition: "opacity 0.2s ease" }}
            >
              {label.text}
            </text>
          )
        })}
      </svg>

      <ChartTooltip data={tooltip} />
    </div>
  )
}
