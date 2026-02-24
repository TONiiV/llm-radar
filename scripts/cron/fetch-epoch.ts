import { createClient } from '@supabase/supabase-js'
import { buildMatchContext, resolveModelSlug } from '../../lib/model-matching'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const EPOCH_CSV_URL = 'https://epoch.ai/data/eci_benchmarks.csv'

// Epoch benchmark name → our benchmark key + score multiplier
// Removed: GSM8K (saturated >95%)
const BENCHMARK_MAP: Record<string, { key: string; multiply: number }> = {
  'GPQA diamond':                     { key: 'gpqa_diamond',   multiply: 100 },
  'OTIS Mock AIME 2024-2025':         { key: 'aime_2025',      multiply: 100 },
  'SWE-Bench Verified (Bash Only)':   { key: 'swe_bench',      multiply: 100 },
  'Terminal Bench':                    { key: 'terminal_bench', multiply: 100 },
}

// Model matching now uses unified lib/model-matching.ts

interface EpochRow {
  model: string
  benchmark: string
  performance: number
}

function parseCSV(text: string): EpochRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  // Header: model_id,benchmark_id,performance,benchmark,...,Model,...
  // Fields: 0=model_id, 1=benchmark_id, 2=performance, 3=benchmark, ..., 10=Model
  const results: EpochRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols.length < 11) continue

    const benchmark = cols[3]
    const performance = parseFloat(cols[2])
    const model = cols[10]

    if (!benchmark || !model || isNaN(performance)) continue
    results.push({ model, benchmark, performance })
  }
  return results
}

// Model matching uses unified lib/model-matching.ts

async function main() {
  console.log('Fetching Epoch AI benchmark data...')

  const res = await fetch(EPOCH_CSV_URL, { signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`Epoch CSV fetch failed: ${res.status}`)
  const text = await res.text()

  const allRows = parseCSV(text)
  console.log(`  Parsed ${allRows.length} rows from Epoch CSV`)

  const ctx = await buildMatchContext(supabase, 'epoch_ai')
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

  for (const row of allRows) {
    const bmConfig = BENCHMARK_MAP[row.benchmark]
    if (!bmConfig) continue // not a benchmark we care about

    const slug = resolveModelSlug(row.model, ctx)
    if (!slug) {
      unmapped++
      continue
    }

    mapped++
    stagingRows.push({
      source_key: 'epoch_ai',
      model_name: slug, // use our slug as model_name for staging
      benchmark_key: bmConfig.key,
      raw_score: Math.round(row.performance * bmConfig.multiply * 100) / 100,
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
    key: 'epoch_ai',
    name: 'Epoch AI',
    url: EPOCH_CSV_URL,
    status: 'active',
    last_status: 'success',
    last_fetched_at: new Date().toISOString(),
    last_error: null,
    consecutive_failures: 0,
  }, { onConflict: 'key' })

  console.log(`✅ Epoch AI: ${stagingRows.length} benchmark scores fetched`)
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('❌ Epoch AI fetch failed:', message)

  // Try to update data source status
  supabase.from('data_sources').upsert({
    key: 'epoch_ai',
    name: 'Epoch AI',
    url: EPOCH_CSV_URL,
    last_status: 'failed',
    last_error: message,
  }, { onConflict: 'key' }).then(() => {
    process.exit(1)
  })
})
