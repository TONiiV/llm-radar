import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'
import { join } from 'path'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

async function main() {
  console.log('🔄 Regenerating seed.json from Supabase...')

  // 1. Fetch providers
  const { data: providers, error: provErr } = await supabase
    .from('providers')
    .select('name, slug, color')
    .order('name')
  if (provErr) throw new Error(`Providers fetch failed: ${provErr.message}`)
  console.log(`  ${providers.length} providers`)

  // 2. Fetch active models with provider slug
  const { data: models, error: modelsErr } = await supabase
    .from('models')
    .select(`
      id, name, slug, context_window_input, context_window_output,
      is_open_source, is_reasoning_model, release_date, tags,
      providers!inner(slug)
    `)
    .eq('status', 'active')
    .order('name')
  if (modelsErr) throw new Error(`Models fetch failed: ${modelsErr.message}`)
  console.log(`  ${models.length} active models`)

  // 3. Fetch all benchmark scores with source for priority handling
  // Paginate to avoid Supabase 1000-row default limit
  const scores: { model_id: string; benchmark_key: string; raw_score: number; source: string }[] = []
  let scoreOffset = 0
  while (true) {
    const { data: page, error: scoresErr } = await supabase
      .from('benchmark_scores')
      .select('model_id, benchmark_key, raw_score, source')
      .range(scoreOffset, scoreOffset + 999)
    if (scoresErr) throw new Error(`Scores fetch failed: ${scoresErr.message}`)
    if (!page || page.length === 0) break
    scores.push(...page)
    scoreOffset += page.length
    if (page.length < 1000) break
  }

  // 4. Fetch latest prices per model
  const { data: prices, error: pricesErr } = await supabase
    .from('prices')
    .select('model_id, input_price_per_1m, output_price_per_1m, confirmed')
    .order('recorded_at', { ascending: false })
  if (pricesErr) throw new Error(`Prices fetch failed: ${pricesErr.message}`)

  // Build model_id → slug mapping
  const idToSlug = new Map(models.map(m => [m.id, m.slug]))

  // Group scores by model slug — prefer external sources over 'official' (seed-originated)
  const SOURCE_PRIORITY: Record<string, number> = { artificial_analysis: 4, openrouter: 3, epoch_ai: 3, official: 2, lmarena: 1 }
  const scoresBySlug = new Map<string, Record<string, number>>()
  const sourcePriBySlug = new Map<string, Record<string, number>>()
  for (const s of scores) {
    const slug = idToSlug.get(s.model_id)
    if (!slug) continue
    if (!scoresBySlug.has(slug)) { scoresBySlug.set(slug, {}); sourcePriBySlug.set(slug, {}) }
    const priority = SOURCE_PRIORITY[s.source ?? ''] ?? 0
    const existing = sourcePriBySlug.get(slug)![s.benchmark_key] ?? -1
    if (priority >= existing) {
      scoresBySlug.get(slug)![s.benchmark_key] = Number(s.raw_score)
      sourcePriBySlug.get(slug)![s.benchmark_key] = priority
    }
  }

  // Get latest price per model (first occurrence = latest due to order)
  const priceBySlug = new Map<string, { input_per_1m: number; output_per_1m: number; confirmed: boolean }>()
  for (const p of prices) {
    const slug = idToSlug.get(p.model_id)
    if (!slug || priceBySlug.has(slug)) continue
    priceBySlug.set(slug, {
      input_per_1m: Number(p.input_price_per_1m),
      output_per_1m: Number(p.output_price_per_1m),
      confirmed: p.confirmed,
    })
  }

  // 5. Build seed data
  const seedModels = models.map(m => {
    const prov = m.providers as unknown
    const providerSlug = Array.isArray(prov)
      ? (prov[0] as { slug: string })?.slug ?? ''
      : (prov as { slug: string })?.slug ?? ''

    const price = priceBySlug.get(m.slug)

    return {
      name: m.name,
      slug: m.slug,
      provider: providerSlug,
      context_window_input: m.context_window_input ?? 0,
      context_window_output: m.context_window_output ?? 0,
      is_open_source: m.is_open_source ?? false,
      is_reasoning_model: m.is_reasoning_model ?? false,
      release_date: m.release_date ?? '',
      tags: m.tags ?? [],
      pricing: {
        input_per_1m: price?.input_per_1m ?? 0,
        output_per_1m: price?.output_per_1m ?? 0,
        confirmed: price?.confirmed ?? false,
      },
      benchmarks: scoresBySlug.get(m.slug) ?? {},
    }
  })

  const seedData = {
    providers: providers.map(p => ({
      name: p.name,
      slug: p.slug,
      color: p.color,
    })),
    models: seedModels,
  }

  // 6. Write to seed.json
  const seedPath = join(process.cwd(), 'data', 'seed.json')
  writeFileSync(seedPath, JSON.stringify(seedData, null, 2) + '\n')

  console.log(`✅ seed.json regenerated: ${providers.length} providers, ${seedModels.length} models`)
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('❌ Seed regeneration failed:', message)
  process.exit(1)
})
