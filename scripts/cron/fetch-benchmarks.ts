import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// LMArena ELO sources
const LMARENA_CSV = 'https://raw.githubusercontent.com/nakasyou/lmarena-history/main/output/result.csv'
const LMARENA_JSON = 'https://raw.githubusercontent.com/nakasyou/lmarena-history/main/output/scores.json'

// LMArena model name → our model slug (built-in fallback mappings)
const LMARENA_MODEL_MAP: Record<string, string> = {
  'claude-3-5-sonnet-20241022': 'claude-35-sonnet',
  'claude-3-5-haiku-20241022': 'claude-35-haiku',
  'claude-3.7-sonnet': 'claude-37-sonnet',
  'claude-3-7-sonnet': 'claude-37-sonnet',
  'claude-sonnet-4': 'claude-sonnet-4',
  'claude-sonnet-4-5': 'claude-sonnet-45',
  'claude-sonnet-4.5': 'claude-sonnet-45',
  'claude-sonnet-4-6': 'claude-sonnet-46',
  'claude-sonnet-4.6': 'claude-sonnet-46',
  'claude-opus-4': 'claude-opus-4',
  'claude-opus-4-1': 'claude-opus-41',
  'claude-opus-4.1': 'claude-opus-41',
  'claude-opus-4-5': 'claude-opus-45',
  'claude-opus-4.5': 'claude-opus-45',
  'claude-opus-4-6': 'claude-opus-46',
  'claude-opus-4.6': 'claude-opus-46',
  'claude-haiku-4-5': 'claude-haiku-45',
  'claude-haiku-4.5': 'claude-haiku-45',
  'gpt-4o-2024-11-20': 'gpt-4o',
  'gpt-4o': 'gpt-4o',
  'gpt-4o-mini': 'gpt-4o-mini',
  'gpt-4.1': 'gpt-41',
  'gpt-4-1': 'gpt-41',
  'gpt-4.1-mini': 'gpt-41-mini',
  'gpt-4-1-mini': 'gpt-41-mini',
  'gpt-4.1-nano': 'gpt-41-nano',
  'gpt-4-1-nano': 'gpt-41-nano',
  'gpt-4.5': 'gpt-45',
  'gpt-4-5': 'gpt-45',
  'gpt-5': 'gpt-5',
  'gpt-5-mini': 'gpt-5-mini',
  'gpt-5-nano': 'gpt-5-nano',
  'gpt-5-pro': 'gpt-5-pro',
  'gpt-5.1': 'gpt-51',
  'gpt-5-1': 'gpt-51',
  'gpt-5.2': 'gpt-52',
  'gpt-5-2': 'gpt-52',
  'gpt-5.2-codex': 'gpt-52-codex',
  'gpt-5-2-codex': 'gpt-52-codex',
  'gpt-5.2-pro': 'gpt-52-pro',
  'gpt-5-2-pro': 'gpt-52-pro',
  'gpt-5.1-codex-mini': 'gpt-51-codex-mini',
  'gpt-5-1-codex-mini': 'gpt-51-codex-mini',
  'o1': 'o1',
  'o1-mini': 'o1-mini',
  'o1-preview': 'o1-preview',
  'o3': 'o3',
  'o3-mini': 'o3-mini',
  'o3-pro': 'o3-pro',
  'o4-mini': 'o4-mini',
  'deepseek-r1': 'deepseek-r1',
  'deepseek-v3': 'deepseek-v3',
  'deepseek-v3-0325': 'deepseek-v3-0325',
  'deepseek-v3.1': 'deepseek-v31',
  'deepseek-v3.2': 'deepseek-v32',
  'gemini-2.0-flash': 'gemini-20-flash',
  'gemini-2-0-flash': 'gemini-20-flash',
  'gemini-2.5-pro': 'gemini-25-pro',
  'gemini-2-5-pro': 'gemini-25-pro',
  'gemini-2.5-flash': 'gemini-25-flash',
  'gemini-2-5-flash': 'gemini-25-flash',
  'gemini-3-pro': 'gemini-3-pro',
  'gemini-3-flash': 'gemini-3-flash',
  'gemini-3.1-pro': 'gemini-31-pro',
  'gemini-3-1-pro': 'gemini-31-pro',
  'grok-3': 'grok-3',
  'grok-3-mini': 'grok-3-mini',
  'grok-4': 'grok-4',
  'grok-4.1': 'grok-41',
  'grok-4-1': 'grok-41',
  'grok-4.1-fast': 'grok-41-fast',
  'grok-4-1-fast': 'grok-41-fast',
  'llama-4-maverick': 'llama-4-maverick',
  'llama-4-scout': 'llama-4-scout',
  'mistral-medium-3': 'mistral-medium-3',
  'mistral-large-3': 'mistral-large-3',
  'qwen3-235b': 'qwen3-235b',
  'qwen3-max': 'qwen3-max',
  'qwen2.5-max': 'qwen25-max',
  'qwen-2-5-max': 'qwen25-max',
  'glm-4.7': 'glm-47',
  'glm-4-7': 'glm-47',
  'glm-4.7-flash': 'glm-47-flash',
  'glm-4-7-flash': 'glm-47-flash',
  'glm-5': 'glm-5',
  'kimi-k2': 'kimi-k2',
  'kimi-k2.5': 'kimi-k25',
  'kimi-k2-5': 'kimi-k25',
  'kimi-k2-thinking': 'kimi-k2-thinking',
  'minimax-m21': 'minimax-m21',
  'minimax-m2-1': 'minimax-m21',
  'minimax-m25': 'minimax-m25',
  'minimax-m2-5': 'minimax-m25',
  'nvidia-nemotron-3': 'nvidia-nemotron-3',
  'nemotron-3': 'nvidia-nemotron-3',
  'devstral-2': 'devstral-2',
  'qwen3.5-397b': 'qwen35-397b',
  'qwen3-5-397b': 'qwen35-397b',
  'qwen35-397b': 'qwen35-397b',
  'qwen3.5-plus': 'qwen35-plus',
  'qwen3-5-plus': 'qwen35-plus',
  'qwen35-plus': 'qwen35-plus',
  'qwen3-coder-next': 'qwen3-coder-next',
  'qwen3-max-thinking': 'qwen3-max-thinking',
  'deepseek-v3.2-speciale': 'deepseek-v32-speciale',
  'deepseek-v32-speciale': 'deepseek-v32-speciale',
}

function resolveModelSlug(
  lmarenaName: string,
  dbMappings: Map<string, string>
): string | null {
  // Try DB mappings first
  const dbSlug = dbMappings.get(lmarenaName)
  if (dbSlug) return dbSlug

  // Try built-in mappings (exact match)
  const builtinSlug = LMARENA_MODEL_MAP[lmarenaName]
  if (builtinSlug) return builtinSlug

  // Try case-insensitive match
  const lower = lmarenaName.toLowerCase()
  for (const [key, slug] of Object.entries(LMARENA_MODEL_MAP)) {
    if (key.toLowerCase() === lower) return slug
  }

  return null
}

async function loadDbMappings(): Promise<Map<string, string>> {
  try {
    const { data, error } = await supabase
      .from('model_name_mappings')
      .select('source_name, model_slug')
      .eq('source_key', 'lmarena')
    if (error || !data) return new Map()
    return new Map(data.map(r => [r.source_name, r.model_slug]))
  } catch {
    return new Map()
  }
}

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
    const dbMappings = await loadDbMappings()
    console.log(`  Loaded ${dbMappings.size} DB model name mappings`)

    let mapped = 0
    let unmapped = 0
    const unmappedNames = new Set<string>()

    const rows: { source_key: string; model_name: string; benchmark_key: string; raw_score: number; status: string }[] = []
    for (const e of eloData) {
      const slug = resolveModelSlug(e.model, dbMappings)
      if (!slug) {
        unmapped++
        unmappedNames.add(e.model)
        continue
      }
      mapped++
      rows.push({
        source_key: 'lmarena',
        model_name: slug,
        benchmark_key: 'lmarena_elo',
        raw_score: e.score,
        status: 'pending',
      })
    }

    console.log(`  Mapped: ${mapped}, Unmapped: ${unmapped}`)
    if (unmappedNames.size > 0) {
      console.log(`  Unmapped LMArena names: ${Array.from(unmappedNames).slice(0, 20).join(', ')}${unmappedNames.size > 20 ? ` ... (+${unmappedNames.size - 20} more)` : ''}`)
    }

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
