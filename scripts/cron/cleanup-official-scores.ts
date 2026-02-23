import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

/**
 * Remove source='official' benchmark scores that are now superseded by external sources.
 * When AA, Epoch, or LMArena has provided a score for the same model+benchmark,
 * the 'official' (seed-originated) entry is redundant and potentially stale.
 */
async function main() {
  console.log('🧹 Cleaning up redundant official benchmark scores...')

  // 1. Get all official scores
  const { data: officialScores, error: err1 } = await supabase
    .from('benchmark_scores')
    .select('id, model_id, benchmark_key')
    .eq('source', 'official')
  if (err1) throw new Error(`Failed to fetch official scores: ${err1.message}`)
  if (!officialScores || officialScores.length === 0) {
    console.log('  No official scores found.')
    return
  }
  console.log(`  Found ${officialScores.length} official scores`)

  // 2. Get all external scores
  const { data: externalScores, error: err2 } = await supabase
    .from('benchmark_scores')
    .select('model_id, benchmark_key, source')
    .neq('source', 'official')
  if (err2) throw new Error(`Failed to fetch external scores: ${err2.message}`)

  // Build lookup: model_id+benchmark_key → has external source
  const externalSet = new Set<string>()
  for (const s of (externalScores ?? [])) {
    externalSet.add(`${s.model_id}:${s.benchmark_key}`)
  }

  // 3. Find official scores that have external replacements
  const toDelete = officialScores.filter(s =>
    externalSet.has(`${s.model_id}:${s.benchmark_key}`)
  )

  if (toDelete.length === 0) {
    console.log('  No redundant official scores to remove.')
    return
  }

  // 4. Get model slugs for logging
  const { data: models } = await supabase.from('models').select('id, slug')
  const idToSlug = new Map((models ?? []).map(m => [m.id, m.slug]))

  console.log(`  Removing ${toDelete.length} official scores superseded by external sources:`)
  for (const s of toDelete.slice(0, 20)) {
    const slug = idToSlug.get(s.model_id) ?? s.model_id
    console.log(`    ${slug}/${s.benchmark_key}`)
  }
  if (toDelete.length > 20) {
    console.log(`    ... and ${toDelete.length - 20} more`)
  }

  // 5. Delete in batches
  const ids = toDelete.map(s => s.id)
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100)
    const { error } = await supabase
      .from('benchmark_scores')
      .delete()
      .in('id', batch)
    if (error) {
      console.error(`  Failed to delete batch: ${error.message}`)
    }
  }

  // 6. Report remaining official-only scores
  const remaining = officialScores.filter(s =>
    !externalSet.has(`${s.model_id}:${s.benchmark_key}`)
  )
  if (remaining.length > 0) {
    console.log(`\n⚠️  ${remaining.length} official scores still have no external source:`)
    const byModel = new Map<string, string[]>()
    for (const s of remaining) {
      const slug = idToSlug.get(s.model_id) ?? s.model_id
      if (!byModel.has(slug)) byModel.set(slug, [])
      byModel.get(slug)!.push(s.benchmark_key)
    }
    for (const [model, benchmarks] of Array.from(byModel.entries()).sort((a, b) => b[1].length - a[1].length).slice(0, 15)) {
      console.log(`    ${model}: ${benchmarks.join(', ')}`)
    }
  }

  console.log(`\n✅ Cleaned up ${toDelete.length} redundant official scores, ${remaining.length} official-only remain`)
}

main().catch((err) => {
  console.error('❌ Official scores cleanup failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
