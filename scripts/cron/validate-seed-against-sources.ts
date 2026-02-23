import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Threshold: if source score differs from DB score by more than this, flag it
const DIFF_THRESHOLD = 5 // percentage points

interface DriftEntry {
  model: string
  benchmark: string
  dbScore: number
  dbSource: string
  sourceScore: number
  sourceOrigin: string
  diff: number
}

async function main() {
  console.log('🔍 Validating benchmark scores against external sources...')

  // 1. Get all benchmark_scores with source='official' (from seed.json)
  const { data: officialScores, error: err1 } = await supabase
    .from('benchmark_scores')
    .select('model_id, benchmark_key, raw_score')
    .eq('source', 'official')
  if (err1 || !officialScores) {
    console.log('No official scores found.')
    return
  }

  // 2. Get all non-official scores (from AA, Epoch, etc.)
  const { data: sourceScores, error: err2 } = await supabase
    .from('benchmark_scores')
    .select('model_id, benchmark_key, raw_score, source')
    .neq('source', 'official')
  if (err2) {
    console.error('Failed to fetch source scores:', err2.message)
    return
  }

  // 3. Build lookup: model_id+benchmark_key → source score
  const sourceMap = new Map<string, { score: number; source: string }>()
  for (const s of (sourceScores ?? [])) {
    const key = `${s.model_id}:${s.benchmark_key}`
    sourceMap.set(key, { score: Number(s.raw_score), source: s.source })
  }

  // 4. Get model slugs
  const { data: models } = await supabase.from('models').select('id, slug')
  const idToSlug = new Map((models ?? []).map(m => [m.id, m.slug]))

  // 5. Compare official vs source scores
  const drifts: DriftEntry[] = []
  const seedOnlyBenchmarks = new Map<string, string[]>() // model → [benchmark_keys]

  for (const official of officialScores) {
    const key = `${official.model_id}:${official.benchmark_key}`
    const slug = idToSlug.get(official.model_id) ?? official.model_id
    const source = sourceMap.get(key)

    if (!source) {
      // No external source to compare against — seed-only
      if (!seedOnlyBenchmarks.has(slug)) seedOnlyBenchmarks.set(slug, [])
      seedOnlyBenchmarks.get(slug)!.push(official.benchmark_key)
      continue
    }

    const diff = Math.abs(Number(official.raw_score) - source.score)
    if (diff > DIFF_THRESHOLD) {
      drifts.push({
        model: slug,
        benchmark: official.benchmark_key,
        dbScore: Number(official.raw_score),
        dbSource: 'official (seed.json)',
        sourceScore: source.score,
        sourceOrigin: source.source,
        diff: Math.round(diff * 100) / 100,
      })
    }
  }

  // 6. Report seed-only models (no external validation)
  const seedOnlyModels = Array.from(seedOnlyBenchmarks.entries())
    .filter(([, benchmarks]) => benchmarks.length >= 3)
    .sort((a, b) => b[1].length - a[1].length)

  if (seedOnlyModels.length > 0) {
    console.log(`\n⚠️  Models relying mostly on seed.json (no external source for 3+ benchmarks):`)
    for (const [model, benchmarks] of seedOnlyModels) {
      console.log(`  ${model}: ${benchmarks.length} seed-only benchmarks (${benchmarks.join(', ')})`)
    }
  }

  // 7. Report drifts
  if (drifts.length > 0) {
    console.log(`\n❌ Score drifts detected (>${DIFF_THRESHOLD}pt difference):`)
    drifts.sort((a, b) => b.diff - a.diff)
    for (const d of drifts) {
      console.log(`  ${d.model}/${d.benchmark}: seed=${d.dbScore} vs ${d.sourceOrigin}=${d.sourceScore} (Δ${d.diff})`)
    }
    console.log(`\n  Total: ${drifts.length} drifts found`)
    // Exit with error so workflow shows failure
    process.exit(1)
  } else {
    console.log(`\n✅ All official scores within ${DIFF_THRESHOLD}pt of external sources`)
  }

  // 8. Summary
  const totalOfficial = officialScores.length
  const totalValidated = officialScores.length - Array.from(seedOnlyBenchmarks.values()).reduce((s, b) => s + b.length, 0)
  console.log(`📊 Validated ${totalValidated}/${totalOfficial} official scores against external sources`)
}

main().catch((err) => {
  console.error('❌ Seed validation failed:', err.message)
  process.exit(1)
})
