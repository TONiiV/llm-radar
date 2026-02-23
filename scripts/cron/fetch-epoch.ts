import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const EPOCH_CSV_URL = 'https://epoch.ai/data/eci_benchmarks.csv'

// Epoch benchmark name → our benchmark key + score multiplier
const BENCHMARK_MAP: Record<string, { key: string; multiply: number }> = {
  'GPQA diamond':                     { key: 'gpqa_diamond',   multiply: 100 },
  'MATH level 5':                     { key: 'math_bench',     multiply: 100 },
  'OTIS Mock AIME 2024-2025':         { key: 'aime_2025',      multiply: 100 },
  'GSM8K':                            { key: 'gsm8k',          multiply: 100 },
  'SWE-Bench Verified (Bash Only)':   { key: 'swe_bench',      multiply: 100 },
  'FrontierMath-2025-02-28-Private':  { key: 'frontiermath',   multiply: 100 },
  'SimpleBench':                      { key: 'simplebench',    multiply: 100 },
  'Aider polyglot':                   { key: 'aider_polyglot', multiply: 100 },
}

// Epoch model name → our model slug (built-in fallback mappings)
const MODEL_NAME_MAP: Record<string, string> = {
  'Claude Opus 4.6':                    'claude-opus-46',
  'Claude Opus 4.5':                    'claude-opus-45',
  'Claude Opus 4.1':                    'claude-opus-41',
  'Claude Opus 4':                      'claude-opus-4',
  'Claude Sonnet 4.5':                  'claude-sonnet-45',
  'Claude Sonnet 4':                    'claude-sonnet-4',
  'Claude Haiku 4.5':                   'claude-haiku-45',
  'Claude 3.7 Sonnet':                  'claude-37-sonnet',
  'Claude 3.5 Sonnet (October 2024)':   'claude-35-sonnet',
  'Claude 3.5 Haiku':                   'claude-35-haiku',
  'GPT-5.2':                            'gpt-52',
  'GPT-5':                              'gpt-5',
  'GPT-5.1':                            'gpt-51',
  'GPT-5 Pro':                          'gpt-52-pro',
  'GPT-4.1':                            'gpt-41',
  'GPT-4.1 mini':                       'gpt-41-mini',
  'GPT-4o (Nov 2024)':                  'gpt-4o',
  'GPT-4o mini':                        'gpt-4o-mini',
  'o3':                                 'o3',
  'o3-mini':                            'o3-mini',
  'o4-mini':                            'o4-mini',
  'o1':                                 'o1',
  'DeepSeek-R1':                        'deepseek-r1',
  'DeepSeek-R1 (May 2025)':            'deepseek-r1-0528',
  'DeepSeek-V3':                        'deepseek-v3',
  'DeepSeek-V3.1':                      'deepseek-v31',
  'Gemini 2.5 Pro (Jun 2025)':          'gemini-25-pro',
  'Gemini 2.5 Flash (Jun 2025)':        'gemini-25-flash',
  'Gemini 2.0 Flash':                   'gemini-20-flash',
  'Gemini 3 Pro':                       'gemini-3-pro',
  'Gemini 3 Flash':                     'gemini-3-flash',
  'Grok 3':                             'grok-3',
  'Grok 4':                             'grok-4',
  'Grok-3 mini':                        'grok-3-mini',
  'Llama 4 Maverick':                   'llama-4-maverick',
  'Llama 4 Scout':                      'llama-4-scout',
  'Mistral Medium 3':                   'mistral-medium-3',
  'Qwen3-235B-A22B':                    'qwen3-235b',
  'Qwen3-Max':                          'qwen3-max',
  'Qwen2.5-Max':                        'qwen25-max',
  'GLM-4.7':                            'glm-47',
  'Kimi K2':                            'kimi-k2',
  'Kimi K2.5':                          'kimi-k25',
}

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

function resolveModelSlug(
  epochName: string,
  dbMappings: Map<string, string>
): string | null {
  // Try DB mappings first
  const dbSlug = dbMappings.get(epochName)
  if (dbSlug) return dbSlug

  // Try built-in mappings
  const builtinSlug = MODEL_NAME_MAP[epochName]
  if (builtinSlug) return builtinSlug

  return null
}

async function loadDbMappings(): Promise<Map<string, string>> {
  try {
    const { data, error } = await supabase
      .from('model_name_mappings')
      .select('source_name, model_slug')
      .eq('source_key', 'epoch_ai')
    if (error || !data) return new Map()
    return new Map(data.map(r => [r.source_name, r.model_slug]))
  } catch {
    return new Map()
  }
}

async function main() {
  console.log('Fetching Epoch AI benchmark data...')

  const res = await fetch(EPOCH_CSV_URL, { signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`Epoch CSV fetch failed: ${res.status}`)
  const text = await res.text()

  const allRows = parseCSV(text)
  console.log(`  Parsed ${allRows.length} rows from Epoch CSV`)

  const dbMappings = await loadDbMappings()
  console.log(`  Loaded ${dbMappings.size} DB model name mappings`)

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

    const slug = resolveModelSlug(row.model, dbMappings)
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
