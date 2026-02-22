import { scaleLog, scaleLinear } from "d3-scale"
import { line } from "d3-shape"

export interface ScatterPoint {
  x: number // avg price
  y: number // composite score
  slug: string
  name: string
  isPareto: boolean
  isReasoning: boolean
  confirmed: boolean
  color: string
  inputPrice: number
  outputPrice: number
  pricingSource?: string
}

export interface LabelPosition {
  x: number
  y: number
  text: string
  anchor: "start" | "middle" | "end"
}

export function createScales(
  width: number,
  height: number,
  margin: { top: number; right: number; bottom: number; left: number },
  data: ScatterPoint[]
) {
  const prices = data.map((d) => d.x)
  const minPrice = Math.max(0.3, Math.min(...prices) * 0.6)
  const maxPrice = Math.max(...prices) * 1.8

  const xScale = scaleLog()
    .domain([minPrice, maxPrice])
    .range([margin.left, width - margin.right])
    .clamp(true)

  const yScale = scaleLinear()
    .domain([0, 100])
    .range([height - margin.bottom, margin.top])

  return { xScale, yScale }
}

export function getXTicks(): number[] {
  return [0.5, 1, 2, 5, 10, 15, 25]
}

export function getYTicks(): number[] {
  return [0, 20, 40, 60, 80, 100]
}

/**
 * Compute Pareto frontier line path.
 * Sort Pareto points by price ascending, connect with d3.line.
 */
export function getParetoLinePath(
  paretoPoints: ScatterPoint[],
  xScale: (v: number) => number,
  yScale: (v: number) => number
): string {
  if (paretoPoints.length < 2) return ""

  const sorted = [...paretoPoints].sort((a, b) => a.x - b.x)

  // Extend to edges for visual effect
  const pathGen = line<ScatterPoint>()
    .x((d) => xScale(d.x))
    .y((d) => yScale(d.y))

  return pathGen(sorted) ?? ""
}

/**
 * Greedy label collision avoidance.
 * Offsets labels vertically to maintain minimum spacing.
 */
export function avoidLabelCollisions(
  labels: LabelPosition[],
  minSpacing: number = 14
): LabelPosition[] {
  if (labels.length === 0) return []

  // Sort by y position
  const sorted = [...labels].sort((a, b) => a.y - b.y)
  const result: LabelPosition[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const prev = result[result.length - 1]
    const current = { ...sorted[i] }

    if (current.y - prev.y < minSpacing) {
      current.y = prev.y + minSpacing
    }

    result.push(current)
  }

  return result
}

/**
 * Get quadrant hint positions and labels.
 */
export function getQuadrantHints(
  xScale: (v: number) => number,
  yScale: (v: number) => number,
  xMid: number,
  yMid: number
): Array<{ x: number; y: number; text: string; textEn: string }> {
  return [
    {
      x: xScale(xMid * 0.4),
      y: yScale(yMid + (100 - yMid) * 0.5),
      text: "高性能低成本",
      textEn: "High perf, Low cost",
    },
    {
      x: xScale(xMid * 3),
      y: yScale(yMid + (100 - yMid) * 0.5),
      text: "高性能高成本",
      textEn: "High perf, High cost",
    },
    {
      x: xScale(xMid * 0.4),
      y: yScale(yMid * 0.4),
      text: "低性能低成本",
      textEn: "Low perf, Low cost",
    },
    {
      x: xScale(xMid * 3),
      y: yScale(yMid * 0.4),
      text: "低性能高成本",
      textEn: "Low perf, High cost",
    },
  ]
}

/**
 * Get triangle path for reasoning model marker.
 */
export function getTrianglePath(cx: number, cy: number, size: number = 7): string {
  const h = size * 1.5
  return `M${cx},${cy - h} L${cx - h},${cy + h * 0.6} L${cx + h},${cy + h * 0.6} Z`
}
