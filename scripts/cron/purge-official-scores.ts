import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

/**
 * Purge unreliable benchmark scores from DB:
 * 1. ALL source='official' scores (from seed.json, potentially stale)
 * 2. AA scores with raw_score < 1.0 (from bug where fractions weren't converted to %)
 * After this, fetchers re-populate with correct data.
 */
async function main() {
  console.log('🗑️  Purging unreliable benchmark scores...')

  const { count: totalBefore } = await supabase
    .from('benchmark_scores')
    .select('*', { count: 'exact', head: true })

  // 1. Purge official scores
  const { count: officialCount } = await supabase
    .from('benchmark_scores')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'official')

  let deleted = 0
  if (officialCount && officialCount > 0) {
    console.log(`  Purging ${officialCount} official (seed) scores...`)
    while (true) {
      const { data } = await supabase
        .from('benchmark_scores')
        .select('id')
        .eq('source', 'official')
        .limit(500)
      if (!data || data.length === 0) break
      await supabase.from('benchmark_scores').delete().in('id', data.map(d => d.id))
      deleted += data.length
    }
    console.log(`  ✅ Purged ${deleted} official scores`)
  } else {
    console.log('  No official scores to purge.')
  }

  // 2. Purge AA scores with wrong scale (raw_score < 1.0 = fraction not percentage)
  const { data: badAA } = await supabase
    .from('benchmark_scores')
    .select('id')
    .eq('source', 'artificial_analysis')
    .lt('raw_score', 1.0)
  if (badAA && badAA.length > 0) {
    console.log(`  Purging ${badAA.length} mis-scaled AA scores (raw_score < 1.0)...`)
    for (let i = 0; i < badAA.length; i += 100) {
      await supabase.from('benchmark_scores').delete().in('id', badAA.slice(i, i + 100).map(d => d.id))
    }
    deleted += badAA.length
    console.log(`  ✅ Purged ${badAA.length} bad AA scores`)
  }

  // 3. Reset staging
  await supabase
    .from('staging_benchmarks')
    .update({ status: 'skipped', validation_notes: 'Source purged' })
    .eq('source_key', 'official')
    .eq('status', 'pending')

  const { count: totalAfter } = await supabase
    .from('benchmark_scores')
    .select('*', { count: 'exact', head: true })

  console.log(`\n✅ Purged ${deleted} total. Before: ${totalBefore}, After: ${totalAfter}`)
}

main().catch((err) => {
  console.error('❌ Purge failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
