import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// LMArena ELO sources
const LMARENA_CSV = 'https://raw.githubusercontent.com/nakasyou/lmarena-history/main/output/result.csv'
const LMARENA_JSON = 'https://raw.githubusercontent.com/nakasyou/lmarena-history/main/output/scores.json'

/**
 * Parse CSV format: header row has model names, last row has latest ELO scores.
 * First column of each data row is the date (YYYYMMDD).
 */
function parseCSV(text: string): { model: string; score: number }[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  // Header: ,model1,model2,...
  const header = lines[0].split(',')
  const modelNames = header.slice(1) // skip first empty column

  // Last row = latest date's scores
  const lastLine = lines[lines.length - 1]
  const values = lastLine.split(',')
  const date = values[0]
  const scores = values.slice(1)

  console.log(`  CSV latest date: ${date}, ${modelNames.length} models`)

  const results: { model: string; score: number }[] = []
  for (let i = 0; i < modelNames.length; i++) {
    const score = parseFloat(scores[i])
    if (score > 0) {
      results.push({ model: modelNames[i], score })
    }
  }
  return results
}

/**
 * Parse the GitHub JSON format: { "20250522": { "text": { "overall": { "model-name": 1234.56 } } } }
 */
function parseGitHubJSON(data: Record<string, unknown>): { model: string; score: number }[] {
  const dates = Object.keys(data).sort()
  if (dates.length === 0) return []

  const latest = data[dates[dates.length - 1]] as Record<string, unknown> | undefined
  const text = latest?.text as Record<string, unknown> | undefined
  const overall = text?.overall as Record<string, number> | undefined
  if (!overall) return []

  return Object.entries(overall)
    .filter(([, score]) => typeof score === 'number' && score > 0)
    .map(([model, score]) => ({ model, score }))
}

async function fetchLMArenaELO(): Promise<{ model: string; score: number }[]> {
  // Try CSV first (266KB vs 18MB JSON — much faster)
  try {
    console.log('  Trying CSV source (lightweight)...')
    const res = await fetch(LMARENA_CSV, { signal: AbortSignal.timeout(30000) })
    if (res.ok) {
      const text = await res.text()
      const results = parseCSV(text)
      if (results.length > 0) {
        console.log(`  CSV: ${results.length} models with scores`)
        return results
      }
    }
  } catch (err) {
    console.warn('  CSV failed:', err instanceof Error ? err.message : String(err))
  }

  // Fallback to full JSON (18MB, needs more time)
  try {
    console.log('  Trying JSON source (large file)...')
    const res = await fetch(LMARENA_JSON, { signal: AbortSignal.timeout(60000) })
    if (res.ok) {
      const data = await res.json()
      const results = parseGitHubJSON(data as Record<string, unknown>)
      if (results.length > 0) {
        console.log(`  JSON: ${results.length} models found`)
        return results
      }
    }
  } catch (err) {
    console.warn('  JSON failed:', err instanceof Error ? err.message : String(err))
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
