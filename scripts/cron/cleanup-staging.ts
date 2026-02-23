import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

async function main() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  console.log(`Cleaning up staging data older than ${thirtyDaysAgo}...`)

  const { count: pricesDeleted } = await supabase
    .from('staging_prices')
    .delete({ count: 'exact' })
    .neq('status', 'pending')
    .lt('processed_at', thirtyDaysAgo)

  const { count: benchmarksDeleted } = await supabase
    .from('staging_benchmarks')
    .delete({ count: 'exact' })
    .neq('status', 'pending')
    .lt('processed_at', thirtyDaysAgo)

  console.log(`🧹 Cleanup: ${pricesDeleted ?? 0} prices, ${benchmarksDeleted ?? 0} benchmarks removed`)
}

main().catch((err) => {
  console.error('❌ Cleanup failed:', err.message)
  process.exit(1)
})
