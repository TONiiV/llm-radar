import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// AA benchmark field name → our benchmark key + score scale
// AA scores are fractions (0-1) for most fields, so scale=100 converts to percentage
const AA_BENCHMARK_MAP: Record<string, { key: string; scale: number }> = {
  mmlu_pro:           { key: 'mmlu_pro',            scale: 100 },
  gpqa:               { key: 'gpqa_diamond',        scale: 100 },
  hle:                { key: 'humanitys_last_exam',  scale: 100 },
  critpt:             { key: 'critpt',              scale: 100 },
  livecodebench:      { key: 'livecode_bench',      scale: 100 },
  scicode:            { key: 'scicode',             scale: 100 },
  ifbench:            { key: 'ifbench',             scale: 100 },
  math_500:           { key: 'math_bench',          scale: 100 },
  aime25:             { key: 'aime_2025',           scale: 100 },
  lcr:                { key: 'aa_lcr',              scale: 100 },
  tau2:               { key: 'tau2_bench',          scale: 100 },
  terminalbench_hard: { key: 'terminal_bench',      scale: 100 },
  gdpval_normalized:  { key: 'gdpval_aa',           scale: 100 },
}

// AA slug → our model slug (built-in fallback mappings)
// IMPORTANT: Verified against actual AA API slugs (2026-02-23)
// AA uses inconsistent naming: opus = "claude-opus-4-5", but sonnet = "claude-4-5-sonnet"
const AA_MODEL_MAP: Record<string, string> = {
  // Claude — AA uses TWO naming conventions
  'claude-opus-4-6':              'claude-opus-46',
  'claude-opus-4-5':              'claude-opus-45',
  'claude-4-1-opus':              'claude-opus-41',
  'claude-4-opus':                'claude-opus-4',
  'claude-4-5-sonnet':            'claude-sonnet-45',
  'claude-4-6-sonnet':            'claude-sonnet-46',
  'claude-4-sonnet':              'claude-sonnet-4',
  'claude-4-5-haiku':             'claude-haiku-45',
  'claude-3-7-sonnet':            'claude-37-sonnet',
  'claude-35-sonnet':             'claude-35-sonnet',
  'claude-3-5-haiku':             'claude-35-haiku',
  // GPT
  'gpt-5-2':                      'gpt-52',
  'gpt-5':                        'gpt-5',
  'gpt-5-1':                      'gpt-51',
  'gpt-5-codex':                  'gpt-5-codex',
  'gpt-5-2-codex':                'gpt-52-codex',
  'gpt-5-1-codex':                'gpt-51-codex',
  'gpt-5-1-codex-mini':           'gpt-51-codex-mini',
  'gpt-5-1-codex-max':            'gpt-51-codex-max',
  'gpt-4-1':                      'gpt-41',
  'gpt-4-1-mini':                 'gpt-41-mini',
  'gpt-4-1-nano':                 'gpt-41-nano',
  'gpt-4o':                       'gpt-4o',
  'gpt-4o-mini':                  'gpt-4o-mini',
  'gpt-4-5':                      'gpt-45',
  'gpt-5-mini':                   'gpt-5-mini',
  'gpt-5-nano':                   'gpt-5-nano',
  'gpt-5-pro':                    'gpt-5-pro',
  // OpenAI reasoning
  'o3':                           'o3',
  'o3-mini':                      'o3-mini',
  'o3-pro':                       'o3-pro',
  'o4-mini':                      'o4-mini',
  'o1':                           'o1',
  'o1-mini':                      'o1-mini',
  'o1-preview':                   'o1-preview',
  // DeepSeek
  'deepseek-r1':                  'deepseek-r1',
  'deepseek-r1-0528':             'deepseek-r1-may-2025',
  'deepseek-v3':                  'deepseek-v3',
  'deepseek-v3-1':                'deepseek-v31',
  'deepseek-v3-2':                'deepseek-v32',
  'deepseek-v3-2-speciale':       'deepseek-v32-speciale',
  'deepseek-v3-2-exp':            'deepseek-v32-exp',
  'deepseek-v3-0324':             'deepseek-v3-0324',
  // Gemini
  'gemini-2-5-pro':               'gemini-25-pro',
  'gemini-2-5-flash':             'gemini-25-flash',
  'gemini-2-0-flash':             'gemini-20-flash',
  'gemini-2-0-flash-lite':        'gemini-20-flash-lite',
  'gemini-2-0-pro':               'gemini-20-pro',
  'gemini-3-pro':                 'gemini-3-pro',
  'gemini-3-flash':               'gemini-3-flash',
  'gemini-3-1-pro':               'gemini-31-pro',
  'gemini-2-5-flash-lite-preview-09-2025': 'gemini-25-flash-lite-preview-09-2025',
  // Grok
  'grok-3':                       'grok-3',
  'grok-4':                       'grok-4',
  'grok-3-mini':                  'grok-3-mini',
  'grok-4-1-fast':                'grok-41-fast',
  'grok-4-fast':                  'grok-4-fast',
  'grok-code-fast-1':             'grok-code-fast-1',
  // Meta
  'llama-4-maverick':             'llama-4-maverick',
  'llama-4-scout':                'llama-4-scout',
  // Mistral
  'mistral-medium-3':             'mistral-medium-3',
  'mistral-medium-3-1':           'mistral-medium-31',
  'mistral-large-3':              'mistral-large-3',
  'mistral-large-3-2512':         'mistral-large-3-2512',
  'mistral-small-3':              'mistral-small-3',
  'mistral-small-3-1-24b':        'mistral-small-31-24b',
  'mistral-small-3-2-24b':        'mistral-small-32-24b',
  'devstral-2':                   'devstral-2',
  'devstral-small-2':             'devstral-2',
  'codestral-2508':               'codestral-2508',
  // Qwen
  'qwen3-235b-a22b-instruct':     'qwen3-235b-a22b',
  'qwen3-235b-a22b':              'qwen3-235b-a22b',
  'qwen3-max':                    'qwen3-max',
  'qwen3-max-thinking-preview':   'qwen3-max-thinking',
  'qwen-2-5-max':                 'qwen25-max',
  'qwen3-30b-a3b':                'qwen3-30b-a3b',
  'qwen3-32b':                    'qwen3-32b',
  'qwen3-14b':                    'qwen3-14b',
  'qwen3-8b':                     'qwen3-8b',
  'qwen3-coder-480b-a35b':        'qwen3-coder-480b-a35b',
  'qwen3-coder-flash':            'qwen3-coder-flash',
  'qwen3-coder-next':             'qwen3-coder-next',
  'qwen3-coder-plus':             'qwen3-coder-plus',
  'qwen-3-5-397b-a17b':           'qwen35-397b-a17b',
  'qwen-plus':                    'qwen-plus',
  // GLM
  'glm-4-7':                      'glm-47',
  'glm-4-6':                      'glm-46',
  'glm-4-5':                      'glm-45',
  'glm-5':                        'glm-5',
  // Kimi
  'kimi-k2':                      'kimi-k2',
  'kimi-k2-0905':                 'kimi-k25',
  'kimi-k2-thinking':             'kimi-k2-thinking',
  // MiniMax
  'minimax-m2-1':                 'minimax-m21',
  'minimax-m2':                   'minimax-m2',
  'minimax-m2-5':                 'minimax-m25',
  // Nvidia
  'nvidia-nemotron-3-nano-30b-a3b': 'nvidia-nemotron-3',
  'nvidia-nemotron-nano-12b-v2-vl': 'nemotron-nano-12b-2-vl',
}

// The AA page we fetch RSC data from (any evaluations page works — they all include defaultData)
const AA_URL = 'https://artificialanalysis.ai/evaluations/mmlu-pro'

interface AADataPoint {
  slug?: string
  name?: string
  reasoning_model?: boolean
  [key: string]: unknown
}

function extractDefaultData(rscText: string): AADataPoint[] {
  const marker = '"defaultData":'
  const idx = rscText.indexOf(marker)
  if (idx === -1) {
    throw new Error('Could not find "defaultData" in RSC payload')
  }

  const arrayStart = rscText.indexOf('[', idx + marker.length)
  if (arrayStart === -1) {
    throw new Error('Could not find array start after "defaultData"')
  }

  let depth = 0
  let arrayEnd = -1
  for (let i = arrayStart; i < rscText.length; i++) {
    if (rscText[i] === '[') depth++
    else if (rscText[i] === ']') {
      depth--
      if (depth === 0) {
        arrayEnd = i + 1
        break
      }
    }
  }

  if (arrayEnd === -1) {
    throw new Error('Could not find matching ] for defaultData array')
  }

  const jsonStr = rscText.slice(arrayStart, arrayEnd)
  return JSON.parse(jsonStr) as AADataPoint[]
}

// Variant suffixes to strip for fuzzy matching
const VARIANT_SUFFIXES = [
  '-reasoning', '-non-reasoning', '-thinking',
  '-low', '-medium', '-high', '-xhigh',
]

function stripVariantSuffix(slug: string): string {
  let result = slug
  for (const suffix of VARIANT_SUFFIXES) {
    if (result.endsWith(suffix)) {
      result = result.slice(0, -suffix.length)
      break // only strip one suffix
    }
  }
  return result
}

function resolveModelSlug(
  aaSlug: string,
  dbMappings: Map<string, string>,
  dbSlugs: Set<string>
): string | null {
  // 1. Try DB mappings first (user-configured overrides)
  const dbSlug = dbMappings.get(aaSlug)
  if (dbSlug) return dbSlug

  // 2. Try built-in static mappings
  const builtinSlug = AA_MODEL_MAP[aaSlug]
  if (builtinSlug) return builtinSlug

  // 3. Try direct slug match against DB
  if (dbSlugs.has(aaSlug)) return aaSlug

  // 4. Fuzzy match: strip variant suffixes and retry
  const normalized = stripVariantSuffix(aaSlug)
  if (normalized !== aaSlug) {
    const normDbSlug = dbMappings.get(normalized)
    if (normDbSlug) return normDbSlug
    const normBuiltin = AA_MODEL_MAP[normalized]
    if (normBuiltin) return normBuiltin
    if (dbSlugs.has(normalized)) return normalized
  }

  return null
}

async function loadDbMappings(): Promise<Map<string, string>> {
  try {
    const { data, error } = await supabase
      .from('model_name_mappings')
      .select('source_name, model_slug')
      .eq('source_key', 'artificial_analysis')
    if (error || !data) return new Map()
    return new Map(data.map(r => [r.source_name, r.model_slug]))
  } catch {
    return new Map()
  }
}

async function loadDbModelSlugs(): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from('models')
      .select('slug')
    if (error || !data) return new Set()
    return new Set(data.map(m => m.slug))
  } catch {
    return new Set()
  }
}

async function main() {
  console.log('Fetching Artificial Analysis benchmark data...')

  // Fetch RSC payload
  const res = await fetch(AA_URL, {
    headers: {
      'RSC': '1',
      'Next-Router-State-Tree': encodeURIComponent(JSON.stringify([''])),
      'User-Agent': 'Mozilla/5.0 (compatible; LLMRadar/1.0)',
    },
    signal: AbortSignal.timeout(60000),
  })

  if (!res.ok) throw new Error(`AA fetch failed: ${res.status}`)
  const rscText = await res.text()
  console.log(`  Fetched ${(rscText.length / 1024 / 1024).toFixed(1)}MB RSC payload`)

  const data = extractDefaultData(rscText)
  console.log(`  Extracted ${data.length} model entries from defaultData`)

  const dbMappings = await loadDbMappings()
  const dbSlugs = await loadDbModelSlugs()
  console.log(`  Loaded ${dbMappings.size} DB mappings, ${dbSlugs.size} DB model slugs`)

  const stagingRows: {
    source_key: string
    model_name: string
    benchmark_key: string
    raw_score: number
    status: string
  }[] = []

  let mapped = 0
  let unmapped = 0
  const unmappedSlugs = new Set<string>()
  const resolvedSlugs = new Map<string, string>() // track AA slug → our slug

  for (const entry of data) {
    const aaSlug = entry.slug
    if (!aaSlug) continue

    const slug = resolveModelSlug(aaSlug, dbMappings, dbSlugs)
    if (!slug) {
      unmapped++
      unmappedSlugs.add(aaSlug)
      continue
    }

    resolvedSlugs.set(aaSlug, slug)

    // Extract all benchmark scores from this entry
    for (const [aaKey, bmConfig] of Object.entries(AA_BENCHMARK_MAP)) {
      const rawValue = entry[aaKey]
      if (rawValue == null) continue

      const score = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue))
      if (isNaN(score)) continue

      // AA scores are fractions (0-1), convert to percentages (0-100)
      const normalizedScore = Math.round(score * bmConfig.scale * 100) / 100

      mapped++
      stagingRows.push({
        source_key: 'artificial_analysis',
        model_name: slug,
        benchmark_key: bmConfig.key,
        raw_score: normalizedScore,
        status: 'pending',
      })
    }
  }

  console.log(`  Mapped: ${mapped} scores from ${resolvedSlugs.size} models, Unmapped: ${unmapped} models`)
  if (unmappedSlugs.size > 0) {
    console.log(`  Unmapped AA slugs: ${Array.from(unmappedSlugs).slice(0, 30).join(', ')}${unmappedSlugs.size > 30 ? ` ... (+${unmappedSlugs.size - 30} more)` : ''}`)
  }

  if (stagingRows.length === 0) {
    console.log('  No benchmark scores to insert.')
    return
  }

  // Deduplicate: if multiple AA entries (base + variant) map to the same model slug,
  // keep only one score per (model, benchmark) — prefer the one from the base (non-variant) entry
  const deduped = new Map<string, typeof stagingRows[0]>()
  for (const row of stagingRows) {
    const key = `${row.model_name}:${row.benchmark_key}`
    if (!deduped.has(key)) {
      deduped.set(key, row)
    }
    // First entry wins (base model entries come before variants in most cases)
  }
  const finalRows = Array.from(deduped.values())
  console.log(`  After dedup: ${finalRows.length} unique (model, benchmark) scores`)

  // Insert in batches of 100
  for (let i = 0; i < finalRows.length; i += 100) {
    const batch = finalRows.slice(i, i + 100)
    const { error } = await supabase.from('staging_benchmarks').insert(batch)
    if (error) throw error
  }

  // Update data source status
  await supabase.from('data_sources').upsert({
    key: 'artificial_analysis',
    name: 'Artificial Analysis',
    url: AA_URL,
    status: 'active',
    last_status: 'success',
    last_fetched_at: new Date().toISOString(),
    last_error: null,
    consecutive_failures: 0,
  }, { onConflict: 'key' })

  console.log(`✅ Artificial Analysis: ${finalRows.length} benchmark scores fetched`)
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('❌ Artificial Analysis fetch failed:', message)

  supabase.from('data_sources').upsert({
    key: 'artificial_analysis',
    name: 'Artificial Analysis',
    url: AA_URL,
    last_status: 'failed',
    last_error: message,
  }, { onConflict: 'key' }).then(() => {
    process.exit(1)
  })
})
