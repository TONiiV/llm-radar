import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// AA benchmark field name → our benchmark key + score scale
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
}

// AA slug → our model slug (built-in fallback mappings)
// IMPORTANT: Verified against actual AA API slugs (2026-02-23)
// AA uses inconsistent naming: opus = "claude-opus-4-5", but sonnet = "claude-4-5-sonnet"
const AA_MODEL_MAP: Record<string, string> = {
  // Claude — AA uses TWO naming conventions
  'claude-opus-4-6':              'claude-opus-46',
  'claude-opus-4-5':              'claude-opus-45',
  'claude-opus-4-5-thinking':     'claude-opus-45',   // reasoning variant, same model
  'claude-4-1-opus-thinking':     'claude-opus-41',
  'claude-4-opus':                'claude-opus-4',
  'claude-4-opus-thinking':       'claude-opus-4',
  'claude-4-5-sonnet':            'claude-sonnet-45',  // AA uses "claude-4-5-sonnet" NOT "claude-sonnet-4-5"
  'claude-4-5-sonnet-thinking':   'claude-sonnet-45',
  'claude-4-sonnet':              'claude-sonnet-4',
  'claude-4-sonnet-thinking':     'claude-sonnet-4',
  'claude-4-5-haiku':             'claude-haiku-45',   // AA uses "claude-4-5-haiku" NOT "claude-haiku-4-5"
  'claude-4-5-haiku-reasoning':   'claude-haiku-45',
  'claude-3-7-sonnet':            'claude-37-sonnet',
  'claude-3-7-sonnet-thinking':   'claude-37-sonnet',
  'claude-35-sonnet':             'claude-35-sonnet',
  'claude-3-5-haiku':             'claude-35-haiku',
  // GPT
  'gpt-5-2':                      'gpt-52',
  'gpt-5':                        'gpt-5',
  'gpt-5-1':                      'gpt-51',
  'gpt-5-codex':                  'gpt-52-codex',      // AA "gpt-5-codex" = our gpt-52-codex
  'gpt-5-1-codex':                'gpt-51-codex-mini', // verify: AA slug → our model
  'gpt-5-1-codex-mini':           'gpt-51-codex-mini',
  'gpt-4-1':                      'gpt-41',
  'gpt-4-1-mini':                 'gpt-41-mini',
  'gpt-4-1-nano':                 'gpt-41-nano',
  'gpt-4o':                       'gpt-4o',
  'gpt-4o-mini':                  'gpt-4o-mini',
  'gpt-4-5':                      'gpt-45',
  'gpt-5-mini':                   'gpt-5-mini',
  'gpt-5-nano':                   'gpt-5-nano',
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
  'deepseek-r1-0528':             'deepseek-r1-0528',
  'deepseek-v3':                  'deepseek-v3',
  'deepseek-v3-1':                'deepseek-v31',
  'deepseek-v3-2':                'deepseek-v32',
  'deepseek-v3-2-speciale':       'deepseek-v32-speciale',
  'deepseek-v3-2-exp':            'deepseek-v32-exp',
  'deepseek-v3-0324':             'deepseek-v3-0325',
  // Gemini
  'gemini-2-5-pro':               'gemini-25-pro',
  'gemini-2-5-flash':             'gemini-25-flash',
  'gemini-2-0-flash':             'gemini-20-flash',
  'gemini-3-pro':                 'gemini-3-pro',
  'gemini-3-flash':               'gemini-3-flash',
  'gemini-3-1-pro':               'gemini-31-pro',
  // Grok — AA has "grok-4-1-fast" but NOT plain "grok-4-1"
  'grok-3':                       'grok-3',
  'grok-4':                       'grok-4',
  'grok-3-mini-reasoning':        'grok-3-mini',
  'grok-4-1-fast':                'grok-41-fast',
  'grok-4-1-fast-reasoning':      'grok-41-fast',
  'grok-4-fast':                  'grok-41',           // grok-4-fast → our grok-41
  'grok-4-fast-reasoning':        'grok-41',
  // Meta
  'llama-4-maverick':             'llama-4-maverick',
  'llama-4-scout':                'llama-4-scout',
  // Mistral
  'mistral-medium-3':             'mistral-medium-3',
  'mistral-large-3':              'mistral-large-3',
  'devstral-2':                   'devstral-2',
  'devstral-small-2':             'devstral-2',
  // Qwen
  'qwen3-235b-a22b-instruct':     'qwen3-235b',
  'qwen3-max':                    'qwen3-max',
  'qwen3-max-thinking-preview':   'qwen3-max-thinking',
  'qwen-2-5-max':                 'qwen25-max',
  // GLM
  'glm-4-7':                      'glm-47',
  'glm-4-7-non-reasoning':        'glm-47',
  'glm-4-6':                      'glm-5',             // AA's glm-4-6 maps to our glm-5 if same model
  // Kimi
  'kimi-k2':                      'kimi-k2',
  'kimi-k2-0905':                 'kimi-k25',
  'kimi-k2-thinking':             'kimi-k2-thinking',
  // MiniMax
  'minimax-m2-1':                 'minimax-m21',
  'minimax-m2':                   'minimax-m25',        // AA "minimax-m2" → our minimax-m25
  // Nvidia
  'nvidia-nemotron-3-nano-30b-a3b':           'nvidia-nemotron-3',
  'nvidia-nemotron-3-nano-30b-a3b-reasoning': 'nvidia-nemotron-3',
}

// The AA page we fetch RSC data from (any evaluations page works — they all include defaultData)
const AA_URL = 'https://artificialanalysis.ai/evaluations/mmlu-pro'

interface AADataPoint {
  slug?: string
  name?: string
  reasoning_mode?: string
  [key: string]: unknown
}

function extractDefaultData(rscText: string): AADataPoint[] {
  // RSC flight format contains JSON arrays — find "defaultData":[...]
  // The pattern: "defaultData":[ ... large JSON array ... ]
  const marker = '"defaultData":'
  const idx = rscText.indexOf(marker)
  if (idx === -1) {
    throw new Error('Could not find "defaultData" in RSC payload')
  }

  const arrayStart = rscText.indexOf('[', idx + marker.length)
  if (arrayStart === -1) {
    throw new Error('Could not find array start after "defaultData"')
  }

  // Find matching closing bracket
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

function resolveModelSlug(
  aaSlug: string,
  dbMappings: Map<string, string>
): string | null {
  // Try DB mappings first
  const dbSlug = dbMappings.get(aaSlug)
  if (dbSlug) return dbSlug

  // Try built-in mappings
  const builtinSlug = AA_MODEL_MAP[aaSlug]
  if (builtinSlug) return builtinSlug

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
  const unmappedSlugs = new Set<string>()

  for (const entry of data) {
    const aaSlug = entry.slug
    if (!aaSlug) continue

    // Skip reasoning variants — prefer non-reasoning or take highest
    // AA includes entries like "claude-3-7-sonnet" with reasoning_mode: "enabled"
    // We want the base model scores (reasoning_mode undefined or "disabled")
    if (entry.reasoning_mode === 'enabled') continue

    const slug = resolveModelSlug(aaSlug, dbMappings)
    if (!slug) {
      unmapped++
      unmappedSlugs.add(aaSlug)
      continue
    }

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

  console.log(`  Mapped: ${mapped} scores, Unmapped: ${unmapped} models`)
  if (unmappedSlugs.size > 0) {
    console.log(`  Unmapped AA slugs: ${Array.from(unmappedSlugs).slice(0, 20).join(', ')}${unmappedSlugs.size > 20 ? ` ... (+${unmappedSlugs.size - 20} more)` : ''}`)
  }

  if (stagingRows.length === 0) {
    console.log('  No benchmark scores to insert.')
    return
  }

  // Insert in batches of 100
  for (let i = 0; i < stagingRows.length; i += 100) {
    const batch = stagingRows.slice(i, i + 100)
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

  console.log(`✅ Artificial Analysis: ${stagingRows.length} benchmark scores fetched`)
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
