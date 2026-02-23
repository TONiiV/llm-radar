import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Maximum allowed price change ratio (300% increase or decrease)
const MAX_CHANGE_RATIO = 3.0

async function main() {
  console.log('Validating and merging staging prices...')

  // Get all pending staging prices that have model mappings
  const { data: mappings } = await supabase
    .from('model_name_mappings')
    .select('external_name, source_key, model_id')

  if (!mappings || mappings.length === 0) {
    console.log('No model name mappings found, skipping merge.')
    return
  }

  const mappingLookup = new Map<string, string>()
  for (const m of mappings) {
    mappingLookup.set(`${m.source_key}:${m.external_name}`, m.model_id)
  }

  // Build slug → model_id lookup for direct slug matching
  const { data: allModels } = await supabase
    .from('models')
    .select('id, slug')
    .eq('status', 'active')

  const slugToId = new Map<string, string>()
  for (const m of allModels ?? []) {
    slugToId.set(m.slug, m.id)
  }

  // Get pending staging prices
  const { data: stagingPrices } = await supabase
    .from('staging_prices')
    .select('*')
    .eq('status', 'pending')

  if (!stagingPrices || stagingPrices.length === 0) {
    console.log('No pending staging prices to process.')
    return
  }

  let merged = 0
  let skipped = 0
  let flagged = 0

  for (const sp of stagingPrices) {
    // Try mapping table first, then direct slug match (from resolveModelSlug)
    const modelId = mappingLookup.get(`${sp.source_key}:${sp.model_name}`)
      ?? slugToId.get(sp.model_name)
    if (!modelId) {
      // No mapping — skip but don't reject (might be a new model)
      skipped++
      continue
    }

    // Get current price for this model
    const { data: currentPrice } = await supabase
      .from('prices')
      .select('input_price_per_1m, output_price_per_1m')
      .eq('model_id', modelId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single()

    // Validate price change if existing data
    if (currentPrice) {
      const inputRatio = sp.input_price_per_1m / currentPrice.input_price_per_1m
      const outputRatio = sp.output_price_per_1m / currentPrice.output_price_per_1m

      if (inputRatio > MAX_CHANGE_RATIO || inputRatio < 1 / MAX_CHANGE_RATIO ||
          outputRatio > MAX_CHANGE_RATIO || outputRatio < 1 / MAX_CHANGE_RATIO) {
        // Flag for manual review
        await supabase.from('staging_prices').update({
          status: 'flagged',
          validation_notes: `Price change exceeds ${MAX_CHANGE_RATIO}x threshold. Input: ${currentPrice.input_price_per_1m} → ${sp.input_price_per_1m}, Output: ${currentPrice.output_price_per_1m} → ${sp.output_price_per_1m}`,
          processed_at: new Date().toISOString(),
        }).eq('id', sp.id)
        flagged++
        continue
      }
    }

    // Insert/update price
    const { error } = await supabase.from('prices').upsert({
      model_id: modelId,
      input_price_per_1m: sp.input_price_per_1m,
      output_price_per_1m: sp.output_price_per_1m,
      recorded_at: new Date().toISOString(),
    }, {
      onConflict: 'model_id',
    })

    if (error) {
      console.warn(`Failed to merge price for ${sp.model_name}: ${error.message}`)
      continue
    }

    // Mark as approved
    await supabase.from('staging_prices').update({
      status: 'approved',
      processed_at: new Date().toISOString(),
    }).eq('id', sp.id)

    merged++
  }

  console.log(`✅ Validate & Merge: ${merged} merged, ${flagged} flagged, ${skipped} skipped (no mapping)`)
}

main().catch((err) => {
  console.error('❌ Validate and merge failed:', err.message)
  process.exit(1)
})
