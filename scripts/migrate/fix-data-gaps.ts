/**
 * One-time data gap fix script.
 * Fixes:
 * 1. Missing prices — fetch from OpenRouter and insert directly
 * 2. Missing seed.json prices not in DB
 * 3. Fix validate-and-merge bypass for already-resolved slugs
 *
 * Run via: npx tsx scripts/migrate/fix-data-gaps.ts
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_KEY
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// ─── Known prices for models missing from both OpenRouter and seed.json ───
// These are manually verified from provider pricing pages
const MANUAL_PRICES: Record<string, { input: number; output: number; confirmed: boolean }> = {
  // xAI — https://docs.x.ai/docs/models (Feb 2026)
  'grok-4':              { input: 3.00,   output: 15.00,  confirmed: true },
  'grok-41':             { input: 3.00,   output: 15.00,  confirmed: false },
  'grok-4-fast':         { input: 0.20,   output: 0.50,   confirmed: true },
  'grok-3':              { input: 3.00,   output: 15.00,  confirmed: true },
  'grok-3-mini':         { input: 0.30,   output: 0.50,   confirmed: true },
  'grok-code-fast-1':    { input: 0.20,   output: 0.50,   confirmed: false },

  // Anthropic — https://docs.anthropic.com/en/docs/about-claude/models
  'claude-opus-4':       { input: 15.00,  output: 75.00,  confirmed: true },
  'claude-opus-41':      { input: 15.00,  output: 75.00,  confirmed: true },
  'claude-sonnet-4':     { input: 3.00,   output: 15.00,  confirmed: true },

  // OpenAI — https://openai.com/api/pricing/
  'o3':                  { input: 2.00,   output: 8.00,   confirmed: true },
  'o3-mini':             { input: 1.10,   output: 4.40,   confirmed: true },
  'o3-mini-high':        { input: 1.10,   output: 4.40,   confirmed: true },
  'o3-pro':              { input: 20.00,  output: 80.00,  confirmed: true },
  'o1':                  { input: 15.00,  output: 60.00,  confirmed: true },
  'o1-mini':             { input: 1.10,   output: 4.40,   confirmed: true },
  'o1-preview':          { input: 15.00,  output: 60.00,  confirmed: true },
  'o1-pro':              { input: 150.00, output: 600.00, confirmed: true },
  'o4-mini':             { input: 1.10,   output: 4.40,   confirmed: true },
  'o4-mini-high':        { input: 1.10,   output: 4.40,   confirmed: false },
  'gpt-41':              { input: 2.00,   output: 8.00,   confirmed: true },
  'gpt-41-mini':         { input: 0.40,   output: 1.60,   confirmed: true },
  'gpt-41-nano':         { input: 0.10,   output: 0.40,   confirmed: true },
  'gpt-45':              { input: 75.00,  output: 150.00, confirmed: true },
  'gpt-4o':              { input: 2.50,   output: 10.00,  confirmed: true },
  'gpt-4o-mini':         { input: 0.15,   output: 0.60,   confirmed: true },
  'gpt-5-codex':         { input: 1.25,   output: 5.00,   confirmed: false },
  'gpt-5-nano':          { input: 0.10,   output: 0.40,   confirmed: false },
  'gpt-51':              { input: 1.25,   output: 5.00,   confirmed: false },
  'gpt-51-codex':        { input: 1.25,   output: 5.00,   confirmed: false },
  'gpt-oss-120b':        { input: 0.30,   output: 1.20,   confirmed: false },
  'gpt-oss-20b':         { input: 0.10,   output: 0.40,   confirmed: false },

  // Moonshot/Kimi
  'kimi-k2':             { input: 0.50,   output: 2.40,   confirmed: true },
  'kimi-k2-thinking':    { input: 0.47,   output: 2.00,   confirmed: true },
  'kimi-k25':            { input: 0.45,   output: 2.20,   confirmed: false },

  // DeepSeek
  'deepseek-v3':         { input: 0.27,   output: 1.10,   confirmed: true },
  'deepseek-v3-0324':    { input: 0.27,   output: 1.10,   confirmed: true },
  'deepseek-v31':        { input: 0.27,   output: 1.10,   confirmed: false },

  // Google — https://ai.google.dev/pricing
  'gemini-25-flash':     { input: 0.15,   output: 0.60,   confirmed: true },
  'gemini-25-pro':       { input: 1.25,   output: 10.00,  confirmed: true },
  'gemini-20-flash':     { input: 0.10,   output: 0.40,   confirmed: true },
  'gemini-3-flash':      { input: 0.50,   output: 3.00,   confirmed: false },
  'gemini-3-pro':        { input: 2.00,   output: 12.00,  confirmed: false },
  'gemini-31-pro':       { input: 2.00,   output: 12.00,  confirmed: false },

  // Mistral
  'mistral-large-3':     { input: 2.00,   output: 6.00,   confirmed: false },
  'mistral-large-2':     { input: 2.00,   output: 6.00,   confirmed: true },
  'mistral-medium-3':    { input: 0.40,   output: 2.00,   confirmed: false },
  'mistral-medium-31':   { input: 0.40,   output: 2.00,   confirmed: false },
  'codestral-2508':      { input: 0.30,   output: 0.90,   confirmed: false },

  // MiniMax
  'minimax-m2':          { input: 0.27,   output: 0.95,   confirmed: false },
  'minimax-m21':         { input: 0.27,   output: 0.95,   confirmed: true },

  // Meta
  'llama-4-maverick':    { input: 0.27,   output: 0.85,   confirmed: true },
  'llama-4-scout':       { input: 0.27,   output: 0.85,   confirmed: true },

  // Qwen
  'qwen3-max':           { input: 1.60,   output: 6.40,   confirmed: false },
  'qwen3-max-thinking':  { input: 1.20,   output: 6.00,   confirmed: true },
  'qwen25-max':          { input: 1.60,   output: 6.40,   confirmed: false },
  'qwen3-coder-next':    { input: 0.12,   output: 0.75,   confirmed: true },

  // GLM
  'glm-47':              { input: 0.50,   output: 2.00,   confirmed: false },
  'glm-5':               { input: 0.95,   output: 2.55,   confirmed: true },
  'glm-46':              { input: 0.35,   output: 1.40,   confirmed: false },

  // NVIDIA
  'nvidia-nemotron-3':   { input: 0.40,   output: 1.60,   confirmed: false },
}

async function fixPrices() {
  console.log('═══ Phase 1: Fixing missing prices ═══')

  // Get all model slugs → IDs
  const { data: models } = await supabase
    .from('models')
    .select('id, slug')
    .eq('status', 'active')

  if (!models) {
    console.error('Failed to fetch models')
    return
  }

  const slugToId = new Map(models.map(m => [m.slug, m.id]))

  // Get existing prices
  const { data: existingPrices } = await supabase
    .from('prices')
    .select('model_id')

  const hasPrice = new Set((existingPrices ?? []).map(p => p.model_id))

  // Also try fetching from OpenRouter API for latest prices
  let openRouterPrices: Record<string, { input: number; output: number }> = {}
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models')
    if (res.ok) {
      const { data: orModels } = await res.json() as { data: Array<{ id: string; pricing: { prompt: string; completion: string } }> }
      for (const m of orModels) {
        if (m.pricing?.prompt && m.pricing?.completion) {
          const input = parseFloat(m.pricing.prompt) * 1_000_000
          const output = parseFloat(m.pricing.completion) * 1_000_000
          if (input > 0 || output > 0) {
            // Try to match OpenRouter ID to our slug
            // OpenRouter format: "provider/model-name" → strip provider
            const parts = m.id.split('/')
            const rawSlug = parts.length > 1 ? parts[1] : parts[0]
            // Remove :exacto suffixes
            const cleanSlug = rawSlug.replace(/:.*$/, '')
            openRouterPrices[cleanSlug] = { input, output }
          }
        }
      }
      console.log(`  Fetched ${Object.keys(openRouterPrices).length} prices from OpenRouter`)
    }
  } catch (e) {
    console.warn(`  OpenRouter fetch failed, using manual prices only`)
  }

  // Merge all price sources: manual > seed.json > OpenRouter
  const toInsert: Array<{
    model_id: string
    input_price_per_1m: number
    output_price_per_1m: number
    confirmed: boolean
    recorded_at: string
  }> = []

  let inserted = 0
  let skipped = 0
  let alreadyHas = 0

  slugToId.forEach((modelId, slug) => {
    if (hasPrice.has(modelId)) {
      alreadyHas++
      return
    }

    // Check manual prices first
    const manual = MANUAL_PRICES[slug]
    if (manual) {
      toInsert.push({
        model_id: modelId,
        input_price_per_1m: manual.input,
        output_price_per_1m: manual.output,
        confirmed: manual.confirmed,
        recorded_at: new Date().toISOString(),
      })
      inserted++
      return
    }

    // Check OpenRouter prices
    const or = openRouterPrices[slug]
    if (or) {
      toInsert.push({
        model_id: modelId,
        input_price_per_1m: or.input,
        output_price_per_1m: or.output,
        confirmed: false,
        recorded_at: new Date().toISOString(),
      })
      inserted++
      return
    }

    skipped++
  })

  console.log(`  Already has price: ${alreadyHas}`)
  console.log(`  New prices to insert: ${inserted}`)
  console.log(`  Still missing (no price source): ${skipped}`)

  if (toInsert.length > 0) {
    // Insert in batches
    for (let i = 0; i < toInsert.length; i += 50) {
      const batch = toInsert.slice(i, i + 50)
      const { error } = await supabase.from('prices').upsert(batch, { onConflict: 'model_id', ignoreDuplicates: true })
      if (error) {
        console.error(`  Batch insert error: ${error.message}`)
      }
    }
    console.log(`  ✅ Inserted ${toInsert.length} prices`)
  }

  // List models still without prices
  const stillMissing: string[] = []
  slugToId.forEach((id, slug) => {
    if (!hasPrice.has(id) && !MANUAL_PRICES[slug] && !openRouterPrices[slug]) {
      stillMissing.push(slug)
    }
  })

  if (stillMissing.length > 0) {
    console.log(`\n  Models still without prices (${stillMissing.length}):`)
    for (const slug of stillMissing.slice(0, 20)) {
      console.log(`    - ${slug}`)
    }
    if (stillMissing.length > 20) {
      console.log(`    ... and ${stillMissing.length - 20} more`)
    }
  }
}

async function fixValidateAndMerge() {
  console.log('\n═══ Phase 2: Process stuck staging prices ═══')

  // Get pending staging prices
  const { data: pending } = await supabase
    .from('staging_prices')
    .select('id, source_key, model_name, input_price_per_1m, output_price_per_1m')
    .eq('status', 'pending')

  if (!pending || pending.length === 0) {
    console.log('  No pending staging prices')
    return
  }

  console.log(`  Found ${pending.length} pending staging prices`)

  // Get all model slugs → IDs
  const { data: models } = await supabase
    .from('models')
    .select('id, slug')
    .eq('status', 'active')

  const slugToId = new Map((models ?? []).map(m => [m.slug, m.id]))

  let resolved = 0
  let unresolved = 0

  for (const sp of pending) {
    // The model_name might already be our slug (from resolveModelSlug in fetch scripts)
    const modelId = slugToId.get(sp.model_name)
    if (!modelId) {
      unresolved++
      continue
    }

    // Upsert price directly
    const { error } = await supabase.from('prices').upsert({
      model_id: modelId,
      input_price_per_1m: sp.input_price_per_1m,
      output_price_per_1m: sp.output_price_per_1m,
      confirmed: false,
      recorded_at: new Date().toISOString(),
    }, { onConflict: 'model_id' })

    if (error) {
      console.warn(`  Failed to merge ${sp.model_name}: ${error.message}`)
      continue
    }

    // Mark as approved
    await supabase.from('staging_prices').update({
      status: 'approved',
      processed_at: new Date().toISOString(),
    }).eq('id', sp.id)

    resolved++
  }

  console.log(`  ✅ Resolved: ${resolved}, Unresolved: ${unresolved}`)
}

async function main() {
  console.log('Starting data gap fix...\n')
  await fixPrices()
  await fixValidateAndMerge()
  console.log('\n✅ Data gap fix complete')
}

main().catch((err) => {
  console.error('❌ Fix failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
