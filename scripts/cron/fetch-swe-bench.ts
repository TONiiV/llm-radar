import { createClient } from '@supabase/supabase-js'
import { buildMatchContext, resolveModelSlug } from '../../lib/model-matching'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const SWE_BENCH_URL = 'https://raw.githubusercontent.com/SWE-bench/swe-bench.github.io/master/data/leaderboards.json'

interface SWEBenchResult {
  resolved: number
  tags?: string[]
}

interface SWEBenchLeaderboard {
  name: string
  results: SWEBenchResult[]
}

interface SWEBenchData {
  leaderboards: SWEBenchLeaderboard[]
}

function extractModelName(tags: string[]): string | null {
  const modelTags = tags.filter(t => t.startsWith('Model: '))
  // Only process entries with exactly 1 Model tag (skip multi-model pipelines)
  if (modelTags.length !== 1) return null
  return modelTags[0].replace('Model: ', '').trim()
}

function stripDateSuffix(name: string): string {
  return name.replace(/-\d{8,}$/g, '')
}

async function main() {
  console.log('Fetching SWE-bench Verified data...')

  const res = await fetch(SWE_BENCH_URL, { signal: AbortSignal.timeout(60000) })
  if (!res.ok) throw new Error(`SWE-bench fetch failed: ${res.status}`)
  const data: SWEBenchData = await res.json()

  // Find "Verified" leaderboard
  const verified = data.leaderboards?.find(lb => lb.name === 'Verified')
  if (!verified) throw new Error('Could not find "Verified" leaderboard in SWE-bench data')

  console.log(`  Found ${verified.results.length} entries in Verified leaderboard`)

  // Extract model → best score mapping
  const modelBest = new Map<string, number>()
  for (const result of verified.results) {
    if (!result.tags || result.tags.length === 0) continue

    const modelName = extractModelName(result.tags)
    if (!modelName) continue

    const cleaned = stripDateSuffix(modelName)
    const score = result.resolved // Already 0-100 percentage
    if (isNaN(score) || score < 0 || score > 100) continue

    const existing = modelBest.get(cleaned)
    if (!existing || score > existing) {
      modelBest.set(cleaned, score)
    }
  }

  console.log(`  Extracted ${modelBest.size} unique models with scores`)

  const ctx = await buildMatchContext(supabase, 'swe_bench')
  console.log(`  Match context: ${ctx.dbMappings.size} DB mappings, ${ctx.dbSlugs.size} model slugs`)

  const stagingRows: {
    source_key: string
    model_name: string
    benchmark_key: string
    raw_score: number
    status: string
  }[] = []

  let mapped = 0
  let unmapped = 0

  for (const [modelName, score] of Array.from(modelBest.entries())) {
    const slug = resolveModelSlug(modelName, ctx)
    if (!slug) {
      unmapped++
      continue
    }

    mapped++
    stagingRows.push({
      source_key: 'swe_bench',
      model_name: slug,
      benchmark_key: 'swe_bench',
      raw_score: Math.round(score * 100) / 100,
      status: 'pending',
    })
  }

  console.log(`  Mapped: ${mapped}, Unmapped: ${unmapped}`)

  // Insert in batches of 100
  for (let i = 0; i < stagingRows.length; i += 100) {
    const batch = stagingRows.slice(i, i + 100)
    const { error } = await supabase.from('staging_benchmarks').insert(batch)
    if (error) throw error
  }

  // Update data source status
  await supabase.from('data_sources').upsert({
    key: 'swe_bench',
    name: 'SWE-bench Verified',
    source_type: 'benchmark',
    url: SWE_BENCH_URL,
    status: 'active',
    last_status: 'success',
    last_fetched_at: new Date().toISOString(),
    last_error: null,
    consecutive_failures: 0,
  }, { onConflict: 'key' })

  console.log(`  SWE-bench: ${stagingRows.length} benchmark scores fetched`)
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('SWE-bench fetch failed:', message)

  supabase.from('data_sources').upsert({
    key: 'swe_bench',
    name: 'SWE-bench Verified',
    url: SWE_BENCH_URL,
    last_status: 'failed',
    last_error: message,
  }, { onConflict: 'key' }).then(() => {
    process.exit(1)
  })
})
