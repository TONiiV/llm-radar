import { CategoryResult } from "./types"

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

  return reliable.reduce((sum, c) => sum + c.score, 0) / reliable.length
}
