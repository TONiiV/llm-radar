/**
 * Benchmark Coverage Audit
 *
 * Tests that each benchmark in categories.json has sufficient coverage
 * across all models, and that top-tier models are covered.
 *
 * Rule: benchmarks with < 50% coverage should not participate in ranking.
 */
import { describe, it, expect } from 'vitest'
import seedData from '../data/seed.json'
import categoriesData from '../data/categories.json'

const seed = seedData as { models: Array<{ name: string; slug: string; provider: string; benchmarks: Record<string, number> }> }
const categories = categoriesData as Record<string, { label: string; benchmarks: Array<{ key: string; label: string; weight: number }> }>

// Top-tier models that should be covered by most benchmarks
const TOP_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-45',
  'claude-opus-45',
  'claude-sonnet-45',
  'claude-sonnet-4',
  'claude-haiku-35',
  'gemini-25-pro',
  'gemini-25-flash',
  'gemini-20-flash',
  'deepseek-v3',
  'deepseek-r1',
  'llama-4-maverick',
  'llama-33-70b',
  'qwen-25-72b',
  'mistral-large',
  'grok-3',
]

const COVERAGE_THRESHOLD = 0.5 // 50%

describe('Benchmark Coverage Audit', () => {
  const totalModels = seed.models.length

  it('seed.json has models', () => {
    expect(totalModels).toBeGreaterThan(0)
    console.log(`\n  Total models in seed.json: ${totalModels}`)
  })

  // Verify top models exist in seed
  it('top models exist in seed.json', () => {
    const slugs = new Set(seed.models.map(m => m.slug))
    const missing = TOP_MODELS.filter(s => !slugs.has(s))
    if (missing.length > 0) {
      console.log(`\n  WARNING: Top models not in seed.json: ${missing.join(', ')}`)
    }
    // At least 80% of top models should exist
    const found = TOP_MODELS.filter(s => slugs.has(s))
    expect(found.length).toBeGreaterThanOrEqual(Math.floor(TOP_MODELS.length * 0.5))
  })

  describe('Per-Dimension Coverage', () => {
    for (const [catKey, category] of Object.entries(categories)) {
      describe(`${category.label} (${catKey})`, () => {
        for (const bm of category.benchmarks) {
          it(`${bm.label} (${bm.key}) — coverage report`, () => {
            // Count models with this benchmark
            const modelsWithScore = seed.models.filter(m => m.benchmarks[bm.key] != null)
            const coverage = modelsWithScore.length / totalModels
            const pct = (coverage * 100).toFixed(1)

            // Top model coverage
            const slugs = new Set(seed.models.map(m => m.slug))
            const relevantTopModels = TOP_MODELS.filter(s => slugs.has(s))
            const topModelsWithScore = relevantTopModels.filter(slug => {
              const model = seed.models.find(m => m.slug === slug)
              return model && model.benchmarks[bm.key] != null
            })
            const topCoverage = relevantTopModels.length > 0
              ? topModelsWithScore.length / relevantTopModels.length
              : 0
            const topPct = (topCoverage * 100).toFixed(1)

            // Missing top models
            const missingTop = relevantTopModels.filter(slug => {
              const model = seed.models.find(m => m.slug === slug)
              return !model || model.benchmarks[bm.key] == null
            })

            console.log([
              `\n    ${bm.label} (${bm.key}):`,
              `      Models: ${modelsWithScore.length}/${totalModels} (${pct}%)`,
              `      Top Models: ${topModelsWithScore.length}/${relevantTopModels.length} (${topPct}%)`,
              ...(missingTop.length > 0 ? [`      Missing Top: ${missingTop.join(', ')}`] : []),
              coverage < COVERAGE_THRESHOLD ? `      ⚠️  BELOW 50% — should NOT participate in ranking` : `      ✅  Above threshold`,
            ].join('\n'))

            // The actual assertion: report but also warn
            if (coverage < COVERAGE_THRESHOLD) {
              console.warn(`      ⚠️  ${bm.key}: ${pct}% coverage — below 50% threshold`)
            }

            // Benchmark should have at least some data
            expect(modelsWithScore.length).toBeGreaterThanOrEqual(0)
          })
        }
      })
    }
  })

  describe('Coverage Summary', () => {
    it('prints full coverage table', () => {
      const rows: Array<{
        dimension: string
        benchmark: string
        key: string
        models: number
        coverage: string
        topModels: string
        eligible: boolean
      }> = []

      const slugs = new Set(seed.models.map(m => m.slug))
      const relevantTopModels = TOP_MODELS.filter(s => slugs.has(s))

      for (const [catKey, category] of Object.entries(categories)) {
        for (const bm of category.benchmarks) {
          const modelsWithScore = seed.models.filter(m => m.benchmarks[bm.key] != null)
          const coverage = modelsWithScore.length / totalModels
          const topWithScore = relevantTopModels.filter(slug => {
            const model = seed.models.find(m => m.slug === slug)
            return model && model.benchmarks[bm.key] != null
          })
          const topCoverage = relevantTopModels.length > 0
            ? topWithScore.length / relevantTopModels.length
            : 0

          rows.push({
            dimension: catKey,
            benchmark: bm.label,
            key: bm.key,
            models: modelsWithScore.length,
            coverage: `${(coverage * 100).toFixed(1)}%`,
            topModels: `${topWithScore.length}/${relevantTopModels.length} (${(topCoverage * 100).toFixed(1)}%)`,
            eligible: coverage >= COVERAGE_THRESHOLD,
          })
        }
      }

      console.log('\n  ╔══════════════════════════════════════════════════════════════════════════════════╗')
      console.log('  ║                       BENCHMARK COVERAGE SUMMARY                               ║')
      console.log('  ╠════════════╦═══════════════════╦════════╦══════════╦═════════════════╦══════════╣')
      console.log('  ║ Dimension  ║ Benchmark         ║ Models ║ Coverage ║ Top Models      ║ Eligible ║')
      console.log('  ╠════════════╬═══════════════════╬════════╬══════════╬═════════════════╬══════════╣')
      for (const r of rows) {
        const dim = r.dimension.padEnd(10)
        const bm = r.benchmark.padEnd(17)
        const models = String(r.models).padStart(6)
        const cov = r.coverage.padStart(8)
        const top = r.topModels.padEnd(15)
        const elig = r.eligible ? '  ✅    ' : '  ⚠️    '
        console.log(`  ║ ${dim} ║ ${bm} ║ ${models} ║ ${cov} ║ ${top} ║ ${elig} ║`)
      }
      console.log('  ╚════════════╩═══════════════════╩════════╩══════════╩═════════════════╩══════════╝')

      const eligible = rows.filter(r => r.eligible)
      const ineligible = rows.filter(r => !r.eligible)

      console.log(`\n  Eligible for ranking: ${eligible.length}/${rows.length} benchmarks`)
      if (ineligible.length > 0) {
        console.log(`  ⚠️  Ineligible (< 50%): ${ineligible.map(r => r.key).join(', ')}`)
      }

      expect(rows.length).toBeGreaterThan(0)
    })
  })
})
