import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Maximum allowed score change (absolute percentage points)
const MAX_SCORE_CHANGE = 30

async function main() {
  console.log('Validating and merging staging benchmarks...')

  // Load model slug → model ID lookup
  const { data: models } = await supabase
    .from('models')
    .select('id, slug')
  if (!models || models.length === 0) {
    console.log('No models found in DB, skipping merge.')
    return
  }
  const modelIdBySlug = new Map(models.map(m => [m.slug, m.id]))

  // Load benchmark definitions for validation
  const { data: benchDefs } = await supabase
    .from('benchmark_definitions')
    .select('key')
  const validBenchmarks = new Set((benchDefs ?? []).map(b => b.key))

  // Get pending staging benchmarks
  const { data: stagingBenchmarks } = await supabase
    .from('staging_benchmarks')
    .select('*')
    .eq('status', 'pending')

  if (!stagingBenchmarks || stagingBenchmarks.length === 0) {
    console.log('No pending staging benchmarks to process.')
    return
  }

  console.log(`  Processing ${stagingBenchmarks.length} pending staging benchmark records...`)

  let merged = 0
  let skipped = 0
  let flagged = 0

  // Group by model_name + benchmark_key to handle multiple sources
  // Prefer: artificial_analysis > epoch_ai > lmarena
  const SOURCE_PRIORITY: Record<string, number> = {
    'artificial_analysis': 3,
    'epoch_ai': 2,
    'lmarena': 1,
  }

  // Deduplicate: keep highest-priority source per (model, benchmark)
  const bestEntries = new Map<string, typeof stagingBenchmarks[0]>()
  for (const sb of stagingBenchmarks) {
    const entryKey = `${sb.model_name}:${sb.benchmark_key}`
    const existing = bestEntries.get(entryKey)
    const sbPriority = SOURCE_PRIORITY[sb.source_key] ?? 0
    const existPriority = existing ? (SOURCE_PRIORITY[existing.source_key] ?? 0) : -1

    if (sbPriority > existPriority) {
      bestEntries.set(entryKey, sb)
    }
  }

  // Process best entries
  const processedIds = new Set<string>()

  for (const [, sb] of Array.from(bestEntries.entries())) {
    processedIds.add(sb.id)

    // model_name in staging is our model slug
    const modelId = modelIdBySlug.get(sb.model_name)
    if (!modelId) {
      skipped++
      continue
    }

    // Validate benchmark key exists
    if (!validBenchmarks.has(sb.benchmark_key)) {
      skipped++
      await supabase.from('staging_benchmarks').update({
        status: 'skipped',
        validation_notes: `Unknown benchmark key: ${sb.benchmark_key}`,
        processed_at: new Date().toISOString(),
      }).eq('id', sb.id)
      continue
    }

    // Validate score range (0-100)
    if (sb.raw_score < 0 || sb.raw_score > 100) {
      flagged++
      await supabase.from('staging_benchmarks').update({
        status: 'flagged',
        validation_notes: `Score ${sb.raw_score} out of valid range [0, 100]`,
        processed_at: new Date().toISOString(),
      }).eq('id', sb.id)
      continue
    }

    // Check existing score for large deviation
    const { data: existingScore } = await supabase
      .from('benchmark_scores')
      .select('raw_score')
      .eq('model_id', modelId)
      .eq('benchmark_key', sb.benchmark_key)
      .limit(1)
      .single()

    if (existingScore) {
      const change = Math.abs(sb.raw_score - existingScore.raw_score)
      if (change > MAX_SCORE_CHANGE) {
        flagged++
        await supabase.from('staging_benchmarks').update({
          status: 'flagged',
          validation_notes: `Score change ${existingScore.raw_score} → ${sb.raw_score} exceeds ${MAX_SCORE_CHANGE}pt threshold`,
          processed_at: new Date().toISOString(),
        }).eq('id', sb.id)
        continue
      }
    }

    // Upsert into benchmark_scores
    // Note: staging_benchmarks uses 'source_key', benchmark_scores uses 'source'
    const { error } = await supabase.from('benchmark_scores').upsert({
      model_id: modelId,
      benchmark_key: sb.benchmark_key,
      raw_score: sb.raw_score,
      source: sb.source_key,
      recorded_at: new Date().toISOString(),
    }, {
      onConflict: 'model_id,benchmark_key',
    })

    if (error) {
      console.warn(`  Failed to merge ${sb.model_name}/${sb.benchmark_key}: ${error.message}`)
      continue
    }

    // Mark as approved
    await supabase.from('staging_benchmarks').update({
      status: 'approved',
      processed_at: new Date().toISOString(),
    }).eq('id', sb.id)

    merged++
  }

  // Mark duplicate (lower-priority) staging entries as skipped
  const duplicateIds = stagingBenchmarks
    .filter(sb => !processedIds.has(sb.id))
    .map(sb => sb.id)

  if (duplicateIds.length > 0) {
    for (let i = 0; i < duplicateIds.length; i += 100) {
      const batch = duplicateIds.slice(i, i + 100)
      await supabase.from('staging_benchmarks').update({
        status: 'skipped',
        validation_notes: 'Superseded by higher-priority source',
        processed_at: new Date().toISOString(),
      }).in('id', batch)
    }
    skipped += duplicateIds.length
  }

  console.log(`✅ Benchmark Merge: ${merged} merged, ${flagged} flagged, ${skipped} skipped`)
}

main().catch((err) => {
  console.error('❌ Benchmark validate and merge failed:', err.message)
  process.exit(1)
})
