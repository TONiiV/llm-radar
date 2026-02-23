import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

async function main() {
  console.log('Recalculating normalized scores...')

  // Get all benchmark definitions
  const { data: benchmarks } = await supabase
    .from('benchmark_definitions')
    .select('key, higher_is_better')

  if (!benchmarks) throw new Error('Failed to fetch benchmark definitions')

  // Get all scores (paginate past Supabase 1000-row default limit)
  const allScores: { id: string; benchmark_key: string; raw_score: number }[] = []
  let offset = 0
  const PAGE_SIZE = 1000
  while (true) {
    const { data: page } = await supabase
      .from('benchmark_scores')
      .select('id, benchmark_key, raw_score')
      .range(offset, offset + PAGE_SIZE - 1)
    if (!page || page.length === 0) break
    allScores.push(...page)
    offset += page.length
    if (page.length < PAGE_SIZE) break
  }

  if (allScores.length === 0) throw new Error('Failed to fetch scores')
  console.log(`  Fetched ${allScores.length} total benchmark scores`)

  // Group scores by benchmark
  const scoresByBenchmark = new Map<string, typeof allScores>()
  for (const s of allScores) {
    const group = scoresByBenchmark.get(s.benchmark_key) ?? []
    group.push(s)
    scoresByBenchmark.set(s.benchmark_key, group)
  }

  const benchmarkMap = new Map(benchmarks.map(b => [b.key, b]))
  let updated = 0

  for (const [benchmarkKey, scores] of Array.from(scoresByBenchmark.entries())) {
    const def = benchmarkMap.get(benchmarkKey)
    if (!def) continue

    const n = scores.length
    if (n <= 1) {
      // Single model — normalize to 50
      for (const s of scores) {
        await supabase.from('benchmark_scores').update({
          normalized_score: 50,
        }).eq('id', s.id)
        updated++
      }
      continue
    }

    const rawValues = scores.map(s => Number(s.raw_score))
    const sorted = [...rawValues].sort((a, b) => a - b)

    for (const s of scores) {
      const value = Number(s.raw_score)
      const rank = sorted.filter(v => v < value).length
      const ties = sorted.filter(v => v === value).length
      const midRank = rank + (ties - 1) / 2

      let normalized: number
      if (n < 30) {
        // Scaled Rank
        normalized = (midRank / (n - 1)) * 100
      } else {
        // Percentile Rank
        normalized = (rank / (n - 1)) * 100
      }

      // Invert if lower is better
      if (!def.higher_is_better) {
        normalized = 100 - normalized
      }

      normalized = Math.round(normalized * 100) / 100

      await supabase.from('benchmark_scores').update({
        normalized_score: normalized,
      }).eq('id', s.id)
      updated++
    }
  }

  console.log(`✅ Recalculated ${updated} normalized scores across ${scoresByBenchmark.size} benchmarks`)
}

main().catch((err) => {
  console.error('❌ Recalculate scores failed:', err.message)
  process.exit(1)
})
