import { createClient } from '@supabase/supabase-js'
import { buildMatchContext, resolveModelSlug } from '../../lib/model-matching'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const BFCL_CSV_URL = 'https://gorilla.cs.berkeley.edu/data_overall.csv'

// Suffixes to strip from model names (different calling modes)
const MODE_SUFFIXES = [
  '(FC)',
  '(Prompt)',
  '(Prompt + Thinking)',
  '(FC thinking)',
  '(FC Thinking)',
]

function cleanModelName(raw: string): string {
  let name = raw.trim()
  for (const suffix of MODE_SUFFIXES) {
    if (name.endsWith(suffix)) {
      name = name.slice(0, -suffix.length).trim()
      break
    }
  }
  return name
}

function parsePercentage(val: string): number | null {
  const cleaned = val.trim().replace('%', '')
  const num = parseFloat(cleaned)
  if (isNaN(num)) return null
  return num
}

function parseCSV(text: string): { model: string; overall: number }[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  // Find column indices by header name
  const headers = lines[0].split(',').map(h => h.trim())
  const modelIdx = headers.findIndex(h => h === 'Model' || h === 'model')
  const overallIdx = headers.findIndex(h => h === 'Overall Acc' || h === 'Overall_Acc' || h === 'overall_acc' || h === 'Overall Accuracy')

  if (modelIdx === -1 || overallIdx === -1) {
    console.error(`  Could not find required columns. Headers: ${headers.join(', ')}`)
    return []
  }

  const results: { model: string; overall: number }[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols.length <= Math.max(modelIdx, overallIdx)) continue

    const rawModel = cols[modelIdx]?.trim()
    const rawOverall = cols[overallIdx]?.trim()
    if (!rawModel || !rawOverall) continue

    const overall = parsePercentage(rawOverall)
    if (overall === null || overall < 0 || overall > 100) continue

    results.push({ model: rawModel, overall })
  }

  return results
}

async function main() {
  console.log('Fetching BFCL data...')

  const res = await fetch(BFCL_CSV_URL, { signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`BFCL CSV fetch failed: ${res.status}`)
  const text = await res.text()

  const allRows = parseCSV(text)
  console.log(`  Parsed ${allRows.length} rows from BFCL CSV`)

  // Deduplicate: same model with different modes → keep highest score
  const modelBest = new Map<string, number>()
  for (const row of allRows) {
    const cleaned = cleanModelName(row.model)
    const existing = modelBest.get(cleaned)
    if (!existing || row.overall > existing) {
      modelBest.set(cleaned, row.overall)
    }
  }

  console.log(`  ${modelBest.size} unique models after dedup`)

  const ctx = await buildMatchContext(supabase, 'bfcl')
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

  for (const [modelName, score] of Array.from(modelBest.entries())) {
    const slug = resolveModelSlug(modelName, ctx)
    if (!slug) {
      unmapped++
      continue
    }

    mapped++
    stagingRows.push({
      source_key: 'bfcl',
      model_name: slug,
      benchmark_key: 'bfcl_overall',
      raw_score: Math.round(score * 100) / 100,
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
    key: 'bfcl',
    name: 'BFCL (Berkeley Function Calling)',
    source_type: 'benchmark',
    url: BFCL_CSV_URL,
    status: 'active',
    last_status: 'success',
    last_fetched_at: new Date().toISOString(),
    last_error: null,
    consecutive_failures: 0,
  }, { onConflict: 'key' })

  console.log(`  BFCL: ${stagingRows.length} benchmark scores fetched`)
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('BFCL fetch failed:', message)

  supabase.from('data_sources').upsert({
    key: 'bfcl',
    name: 'BFCL (Berkeley Function Calling)',
    url: BFCL_CSV_URL,
    last_status: 'failed',
    last_error: message,
  }, { onConflict: 'key' }).then(() => {
    process.exit(1)
  })
})
