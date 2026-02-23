import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// LMArena ELO sources (try multiple paths)
const LMARENA_URLS = [
  'https://huggingface.co/spaces/lmarena-ai/chatbot-arena-leaderboard/resolve/main/data/elo_results.json',
  'https://huggingface.co/spaces/lmarena-ai/chatbot-arena-leaderboard/resolve/main/elo_results_latest.json',
]

interface ELOEntry {
  model: string
  elo?: number
  rating?: number
  [key: string]: unknown
}

async function fetchLMArenaELO(): Promise<{ model: string; score: number }[]> {
  for (const url of LMARENA_URLS) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
      if (!res.ok) continue

      const data = await res.json()

      // Handle different data formats
      const entries: ELOEntry[] = Array.isArray(data) ? data : (data.data ?? data.results ?? [])

      return entries
        .filter((e: ELOEntry) => (e.elo ?? e.rating) != null)
        .map((e: ELOEntry) => ({
          model: e.model ?? String(Object.values(e)[0]),
          score: e.elo ?? e.rating ?? 0,
        }))
    } catch {
      continue
    }
  }

  throw new Error('All LMArena sources failed')
}

async function main() {
  console.log('Fetching LMArena ELO data...')

  try {
    const eloData = await fetchLMArenaELO()

    const rows = eloData.map(e => ({
      source_key: 'lmarena',
      model_name: e.model,
      benchmark_key: 'lmarena_elo',
      raw_score: e.score,
      status: 'pending',
    }))

    // Insert in batches of 100
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100)
      const { error } = await supabase.from('staging_benchmarks').insert(batch)
      if (error) throw error
    }

    await supabase.from('data_sources').update({
      last_status: 'success',
      last_fetched_at: new Date().toISOString(),
      last_error: null,
      consecutive_failures: 0,
    }).eq('key', 'lmarena')

    console.log(`✅ LMArena: ${rows.length} ELO scores fetched`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('❌ LMArena fetch failed:', message)

    const { data } = await supabase
      .from('data_sources')
      .select('consecutive_failures')
      .eq('key', 'lmarena')
      .single()

    const failures = (data?.consecutive_failures ?? 0) + 1
    await supabase.from('data_sources').update({
      last_status: 'failed',
      last_error: message,
      consecutive_failures: failures,
      status: failures >= 7 ? 'disabled' : failures >= 3 ? 'failing' : 'active',
    }).eq('key', 'lmarena')

    // Don't exit(1) — partial failure is OK, keep going
    console.warn('⚠️ LMArena data preserved from last successful fetch')
  }
}

main().catch((err) => {
  console.error('❌ Benchmark fetch failed:', err.message)
  process.exit(1)
})
