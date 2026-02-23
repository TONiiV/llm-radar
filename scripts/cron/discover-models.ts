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
}

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

  // 2. Fetch OpenRouter models for metadata
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

  // 5. Find new models (from Epoch AI only — these are frontier models)
  const newModels: {
    name: string
    slug: string
    provider: { slug: string; name: string; color: string }
    orMeta: OpenRouterModel | undefined
  }[] = []

  for (const epochName of Array.from(epochNames)) {
    // Skip if already mapped
    if (mappedNames.has(epochName)) continue

    // Try to infer provider
    const provider = inferProvider(epochName)
    if (!provider) {
      console.log(`  ⏭️  Skipping "${epochName}" — unknown provider`)
      continue
    }

    const slug = generateSlug(epochName)

    // Skip if slug already exists
    if (existingSlugs.has(slug)) {
      // Model exists but mapping doesn't — create mapping only
      console.log(`  📎 Model "${epochName}" exists (${slug}), adding mapping`)
      await supabase.from('model_name_mappings').upsert({
        source_key: 'epoch_ai',
        source_name: epochName,
        model_slug: slug,
      }, { onConflict: 'source_key,source_name' })
      continue
    }

    // Skip if name already exists (different slug format)
    if (existingNames.has(epochName)) continue

    // Look up OpenRouter metadata
    const orMeta = orByName.get(epochName.toLowerCase())

    newModels.push({ name: epochName, slug, provider, orMeta })
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
      context_window_output: null,
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

    // Create epoch_ai mapping
    await supabase.from('model_name_mappings').upsert({
      source_key: 'epoch_ai',
      source_name: m.name,
      model_slug: m.slug,
    }, { onConflict: 'source_key,source_name' })

    // Create openrouter mapping if we have metadata
    if (m.orMeta) {
      await supabase.from('model_name_mappings').upsert({
        source_key: 'openrouter',
        source_name: m.orMeta.id,
        model_slug: m.slug,
      }, { onConflict: 'source_key,source_name' })
    }

    registered++
    console.log(`  ✅ ${m.name} → ${m.slug}`)
  }

  console.log(`\n✅ Discovery complete: ${registered} new models registered`)
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('❌ Model discovery failed:', message)
  process.exit(1)
})
