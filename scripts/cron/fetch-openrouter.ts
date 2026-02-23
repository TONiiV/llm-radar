import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

interface OpenRouterModel {
  id: string
  pricing: { prompt: string; completion: string }
  context_length: number
}

async function main() {
  console.log('Fetching OpenRouter models...')
  const res = await fetch('https://openrouter.ai/api/v1/models')
  if (!res.ok) throw new Error(`OpenRouter API error: ${res.status}`)

  const { data } = await res.json() as { data: OpenRouterModel[] }

  const rows = data
    .filter(m => m.pricing?.prompt && m.pricing?.completion)
    .map(m => ({
      source_key: 'openrouter',
      model_name: m.id,
      input_price_per_1m: parseFloat(m.pricing.prompt) * 1_000_000,
      output_price_per_1m: parseFloat(m.pricing.completion) * 1_000_000,
      context_window: m.context_length,
      status: 'pending',
    }))

  // Insert in batches of 100
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100)
    const { error } = await supabase.from('staging_prices').insert(batch)
    if (error) throw error
  }

  // Update data source status
  await supabase.from('data_sources').update({
    last_status: 'success',
    last_fetched_at: new Date().toISOString(),
    last_error: null,
    consecutive_failures: 0,
  }).eq('key', 'openrouter')

  console.log(`✅ OpenRouter: ${rows.length} models fetched`)
}

main().catch(async (err) => {
  console.error('❌ OpenRouter fetch failed:', err.message)

  // Update failure status
  const { data } = await supabase
    .from('data_sources')
    .select('consecutive_failures')
    .eq('key', 'openrouter')
    .single()

  const failures = (data?.consecutive_failures ?? 0) + 1
  await supabase.from('data_sources').update({
    last_status: 'failed',
    last_error: err.message,
    consecutive_failures: failures,
    status: failures >= 7 ? 'disabled' : failures >= 3 ? 'failing' : 'active',
  }).eq('key', 'openrouter')

  process.exit(1)
})
