import { CategoryResult } from "./types"

/**
 * Percentile rank normalization for metrics without fixed upper bounds
 * (e.g., output_tps in tok/s, ttft_ms in ms).
 * Returns 0-100 score based on rank among all models.
 */
export function percentileRank(
  value: number,
  allValues: number[],
  higherIsBetter = true
): number {
  const n = allValues.length
  if (n <= 1) return 50

  const sorted = [...allValues].sort((a, b) => a - b)
  const rank = sorted.filter((v) => v < value).length
  let score = (rank / (n - 1)) * 100

  if (!higherIsBetter) score = 100 - score

  return Math.round(score * 100) / 100
}

// 基于理论最大值的归一化函数
export function normalizeByMaxScore(
  value: number,
  maxScore: number | null,
  allValues: number[],
  higherIsBetter = true
): number {
  if (maxScore != null && maxScore > 0) {
    // 有理论上限的 benchmark：直接算百分比
    const score = (value / maxScore) * 100
    return higherIsBetter ? Math.min(score, 100) : Math.max(100 - score, 0)
  }
  // 无理论上限（如 ELO）：用 min-max 归一化，范围映射到 20-100
  // 避免最差的模型得 0 分（视觉上消失）
  const sorted = [...allValues].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  if (max === min) return 60
  const ratio = (value - min) / (max - min)
  const score = 20 + ratio * 80 // 映射到 20-100 区间
  return higherIsBetter ? score : 120 - score
}

export function normalize(
  value: number,
  allValues: number[],
  higherIsBetter = true
): number {
  const sorted = [...allValues].sort((a, b) => a - b)
  const n = sorted.length

  if (n <= 1) return 50

  const min = sorted[0]
  const max = sorted[n - 1]

  if (max === min) return 50

  let score: number

  if (n < 30) {
    // Scaled Rank: 排名位置线性映射
    const rank = sorted.filter((v) => v < value).length
    const ties = sorted.filter((v) => v === value).length
    const midRank = rank + (ties - 1) / 2
    score = (midRank / (n - 1)) * 100
  } else {
    const rank = sorted.filter((v) => v < value).length
    score = (rank / (n - 1)) * 100
  }

  return higherIsBetter ? score : 100 - score
}

export function categoryScore(
  benchmarks: { key: string; weight: number }[],
  scores: Record<string, number | null>
): CategoryResult {
  let totalWeight = 0
  let weightedSum = 0
  let available = 0

  for (const b of benchmarks) {
    if (scores[b.key] != null) {
      weightedSum += scores[b.key]! * b.weight
      totalWeight += b.weight
      available++
    }
  }

  const coverage = available / benchmarks.length

  return {
    score: totalWeight > 0 ? weightedSum / totalWeight : 0,
    coverage,
    isReliable: coverage >= 0.5,
    benchmarkCount: benchmarks.length,
    availableCount: available,
  }
}

export function compositeScore(
  categories: Record<string, CategoryResult>
): number {
  const entries = Object.values(categories)
  const reliable = entries.filter((c) => c.isReliable)

  if (reliable.length === 0) return 0

  // Divide by total category count (not just reliable ones) so that models
  // with partial data don't inflate their score relative to fully-tested models.
  // A model with only speed data (1/6 categories) gets at most ~17 points.
  return reliable.reduce((sum, c) => sum + c.score, 0) / entries.length
}

/** Radar Score — alias for compositeScore (our unified overall rating) */
export const radarIdx = compositeScore
