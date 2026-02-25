import { createClient } from '@supabase/supabase-js'
import { buildPricingMatchContext, resolveModelSlug } from '../../lib/model-matching'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const OR_API_BASE = 'https://openrouter.ai/api/v1'

interface ORModel {
  id: string
  name: string
  pricing?: {
    prompt?: string
    completion?: string
  }
}

interface OREndpoint {
  provider_name?: string
  latency_last_30m?: number  // TTFT in ms
  throughput_last_30m?: number  // tokens per second
}

async function fetchModels(): Promise<ORModel[]> {
  const res = await fetch(`${OR_API_BASE}/models`, {
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`OpenRouter models API: ${res.status}`)
  const data = await res.json()
  return data.data ?? []
}

async function fetchEndpoints(modelId: string): Promise<OREndpoint[]> {
  try {
    const res = await fetch(`${OR_API_BASE}/models/${encodeURIComponent(modelId)}/endpoints`, {
      signal: AbortSignal.timeout(15000),
    })
    if (res.status === 404) {
      // Endpoints API no longer available - return empty gracefully
      return []
    }
    if (!res.ok) return []
    const data = await res.json()
    return data.data ?? []
  } catch {
    return []
  }
}

// Probe: check if endpoints API is available before iterating all models
async function isEndpointsAPIAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OR_API_BASE}/models/openai%2Fgpt-4o/endpoints`, {
      signal: AbortSignal.timeout(10000),
    })
    return res.ok
  } catch {
    return false
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  console.log('Fetching OpenRouter speed metrics...')

  const ctx = await buildPricingMatchContext(supabase)
  console.log(`  Match context: ${ctx.dbMappings.size} DB mappings, ${ctx.dbSlugs.size} model slugs`)

  // Load model slug → model_id mapping for speed_metrics table
  const { data: dbModels } = await supabase.from('models').select('id, slug')
  const slugToModelId = new Map((dbModels ?? []).map(m => [m.slug, m.id]))

  // Check if endpoints API is available before wasting time
  const apiAvailable = await isEndpointsAPIAvailable()
  if (!apiAvailable) {
    console.log('  OpenRouter endpoints API unavailable (404). Speed data requires AA API instead.')
    console.log('  Skipping OpenRouter speed fetch — use fetch-aa-api.ts for speed metrics.')
    return
  }

  const orModels = await fetchModels()
  console.log(`  OpenRouter: ${orModels.length} models`)

  const stagingRows: {
    source_key: string
    model_name: string
    benchmark_key: string
    raw_score: number
    status: string
  }[] = []

  const speedMetricRows: {
    model_id: string
    provider: string
    route_provider: string | null
    ttft_ms: number | null
    output_tps: number | null
    metric_percentile: string
    source_type: string
    observed_at: string
    confidence: number
  }[] = []

  let matched = 0
  let skipped = 0

  // Process in batches to respect rate limits
  const BATCH_SIZE = 10
  const BATCH_DELAY = 200

  for (let i = 0; i < orModels.length; i += BATCH_SIZE) {
    const batch = orModels.slice(i, i + BATCH_SIZE)

    const endpointPromises = batch.map(async (model) => {
      // Try matching: 1) full ID  2) stripped provider prefix  3) with :suffix removed
      let slug = resolveModelSlug(model.id, ctx)
      if (!slug) {
        const parts = model.id.split('/')
        const rawName = parts.length > 1 ? parts[1] : parts[0]
        const cleanName = rawName.replace(/:.*$/, '') // remove :exacto etc.
        slug = resolveModelSlug(cleanName, ctx)
      }
      if (!slug) {
        skipped++
        return
      }

      const modelId = slugToModelId.get(slug)
      if (!modelId) {
        skipped++
        return
      }

      const endpoints = await fetchEndpoints(model.id)
      if (endpoints.length === 0) return

      matched++

      // Find best TPS and TTFT across all providers
      let bestTps = 0
      let bestTtft = Infinity

      for (const ep of endpoints) {
        const providerName = ep.provider_name ?? 'unknown'

        const tps = ep.throughput_last_30m
        const ttft = ep.latency_last_30m

        // Write every provider's data to speed_metrics
        if (tps != null || ttft != null) {
          speedMetricRows.push({
            model_id: modelId,
            provider: 'openrouter',
            route_provider: providerName,
            ttft_ms: ttft != null && ttft > 0 ? Math.round(ttft * 100) / 100 : null,
            output_tps: tps != null && tps > 0 ? Math.round(tps * 100) / 100 : null,
            metric_percentile: 'p50',
            source_type: 'openrouter',
            observed_at: new Date().toISOString(),
            confidence: 0.8,
          })
        }

        // Track best values for staging_benchmarks (radar chart)
        if (tps != null && tps > bestTps) bestTps = tps
        if (ttft != null && ttft > 0 && ttft < bestTtft) bestTtft = ttft
      }

      // Write best values to staging_benchmarks for the benchmark pipeline
      if (bestTps > 0) {
        stagingRows.push({
          source_key: 'openrouter',
          model_name: slug,
          benchmark_key: 'output_tps',
          raw_score: Math.round(bestTps * 100) / 100,
          status: 'pending',
        })
      }

      if (bestTtft < Infinity && bestTtft > 0) {
        stagingRows.push({
          source_key: 'openrouter',
          model_name: slug,
          benchmark_key: 'ttft_ms',
          raw_score: Math.round(bestTtft * 100) / 100,
          status: 'pending',
        })
      }
    })

    await Promise.all(endpointPromises)

    if (i + BATCH_SIZE < orModels.length) {
      await delay(BATCH_DELAY)
    }
  }

  console.log(`  Matched: ${matched} models, Skipped: ${skipped}`)
  console.log(`  Staging rows: ${stagingRows.length}, Speed metric rows: ${speedMetricRows.length}`)

  // Insert staging_benchmarks in batches
  if (stagingRows.length > 0) {
    for (let i = 0; i < stagingRows.length; i += 100) {
      const batch = stagingRows.slice(i, i + 100)
      const { error } = await supabase.from('staging_benchmarks').insert(batch)
      if (error) console.warn(`  staging_benchmarks batch error: ${error.message}`)
    }
    console.log(`  Inserted ${stagingRows.length} staging benchmark rows`)
  }

  // Upsert speed_metrics in batches
  if (speedMetricRows.length > 0) {
    for (let i = 0; i < speedMetricRows.length; i += 100) {
      const batch = speedMetricRows.slice(i, i + 100)
      const { error } = await supabase.from('speed_metrics').upsert(batch, {
        onConflict: 'model_id,provider,route_provider,metric_percentile,source_type',
      })
      if (error) console.warn(`  speed_metrics batch error: ${error.message}`)
    }
    console.log(`  Upserted ${speedMetricRows.length} speed metric rows`)
  }

  // Update data source
  await supabase.from('data_sources').upsert({
    key: 'openrouter_speed',
    name: 'OpenRouter Speed Metrics',
    url: OR_API_BASE,
    status: 'active',
    last_status: 'success',
    last_fetched_at: new Date().toISOString(),
    last_error: null,
    consecutive_failures: 0,
  }, { onConflict: 'key' })

  console.log(`OpenRouter Speed: ${stagingRows.length} staging + ${speedMetricRows.length} detailed metrics`)
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('OpenRouter speed fetch failed:', message)

  supabase.from('data_sources').upsert({
    key: 'openrouter_speed',
    name: 'OpenRouter Speed Metrics',
    url: OR_API_BASE,
    last_status: 'failed',
    last_error: message,
  }, { onConflict: 'key' }).then(() => {
    process.exit(1)
  })
})
