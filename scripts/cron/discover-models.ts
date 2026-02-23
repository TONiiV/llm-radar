import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const EPOCH_CSV_URL = 'https://epoch.ai/data/eci_benchmarks.csv'
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/models'

// ─── Provider inference rules ───────────────────────────────────

const PROVIDER_PATTERNS: [RegExp, { slug: string; name: string; color: string }][] = [
  [/^Claude/i,                { slug: 'anthropic', name: 'Anthropic',  color: '#D97706' }],
  [/^GPT|^o[1-9]/i,          { slug: 'openai',    name: 'OpenAI',     color: '#10A37F' }],
  [/^Gemini/i,                { slug: 'google',    name: 'Google',     color: '#4285F4' }],
  [/^Grok/i,                  { slug: 'xai',       name: 'xAI',        color: '#1DA1F2' }],
  [/^DeepSeek/i,              { slug: 'deepseek',  name: 'DeepSeek',   color: '#5B6CF0' }],
  [/^Llama/i,                 { slug: 'meta',      name: 'Meta',       color: '#1877F2' }],
  [/^Mistral|^Codestral/i,   { slug: 'mistral',   name: 'Mistral',    color: '#FF7000' }],
  [/^Qwen/i,                  { slug: 'alibaba',   name: 'Alibaba',    color: '#FF6A00' }],
  [/^GLM/i,                   { slug: 'zhipu',     name: 'Zhipu',      color: '#00D4AA' }],
  [/^Kimi/i,                  { slug: 'moonshot',  name: 'Moonshot',   color: '#8B5CF6' }],
  [/^MiniMax/i,               { slug: 'minimax',   name: 'MiniMax',    color: '#EC4899' }],
  [/^Nemotron/i,              { slug: 'nvidia',    name: 'NVIDIA',     color: '#76B900' }],
]

// ─── Frontier model filter ──────────────────────────────────────
// Only register models that are "frontier-class" — skip old/small models
// that would clutter the radar. Patterns match model names we do NOT want.

const SKIP_PATTERNS: RegExp[] = [
  // Old/small LLaMA variants
  /^LLaMA-/i,
  /^Llama [23]\b/i,             // Llama 2-*, Llama 3-*, Llama 3.x-*
  // Old GPT models
  /^GPT-3/i,
  /^GPT-4 (?!\.)/i,            // GPT-4 (any date) but not GPT-4.x
  /^GPT-4o (?!mini)/i,         // GPT-4o date variants (keep GPT-4o mini)
  // Old Claude models
  /^Claude [23]\b/i,           // Claude 2, Claude 3 Haiku/Opus/Sonnet
  /^Claude Instant/i,
  // Small coder/specialized models
  /Coder \d+B\b/i,             // DeepSeek Coder 1.3B, Qwen2.5-Coder (7B), etc.
  /Coder.*\(\d+B\)/i,
  /^DeepSeek Coder/i,
  // Old DeepSeek
  /^DeepSeek-V2/i,             // DeepSeek-V2 variants
  // Old/small Qwen
  /^Qwen-/i,                   // Qwen-7B, Qwen-14B (old gen)
  /^Qwen2-/i,                  // Qwen2-72B
  /^Qwen2\.5-(?!Max)/i,        // Qwen2.5-72B, Qwen2.5-Coder but keep Qwen2.5-Max
  // Old Mistral
  /^Mistral (?:7B|NeMo)\b/i,
  // Old Gemini
  /^Gemini 1\./i,
  // Small Nemotron
  /^Nemotron-4 15B/i,
  // Old Grok
  /^Grok-2\b/i,
]

function isFrontierModel(name: string): boolean {
  return !SKIP_PATTERNS.some(p => p.test(name))
}

// ─── Utility functions ──────────────────────────────────────────

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function inferProvider(name: string): { slug: string; name: string; color: string } | null {
  for (const [pattern, provider] of PROVIDER_PATTERNS) {
    if (pattern.test(name)) return provider
  }
  return null
}

function isReasoningModel(name: string): boolean {
  return /^o[1-9]|DeepSeek-R|thinking|reason/i.test(name)
}

// ─── OpenRouter types ───────────────────────────────────────────

interface OpenRouterModel {
  id: string
  name: string
  pricing: { prompt: string; completion: string }
  context_length: number
  created: number
  top_provider?: { max_completion_tokens?: number }
}

// OpenRouter provider prefix → our provider slug
const OR_PROVIDER_MAP: Record<string, string> = {
  'google': 'google',
  'anthropic': 'anthropic',
  'openai': 'openai',
  'x-ai': 'xai',
  'deepseek': 'deepseek',
  'meta-llama': 'meta',
  'mistralai': 'mistral',
  'qwen': 'alibaba',
  'z-ai': 'zhipu',
  'moonshotai': 'moonshot',
  'minimax': 'minimax',
  'nvidia': 'nvidia',
}

// OpenRouter model IDs to skip (variants, free tiers, wrappers)
const OR_SKIP_PATTERNS = /(free|:extended|:nitro|:floor|:online|beta)/i

// ─── Parse Epoch CSV ────────────────────────────────────────────

function extractEpochModelNames(csvText: string): Set<string> {
  const names = new Set<string>()
  const lines = csvText.trim().split('\n')
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols.length < 11) continue
    const model = cols[10]
    if (model) names.add(model)
  }
  return names
}

// Clean OpenRouter display name → our model name
function cleanORName(orId: string, orName: string): string {
  // Remove "Provider: " prefix (e.g. "Google: Gemini 3.1 Pro Preview")
  const cleaned = orName.replace(/^[^:]+:\s*/, '')
  // Remove " Preview" suffix
  return cleaned.replace(/\s+Preview$/i, '')
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log('🔍 Discovering new models...')

  // 1. Fetch model names from Epoch AI CSV
  console.log('  Fetching Epoch AI CSV...')
  const epochRes = await fetch(EPOCH_CSV_URL, { signal: AbortSignal.timeout(30000) })
  if (!epochRes.ok) throw new Error(`Epoch CSV fetch failed: ${epochRes.status}`)
  const epochText = await epochRes.text()
  const epochNames = extractEpochModelNames(epochText)
  console.log(`  Found ${epochNames.size} unique model names in Epoch AI`)

  // 2. Fetch OpenRouter models — used BOTH as discovery source AND metadata
  console.log('  Fetching OpenRouter models...')
  let openRouterModels: OpenRouterModel[] = []
  try {
    const orRes = await fetch(OPENROUTER_API_URL, { signal: AbortSignal.timeout(30000) })
    if (orRes.ok) {
      const { data } = await orRes.json() as { data: OpenRouterModel[] }
      openRouterModels = data ?? []
      console.log(`  Found ${openRouterModels.length} models in OpenRouter`)
    }
  } catch (err) {
    console.warn('  ⚠️ OpenRouter fetch failed, continuing without metadata')
  }

  // Build OpenRouter lookup by normalized name
  const orByName = new Map<string, OpenRouterModel>()
  for (const m of openRouterModels) {
    if (m.name) orByName.set(m.name.toLowerCase(), m)
  }

  // Extract frontier model names from OpenRouter (top providers only)
  const orFrontierNames = new Set<string>()
  const orMetaById = new Map<string, OpenRouterModel>()
  for (const m of openRouterModels) {
    const provPrefix = m.id.split('/')[0]
    if (!OR_PROVIDER_MAP[provPrefix]) continue
    if (OR_SKIP_PATTERNS.test(m.id)) continue
    const cleanName = cleanORName(m.id, m.name || m.id.split('/')[1])
    orFrontierNames.add(cleanName)
    orMetaById.set(cleanName.toLowerCase(), m)
  }
  console.log(`  ${orFrontierNames.size} frontier models from OpenRouter`)

  // 3. Load existing models and mappings from DB
  const { data: existingModels } = await supabase
    .from('models')
    .select('slug, name')
  const existingSlugs = new Set((existingModels ?? []).map(m => m.slug))
  const existingNames = new Set((existingModels ?? []).map(m => m.name))

  const { data: existingMappings } = await supabase
    .from('model_name_mappings')
    .select('source_name')
  const mappedNames = new Set((existingMappings ?? []).map(m => m.source_name))

  // 4. Load existing providers
  const { data: existingProviders } = await supabase
    .from('providers')
    .select('slug, name, color')
  const providerSlugs = new Set((existingProviders ?? []).map(p => p.slug))

  // 5. Merge discovery sources: Epoch AI + OpenRouter frontier models
  const allCandidates = new Map<string, { name: string; source: string; orMeta?: OpenRouterModel }>()

  // Add Epoch models
  for (const epochName of Array.from(epochNames)) {
    if (!isFrontierModel(epochName)) continue
    const orMeta = orByName.get(epochName.toLowerCase())
    allCandidates.set(epochName.toLowerCase(), { name: epochName, source: 'epoch_ai', orMeta })
  }

  // Add OpenRouter frontier models (new models not in Epoch)
  for (const orName of Array.from(orFrontierNames)) {
    const key = orName.toLowerCase()
    if (!allCandidates.has(key) && isFrontierModel(orName)) {
      const orMeta = orMetaById.get(key)
      allCandidates.set(key, { name: orName, source: 'openrouter', orMeta })
    }
  }

  console.log(`  ${allCandidates.size} total unique frontier candidates`)

  const newModels: {
    name: string
    slug: string
    provider: { slug: string; name: string; color: string }
    orMeta: OpenRouterModel | undefined
    source: string
  }[] = []

  for (const [, candidate] of Array.from(allCandidates.entries())) {
    const { name: modelName, source, orMeta } = candidate

    // Skip if already mapped
    if (mappedNames.has(modelName)) continue

    // Try to infer provider
    const provider = inferProvider(modelName)
    if (!provider) continue

    const slug = generateSlug(modelName)

    // Skip if slug already exists
    if (existingSlugs.has(slug)) {
      // Model exists but mapping doesn't — create mapping only
      if (source === 'epoch_ai') {
        console.log(`  📎 Model "${modelName}" exists (${slug}), adding mapping`)
        await supabase.from('model_name_mappings').upsert({
          source_key: 'epoch_ai',
          source_name: modelName,
          model_slug: slug,
        }, { onConflict: 'source_key,source_name' })
      }
      continue
    }

    // Skip if name already exists (different slug format)
    if (existingNames.has(modelName)) continue

    newModels.push({ name: modelName, slug, provider, orMeta, source })
  }

  if (newModels.length === 0) {
    console.log('✅ No new models to register')
    return
  }

  console.log(`\n📋 Found ${newModels.length} new models to register:`)
  for (const m of newModels) {
    console.log(`  - ${m.name} (${m.slug}) → ${m.provider.name}`)
  }

  // 6. Ensure providers exist
  const newProviders = new Map<string, { slug: string; name: string; color: string }>()
  for (const m of newModels) {
    if (!providerSlugs.has(m.provider.slug) && !newProviders.has(m.provider.slug)) {
      newProviders.set(m.provider.slug, m.provider)
    }
  }

  if (newProviders.size > 0) {
    console.log(`\n  Creating ${newProviders.size} new providers...`)
    for (const provider of Array.from(newProviders.values())) {
      const { error } = await supabase.from('providers').upsert({
        slug: provider.slug,
        name: provider.name,
        color: provider.color,
      }, { onConflict: 'slug' })
      if (error) console.error(`  ⚠️ Provider ${provider.slug}: ${error.message}`)
      else console.log(`  ✅ Provider: ${provider.name}`)
      providerSlugs.add(provider.slug)
    }
  }

  // 7. Get provider IDs
  const { data: allProviders } = await supabase
    .from('providers')
    .select('id, slug')
  const providerIdMap = new Map((allProviders ?? []).map(p => [p.slug, p.id]))

  // 8. Register new models
  console.log(`\n  Registering ${newModels.length} models...`)
  let registered = 0

  for (const m of newModels) {
    const providerId = providerIdMap.get(m.provider.slug)
    if (!providerId) {
      console.error(`  ⚠️ No provider ID for ${m.provider.slug}, skipping ${m.name}`)
      continue
    }

    // Insert model
    const { error: modelErr } = await supabase.from('models').insert({
      name: m.name,
      slug: m.slug,
      provider_id: providerId,
      context_window_input: m.orMeta?.context_length ?? null,
      context_window_output: m.orMeta?.top_provider?.max_completion_tokens ?? null,
      is_open_source: /^Llama|^Qwen|^Mistral|^DeepSeek|^GLM/i.test(m.name),
      is_reasoning_model: isReasoningModel(m.name),
      release_date: m.orMeta?.created
        ? new Date(m.orMeta.created * 1000).toISOString().split('T')[0]
        : null,
      tags: [],
      status: 'active',
    })

    if (modelErr) {
      console.error(`  ⚠️ Model ${m.name}: ${modelErr.message}`)
      continue
    }

    // Create source mapping
    await supabase.from('model_name_mappings').upsert({
      source_key: m.source,
      source_name: m.source === 'openrouter' && m.orMeta ? m.orMeta.id : m.name,
      model_slug: m.slug,
    }, { onConflict: 'source_key,source_name' })

    // Create cross-mapping if we have OpenRouter metadata and source is epoch_ai
    if (m.source === 'epoch_ai' && m.orMeta) {
      await supabase.from('model_name_mappings').upsert({
        source_key: 'openrouter',
        source_name: m.orMeta.id,
        model_slug: m.slug,
      }, { onConflict: 'source_key,source_name' })
    }
    // Create epoch_ai mapping if source is openrouter
    if (m.source === 'openrouter') {
      await supabase.from('model_name_mappings').upsert({
        source_key: 'epoch_ai',
        source_name: m.name,
        model_slug: m.slug,
      }, { onConflict: 'source_key,source_name' })
    }

    registered++
    console.log(`  ✅ ${m.name} → ${m.slug}`)
  }

  console.log(`\n✅ Discovery complete: ${registered} new models registered`)

  // 9. Log OpenRouter SOTA overview by provider (for monitoring)
  if (openRouterModels.length > 0) {
    console.log('\n📊 OpenRouter SOTA by Provider (top model per provider):')
    const byProvider = new Map<string, OpenRouterModel[]>()
    for (const m of openRouterModels) {
      const prov = m.id.split('/')[0]
      if (!OR_PROVIDER_MAP[prov]) continue
      if (OR_SKIP_PATTERNS.test(m.id)) continue
      if (!byProvider.has(prov)) byProvider.set(prov, [])
      byProvider.get(prov)!.push(m)
    }
    for (const [prov, models] of Array.from(byProvider.entries())) {
      // Sort by creation date, newest first
      models.sort((a, b) => (b.created || 0) - (a.created || 0))
      const top = models[0]
      const date = top.created ? new Date(top.created * 1000).toISOString().split('T')[0] : '???'
      console.log(`  ${OR_PROVIDER_MAP[prov].padEnd(10)} → ${top.id.padEnd(45)} (${date})`)
    }
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('❌ Model discovery failed:', message)
  process.exit(1)
})
