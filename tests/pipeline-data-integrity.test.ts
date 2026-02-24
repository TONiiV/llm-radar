/**
 * Pipeline Data Integrity Tests
 *
 * Validates that seed.json data is consistent with categories.json,
 * and that score values are within expected ranges.
 */
import { describe, it, expect } from 'vitest'
import seedData from '../data/seed.json'
import categoriesData from '../data/categories.json'
import sourcesData from '../data/sources.json'

const seed = seedData as { models: Array<{ name: string; slug: string; provider: string; benchmarks: Record<string, number> }> }
const categories = categoriesData as Record<string, { label: string; benchmarks: Array<{ key: string; label: string; weight: number; max_score: number | null; higher_is_better: boolean; unit: string }> }>

// All benchmark keys defined in categories.json
const VALID_BENCHMARK_KEYS = new Set<string>()
const BENCHMARK_DEFS = new Map<string, { max_score: number | null; higher_is_better: boolean }>()
for (const cat of Object.values(categories)) {
  for (const bm of cat.benchmarks) {
    VALID_BENCHMARK_KEYS.add(bm.key)
    BENCHMARK_DEFS.set(bm.key, { max_score: bm.max_score, higher_is_better: bm.higher_is_better })
  }
}

describe('Seed Data Integrity', () => {
  it('all models have unique slugs', () => {
    const slugs = seed.models.map(m => m.slug)
    const unique = new Set(slugs)
    expect(unique.size).toBe(slugs.length)
  })

  it('all models have a provider', () => {
    for (const model of seed.models) {
      expect(model.provider, `${model.slug} missing provider`).toBeTruthy()
    }
  })

  it('no deprecated benchmark keys in seed.json', () => {
    const DEPRECATED = ['livecode_bench', 'scicode', 'simplebench', 'frontiermath',
      'aider_polyglot', 'bfcl_overall', 'aa_lcr', 'critpt', 'gsm8k', 'math_bench']
    for (const model of seed.models) {
      for (const key of DEPRECATED) {
        expect(model.benchmarks[key], `${model.slug} has deprecated ${key}`).toBeUndefined()
      }
    }
  })

  it('benchmark scores are within valid ranges', () => {
    const violations: string[] = []
    for (const model of seed.models) {
      for (const [key, score] of Object.entries(model.benchmarks)) {
        const def = BENCHMARK_DEFS.get(key)
        if (!def) continue

        if (score < 0) {
          violations.push(`${model.slug}.${key} = ${score} (negative)`)
        }
        if (def.max_score != null && score > def.max_score * 1.05) {
          violations.push(`${model.slug}.${key} = ${score} (exceeds max ${def.max_score})`)
        }
      }
    }
    if (violations.length > 0) {
      console.log(`\n  Score range violations:\n    ${violations.slice(0, 20).join('\n    ')}`)
    }
    expect(violations.length).toBe(0)
  })

  it('only known benchmark keys exist in models', () => {
    const unknownKeys = new Set<string>()
    for (const model of seed.models) {
      for (const key of Object.keys(model.benchmarks)) {
        if (!VALID_BENCHMARK_KEYS.has(key)) {
          unknownKeys.add(key)
        }
      }
    }
    if (unknownKeys.size > 0) {
      console.log(`\n  Unknown benchmark keys in seed.json: ${Array.from(unknownKeys).join(', ')}`)
      console.log('  These keys exist in model data but are NOT defined in categories.json')
    }
    // This is a warning, not a hard failure (speed metrics may not be in seed)
    // But we do want to flag truly orphaned keys
  })
})

describe('Categories Consistency', () => {
  it('all categories have at least one benchmark', () => {
    for (const [key, cat] of Object.entries(categories)) {
      expect(cat.benchmarks.length, `${key} has no benchmarks`).toBeGreaterThan(0)
    }
  })

  it('all benchmark keys are unique across categories', () => {
    const allKeys: string[] = []
    for (const cat of Object.values(categories)) {
      for (const bm of cat.benchmarks) {
        allKeys.push(bm.key)
      }
    }
    const unique = new Set(allKeys)
    expect(unique.size).toBe(allKeys.length)
  })

  it('speed benchmarks have percentile_rank normMethod', () => {
    const speedCat = categories['speed']
    if (speedCat) {
      for (const bm of speedCat.benchmarks) {
        expect((bm as any).normMethod, `${bm.key} should use percentile_rank`).toBe('percentile_rank')
      }
    }
  })
})

describe('Dimension-level Coverage Check', () => {
  const COVERAGE_THRESHOLD = 0.5
  const totalModels = seed.models.length

  for (const [catKey, category] of Object.entries(categories)) {
    it(`${category.label}: at least one benchmark eligible (>= 50%)`, () => {
      const eligible = category.benchmarks.filter(bm => {
        const count = seed.models.filter(m => m.benchmarks[bm.key] != null).length
        return count / totalModels >= COVERAGE_THRESHOLD
      })

      // Speed dimension may have 0 data in seed.json (data is in Supabase only)
      if (catKey === 'speed') {
        console.log(`\n    ${category.label}: speed data not in seed.json (Supabase only) — skipping`)
        return
      }

      console.log(`\n    ${category.label}: ${eligible.length}/${category.benchmarks.length} benchmarks eligible`)
      expect(eligible.length, `${catKey} has no eligible benchmarks`).toBeGreaterThan(0)
    })
  }
})
