import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

/**
 * One-time purge: Remove ALL source='official' benchmark scores from DB.
 * These were imported from seed.json and are unreliable.
 * After this, only external sources (AA, Epoch, LMArena) will populate scores.
 */
async function main() {
  console.log('🗑️  Purging ALL official (seed-originated) benchmark scores...')

  // Count before
  const { count: totalBefore } = await supabase
    .from('benchmark_scores')
    .select('*', { count: 'exact', head: true })
  const { count: officialCount } = await supabase
    .from('benchmark_scores')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'official')

  console.log(`  Total scores: ${totalBefore}, Official: ${officialCount}`)

  if (!officialCount || officialCount === 0) {
    console.log('  No official scores to purge.')
    return
  }

  // Delete all official scores in batches
  // Supabase doesn't have batch delete by condition easily, so we fetch IDs first
  let deleted = 0
  while (true) {
    const { data, error } = await supabase
      .from('benchmark_scores')
      .select('id')
      .eq('source', 'official')
      .limit(500)
    if (error) throw new Error(`Fetch failed: ${error.message}`)
    if (!data || data.length === 0) break

    const ids = data.map(d => d.id)
    const { error: delErr } = await supabase
      .from('benchmark_scores')
      .delete()
      .in('id', ids)
    if (delErr) throw new Error(`Delete failed: ${delErr.message}`)
    deleted += ids.length
    console.log(`  Deleted ${deleted}/${officialCount}...`)
  }

  // Also reset any staging entries that were sourced from seed
  await supabase
    .from('staging_benchmarks')
    .update({ status: 'skipped', validation_notes: 'Official source purged' })
    .eq('source_key', 'official')
    .eq('status', 'pending')

  // Count after
  const { count: totalAfter } = await supabase
    .from('benchmark_scores')
    .select('*', { count: 'exact', head: true })

  console.log(`\n✅ Purged ${deleted} official scores. Remaining: ${totalAfter} (all from external sources)`)
}

main().catch((err) => {
  console.error('❌ Purge failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
