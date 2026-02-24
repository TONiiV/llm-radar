import { createClient } from '@supabase/supabase-js'
import { buildMatchContext, resolveModelSlug } from '../../lib/model-matching'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const AA_API_BASE = 'https://api.artificialanalysis.ai/v0'
const AA_API_KEY = process.env.AA_API_KEY ?? ''

// AA API field → our benchmark key + score scale
// AA API returns scores as fractions (0-1), multiply by scale to get percentage
const AA_BENCHMARK_MAP: Record<string, { key: string; scale: number }> = {
  mmlu_pro:           { key: 'mmlu_pro',            scale: 100 },
  gpqa:               { key: 'gpqa_diamond',        scale: 100 },
  ifbench:            { key: 'ifbench',             scale: 100 },
  aime25:             { key: 'aime_2025',           scale: 100 },
  tau2:               { key: 'tau2_bench',          scale: 100 },
  terminalbench_hard: { key: 'terminal_bench',      scale: 100 },
  gdpval_normalized:  { key: 'gdpval_aa',           scale: 100 },
  hle:                { key: 'humanitys_last_exam', scale: 100 },
}

// Speed metrics from AA API
const SPEED_FIELDS = ['output_tps', 'ttft_ms'] as const

interface AAModel {
  slug?: string
  name?: string
  output_tps?: number
  ttft_ms?: number
  [key: string]: unknown
}

async function fetchFromAPI(): Promise<AAModel[] | null> {
  if (!AA_API_KEY) {
    console.log('  No AA_API_KEY set, skipping API fetch')
    return null
  }

  try {
    console.log('  Trying AA API...')
    const res = await fetch(`${AA_API_BASE}/models`, {
      headers: {
        'x-api-key': AA_API_KEY,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) {
      console.warn(`  AA API returned ${res.status}: ${res.statusText}`)
      return null
    }

    const data = await res.json()
    const models = Array.isArray(data) ? data : (data as { data?: AAModel[] }).data
    if (!Array.isArray(models)) {
      console.warn('  AA API returned unexpected format')
      return null
    }

    console.log(`  AA API: ${models.length} models returned`)
    return models as AAModel[]
  } catch (err) {
    console.warn(`  AA API failed: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

async function main() {
  console.log('Fetching Artificial Analysis data (API priority)...')

  const models = await fetchFromAPI()

  if (!models || models.length === 0) {
    console.log('  AA API unavailable. Run fetch-artificial-analysis.ts (RSC fallback) instead.')
    // Exit cleanly — the workflow will run the RSC fallback next
    return
  }

  const ctx = await buildMatchContext(supabase, 'artificial_analysis')
  console.log(`  Match context: ${ctx.dbMappings.size} DB mappings, ${ctx.dbSlugs.size} model slugs`)

  // Load slug → model_id for speed_metrics table
  const { data: dbModels } = await supabase.from('models').select('id, slug')
  const slugToModelId = new Map((dbModels ?? []).map(m => [m.slug, m.id]))

  const benchmarkRows: {
    source_key: string
    model_name: string
    benchmark_key: string
    raw_score: number
    status: string
  }[] = []

  const speedRows: {
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

  let mapped = 0
  let unmapped = 0
  const unmappedSlugs = new Set<string>()

  for (const model of models) {
    const aaSlug = model.slug ?? model.name
    if (!aaSlug) continue

    const slug = resolveModelSlug(String(aaSlug), ctx)
    if (!slug) {
      unmapped++
      unmappedSlugs.add(String(aaSlug))
      continue
    }

    mapped++

    // Benchmark scores
    for (const [aaKey, bmConfig] of Object.entries(AA_BENCHMARK_MAP)) {
      const rawValue = model[aaKey]
      if (rawValue == null) continue

      const score = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue))
      if (isNaN(score)) continue

      // AA scores are fractions (0-1), multiply by scale
      const normalizedScore = Math.round(score * bmConfig.scale * 100) / 100

      benchmarkRows.push({
        source_key: 'artificial_analysis',
        model_name: slug,
        benchmark_key: bmConfig.key,
        raw_score: normalizedScore,
        status: 'pending',
      })
    }

    // Speed metrics
    if (model.output_tps != null) {
      const tps = typeof model.output_tps === 'number' ? model.output_tps : parseFloat(String(model.output_tps))
      if (!isNaN(tps) && tps > 0) {
        speedRows.push({
          source_key: 'artificial_analysis',
          model_name: slug,
          benchmark_key: 'output_tps',
          raw_score: Math.round(tps * 100) / 100,
          status: 'pending',
        })
      }
    }

    if (model.ttft_ms != null) {
      const ttft = typeof model.ttft_ms === 'number' ? model.ttft_ms : parseFloat(String(model.ttft_ms))
      if (!isNaN(ttft) && ttft > 0) {
        speedRows.push({
          source_key: 'artificial_analysis',
          model_name: slug,
          benchmark_key: 'ttft_ms',
          raw_score: Math.round(ttft * 100) / 100,
          status: 'pending',
        })
      }
    }

    // Also write to speed_metrics table for detailed data
    const modelId = slugToModelId.get(slug)
    if (modelId) {
      const tpsVal = model.output_tps != null ? (typeof model.output_tps === 'number' ? model.output_tps : parseFloat(String(model.output_tps))) : NaN
      const ttftVal = model.ttft_ms != null ? (typeof model.ttft_ms === 'number' ? model.ttft_ms : parseFloat(String(model.ttft_ms))) : NaN
      if ((!isNaN(tpsVal) && tpsVal > 0) || (!isNaN(ttftVal) && ttftVal > 0)) {
        speedMetricRows.push({
          model_id: modelId,
          provider: 'direct',
          route_provider: null,
          ttft_ms: !isNaN(ttftVal) && ttftVal > 0 ? Math.round(ttftVal * 100) / 100 : null,
          output_tps: !isNaN(tpsVal) && tpsVal > 0 ? Math.round(tpsVal * 100) / 100 : null,
          metric_percentile: 'p50',
          source_type: 'artificial_analysis',
          observed_at: new Date().toISOString(),
          confidence: 0.9,
        })
      }
    }
  }

  console.log(`  Mapped: ${mapped} models, Unmapped: ${unmapped}`)
  if (unmappedSlugs.size > 0) {
    console.log(`  Unmapped: ${Array.from(unmappedSlugs).slice(0, 20).join(', ')}${unmappedSlugs.size > 20 ? ` ... (+${unmappedSlugs.size - 20} more)` : ''}`)
  }

  // Deduplicate benchmark rows
  const deduped = new Map<string, typeof benchmarkRows[0]>()
  for (const row of [...benchmarkRows, ...speedRows]) {
    const key = `${row.model_name}:${row.benchmark_key}`
    if (!deduped.has(key)) {
      deduped.set(key, row)
    }
  }
  const finalRows = Array.from(deduped.values())
  console.log(`  After dedup: ${finalRows.length} unique scores (${benchmarkRows.length} benchmark + ${speedRows.length} speed)`)

  if (finalRows.length === 0) {
    console.log('  No scores to insert.')
    return
  }

  // Insert in batches of 100
  for (let i = 0; i < finalRows.length; i += 100) {
    const batch = finalRows.slice(i, i + 100)
    const { error } = await supabase.from('staging_benchmarks').insert(batch)
    if (error) throw error
  }

  // Upsert speed_metrics table
  if (speedMetricRows.length > 0) {
    for (let i = 0; i < speedMetricRows.length; i += 100) {
      const batch = speedMetricRows.slice(i, i + 100)
      const { error } = await supabase.from('speed_metrics').upsert(batch, {
        onConflict: 'model_id,provider,route_provider,metric_percentile,source_type',
      })
      if (error) console.warn(`  speed_metrics batch error: ${error.message}`)
    }
    console.log(`  Upserted ${speedMetricRows.length} speed_metrics rows`)
  }

  // Update data source status
  await supabase.from('data_sources').upsert({
    key: 'artificial_analysis',
    name: 'Artificial Analysis',
    url: AA_API_BASE,
    status: 'active',
    last_status: 'success',
    last_fetched_at: new Date().toISOString(),
    last_error: null,
    consecutive_failures: 0,
  }, { onConflict: 'key' })

  console.log(`AA API: ${finalRows.length} scores fetched (${benchmarkRows.length} benchmark + ${speedRows.length} speed)`)
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('AA API fetch failed:', message)

  supabase.from('data_sources').upsert({
    key: 'artificial_analysis',
    name: 'Artificial Analysis',
    url: AA_API_BASE,
    last_status: 'failed',
    last_error: message,
  }, { onConflict: 'key' }).then(() => {
    // Don't exit(1) — let RSC fallback run
    console.log('  Will fall back to RSC fetch')
  })
})
