/**
 * Normalization & Scoring Tests
 *
 * Tests the normalize, categoryScore, compositeScore functions
 * and the < 50% coverage exclusion rule.
 */
import { describe, it, expect } from 'vitest'
import {
  normalizeByMaxScore,
  percentileRank,
  categoryScore,
  compositeScore,
} from '../lib/normalize'

describe('normalizeByMaxScore', () => {
  it('normalizes percentage benchmarks correctly', () => {
    // 75 out of 100 max = 75%
    expect(normalizeByMaxScore(75, 100, [50, 75, 90], true)).toBe(75)
  })

  it('caps at 100', () => {
    expect(normalizeByMaxScore(110, 100, [50, 110], true)).toBe(100)
  })

  it('inverts for lower-is-better', () => {
    // TTFT: lower is better, 25/100 → inverted = 75
    expect(normalizeByMaxScore(25, 100, [25, 50, 75], false)).toBe(75)
  })

  it('uses min-max for unbounded (ELO)', () => {
    const allValues = [1000, 1200, 1400]
    const score = normalizeByMaxScore(1200, null, allValues, true)
    // mid-point: 20 + 0.5 * 80 = 60
    expect(score).toBe(60)
  })
})

describe('percentileRank', () => {
  it('computes rank-based score', () => {
    const values = [10, 20, 30, 40, 50]
    // 30 is at index 2, 2 values below it, rank = 2/(5-1) = 0.5 → 50
    expect(percentileRank(30, values, true)).toBe(50)
  })

  it('returns 50 for single value', () => {
    expect(percentileRank(100, [100], true)).toBe(50)
  })

  it('inverts for lower-is-better', () => {
    const values = [10, 20, 30, 40, 50]
    // 30 → rank 50, inverted → 50
    expect(percentileRank(30, values, false)).toBe(50)
    // 10 (best for lower-is-better) → rank 0, inverted → 100
    expect(percentileRank(10, values, false)).toBe(100)
  })
})

describe('categoryScore', () => {
  it('calculates weighted average of available benchmarks', () => {
    const benchmarks = [
      { key: 'a', weight: 1.0 },
      { key: 'b', weight: 1.0 },
    ]
    const scores = { a: 80, b: 60 }
    const result = categoryScore(benchmarks, scores)
    expect(result.score).toBe(70)
    expect(result.coverage).toBe(1.0)
    expect(result.isReliable).toBe(true)
  })

  it('handles partial coverage', () => {
    const benchmarks = [
      { key: 'a', weight: 1.0 },
      { key: 'b', weight: 1.0 },
      { key: 'c', weight: 1.0 },
    ]
    const scores: Record<string, number | null> = { a: 90, b: null, c: null }
    const result = categoryScore(benchmarks, scores)
    expect(result.score).toBe(90)
    expect(result.coverage).toBeCloseTo(1 / 3)
    expect(result.isReliable).toBe(false) // < 50%
  })

  it('marks unreliable when coverage < 50%', () => {
    const benchmarks = [
      { key: 'a', weight: 1.0 },
      { key: 'b', weight: 1.0 },
      { key: 'c', weight: 1.0 },
    ]
    const scores: Record<string, number | null> = { a: 80, b: null, c: null }
    const result = categoryScore(benchmarks, scores)
    expect(result.isReliable).toBe(false)
  })
})

describe('compositeScore', () => {
  it('averages only reliable categories', () => {
    const catScores = {
      reasoning: { score: 80, coverage: 1.0, isReliable: true, benchmarkCount: 2, availableCount: 2 },
      coding: { score: 60, coverage: 1.0, isReliable: true, benchmarkCount: 2, availableCount: 2 },
      math: { score: 40, coverage: 0.3, isReliable: false, benchmarkCount: 2, availableCount: 1 },
    }
    // Only reasoning (80) + coding (60) → average = 70
    expect(compositeScore(catScores)).toBe(70)
  })

  it('returns 0 when no categories are reliable', () => {
    const catScores = {
      reasoning: { score: 80, coverage: 0.3, isReliable: false, benchmarkCount: 2, availableCount: 1 },
    }
    expect(compositeScore(catScores)).toBe(0)
  })
})

describe('50% Coverage Rule', () => {
  it('categoryScore.isReliable follows 50% threshold', () => {
    // 1/2 benchmarks = 50% → reliable
    const half = categoryScore(
      [{ key: 'a', weight: 1 }, { key: 'b', weight: 1 }],
      { a: 80, b: null }
    )
    expect(half.isReliable).toBe(true) // 0.5 >= 0.5

    // 0/2 benchmarks = 0% → unreliable
    const none = categoryScore(
      [{ key: 'a', weight: 1 }, { key: 'b', weight: 1 }],
      { a: null, b: null }
    )
    expect(none.isReliable).toBe(false)
  })

  it('compositeScore excludes unreliable categories', () => {
    const scores = {
      good: { score: 90, coverage: 1.0, isReliable: true, benchmarkCount: 2, availableCount: 2 },
      bad: { score: 50, coverage: 0.2, isReliable: false, benchmarkCount: 2, availableCount: 0 },
    }
    expect(compositeScore(scores)).toBe(90) // only 'good' contributes
  })
})
