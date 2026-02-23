// d3-shape imports removed as they are no longer needed

export interface Point {
  x: number
  y: number
}

/**
 * Get vertex positions for a regular polygon (pentagon for 5 axes).
 * Starts from top (-90deg) and goes clockwise.
 */
export function getVertexPositions(
  cx: number,
  cy: number,
  radius: number,
  count: number
): Point[] {
  const angleStep = (2 * Math.PI) / count
  const startAngle = -Math.PI / 2 // start from top

  return Array.from({ length: count }, (_, i) => {
    const angle = startAngle + i * angleStep
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    }
  })
}

export function getPentagonPath(
  cx: number,
  cy: number,
  radius: number,
  count: number = 5
): string {
  const angleStep = (2 * Math.PI) / count
  const startAngle = -Math.PI / 2

  const points = Array.from({ length: count }, (_, i) => {
    const angle = startAngle + i * angleStep
    return {
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    }
  })

  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join("") + "Z"
}

/**
 * Generate SVG path for a model's score polygon.
 * Scores should be 0-100, mapped to 0-maxRadius.
 */
export function getModelPolygonPath(
  scores: number[],
  cx: number,
  cy: number,
  maxRadius: number
): string {
  const count = scores.length
  const angleStep = (2 * Math.PI) / count
  const startAngle = -Math.PI / 2

  const points = scores.map((score, i) => {
    const angle = startAngle + i * angleStep
    const r = (score / 100) * maxRadius
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    }
  })

  if (points.length === 0) return ""
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join("") + "Z"
}

/**
 * Get the position for an axis label, offset outward from the vertex.
 */
export function getAxisLabelPosition(
  cx: number,
  cy: number,
  radius: number,
  index: number,
  count: number,
  offset: number = 24
): Point & { textAnchor: "start" | "middle" | "end"; dy: string } {
  const angleStep = (2 * Math.PI) / count
  const startAngle = -Math.PI / 2
  const angle = startAngle + index * angleStep
  const r = radius + offset

  const x = cx + r * Math.cos(angle)
  const y = cy + r * Math.sin(angle)

  // Determine text anchor based on position
  const normalizedAngle = ((angle + 2 * Math.PI) % (2 * Math.PI))
  let textAnchor: "start" | "middle" | "end" = "middle"
  let dy = "0.35em"

  if (normalizedAngle > 0.1 && normalizedAngle < Math.PI - 0.1) {
    textAnchor = "start"
  } else if (normalizedAngle > Math.PI + 0.1 && normalizedAngle < 2 * Math.PI - 0.1) {
    textAnchor = "end"
  }

  // Top vertex
  if (Math.abs(normalizedAngle - 3 * Math.PI / 2) < 0.1 || Math.abs(normalizedAngle + Math.PI / 2) < 0.1) {
    dy = "-0.3em"
  }
  // Bottom vertices
  if (normalizedAngle > 0.3 && normalizedAngle < Math.PI - 0.3) {
    dy = "1em"
  }

  return { x, y, textAnchor, dy }
}

/**
 * Get vertex position for a specific score on a specific axis.
 */
export function getScoreVertex(
  score: number,
  axisIndex: number,
  axisCount: number,
  cx: number,
  cy: number,
  maxRadius: number
): Point {
  const angleStep = (2 * Math.PI) / axisCount
  const startAngle = -Math.PI / 2
  const angle = startAngle + axisIndex * angleStep
  const r = (score / 100) * maxRadius

  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  }
}
