import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const LITELLM_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json'

interface LiteLLMModel {
  input_cost_per_token?: number
  output_cost_per_token?: number
  max_tokens?: number
  max_input_tokens?: number
}

async function main() {
  console.log('Fetching LiteLLM pricing data...')
  const res = await fetch(LITELLM_URL)
  if (!res.ok) throw new Error(`LiteLLM fetch error: ${res.status}`)

  const data = await res.json() as Record<string, LiteLLMModel>

  const rows = Object.entries(data)
    .filter(([key, v]) => key !== 'sample_spec' && v.input_cost_per_token != null && v.output_cost_per_token != null)
    .filter(([, v]) => typeof v.input_cost_per_token === 'number' && typeof v.output_cost_per_token === 'number')
    .map(([name, v]) => {
      const maxInput = v.max_input_tokens
      const maxTokens = v.max_tokens
      const ctxWindow = typeof maxInput === 'number' ? maxInput
        : typeof maxTokens === 'number' ? maxTokens
        : null
      return {
        source_key: 'litellm',
        model_name: name,
        input_price_per_1m: (v.input_cost_per_token ?? 0) * 1_000_000,
        output_price_per_1m: (v.output_cost_per_token ?? 0) * 1_000_000,
        context_window: ctxWindow,
        status: 'pending',
      }
    })

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
  }).eq('key', 'litellm')

  console.log(`✅ LiteLLM: ${rows.length} models fetched`)
}

main().catch(async (err) => {
  console.error('❌ LiteLLM fetch failed:', err.message)

  const { data } = await supabase
    .from('data_sources')
    .select('consecutive_failures')
    .eq('key', 'litellm')
    .single()

  const failures = (data?.consecutive_failures ?? 0) + 1
  await supabase.from('data_sources').update({
    last_status: 'failed',
    last_error: err.message,
    consecutive_failures: failures,
    status: failures >= 7 ? 'disabled' : failures >= 3 ? 'failing' : 'active',
  }).eq('key', 'litellm')

  process.exit(1)
})
