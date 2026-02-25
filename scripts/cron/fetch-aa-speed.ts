import { createClient } from '@supabase/supabase-js'
import { buildMatchContext, resolveModelSlug } from '../../lib/model-matching'

/**
 * Fetch speed metrics (output_tps, ttft_ms) from Artificial Analysis.
 *
 * Primary source: /models page RSC payload — contains a `"models":` array
 * with 400+ models, each having `timescaleData` with:
 *   - median_output_speed: tokens per second
 *   - median_time_to_first_chunk: seconds (we convert to ms)
 *   - percentile distributions (p05, p95, q25, q75)
 *
 * Fallback: /evaluations/* pages (same RSC approach but fewer models per page).
 *
 * This script does NOT require an AA_API_KEY — it uses RSC scraping.
 *
 * Writes to:
 *   1. staging_benchmarks — for the benchmark pipeline (output_tps, ttft_ms)
 *   2. speed_metrics — detailed per-model speed data with percentiles
 */

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const AA_MODELS_URL = 'https://artificialanalysis.ai/models'
const AA_EVAL_BASE = 'https://artificialanalysis.ai/evaluations'
const SOURCE_KEY = 'artificial_analysis'

// Fallback eval pages if /models fails
const AA_EVAL_PAGES = [
  'mmlu-pro',
  'gpqa-diamond',
  'ifbench',
  'aime-2025',
  'tau2-bench',
  'terminalbench-hard',
  'gdpval-aa',
  'humanitys-last-exam',
]

interface TimescaleData {
  model_id?: string
  median_output_speed?: number
  median_time_to_first_chunk?: number
  percentile_05_output_speed?: number
  percentile_95_output_speed?: number
  quartile_25_output_speed?: number
  quartile_75_output_speed?: number
  percentile_05_time_to_first_chunk?: number
  percentile_95_time_to_first_chunk?: number
  quartile_25_time_to_first_chunk?: number
  quartile_75_time_to_first_chunk?: number
  [key: string]: unknown
}

interface AAModelEntry {
  slug?: string
  name?: string
  short_name?: string
  timescaleData?: TimescaleData
  host_models?: Array<{ slug?: string; host_model_string?: string }>
  [key: string]: unknown
}

/**
 * Extract a JSON array from RSC text using a marker key.
 * Finds `"<marker>":` then parses the array that follows.
 * If `validate` is provided, tries all occurrences until one passes validation.
 */
function extractArray(
  rscText: string,
  marker: string,
  validate?: (arr: unknown[]) => boolean,
): unknown[] {
  const fullMarker = `"${marker}":`
  let searchFrom = 0

  while (searchFrom < rscText.length) {
    const idx = rscText.indexOf(fullMarker, searchFrom)
    if (idx === -1) return []

    const arrayStart = rscText.indexOf('[', idx + fullMarker.length)
    if (arrayStart === -1) return []

    // Make sure the [ immediately follows the marker (allowing whitespace)
    const between = rscText.slice(idx + fullMarker.length, arrayStart).trim()
    if (between.length > 0) {
      searchFrom = idx + fullMarker.length
      continue
    }

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
      searchFrom = arrayStart + 1
      continue
    }

    const jsonStr = rscText.slice(arrayStart, arrayEnd)
    try {
      const result = JSON.parse(jsonStr) as unknown[]
      if (!validate || validate(result)) {
        return result
      }
    } catch {
      // Parse failed, try next occurrence
    }

    searchFrom = arrayEnd
  }

  return []
}

/**
 * Fetch RSC payload from a URL.
 */
async function fetchRSC(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'RSC': '1',
      'Next-Router-State-Tree': encodeURIComponent(JSON.stringify([''])),
      'User-Agent': 'Mozilla/5.0 (compatible; LLMRadar/1.0)',
    },
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

/**
 * Primary source: fetch /models page and extract the "models" array.
 * This array contains 400+ models with timescaleData embedded.
 */
async function fetchModelsPage(): Promise<AAModelEntry[]> {
  console.log('  Fetching /models page...')
  const rscText = await fetchRSC(AA_MODELS_URL)

  // The /models page has multiple "models": arrays. We need the one
  // containing model objects with timescaleData (speed metrics).
  // The first "models": array is a list of model creators (labs).
  // The correct one has objects with keys like "slug", "timescaleData", "name".
  const models = extractArray(rscText, 'models', (arr) => {
    if (arr.length < 10) return false // The correct array has 400+ items
    const first = arr[0]
    return (
      typeof first === 'object' &&
      first !== null &&
      'slug' in first &&
      'timescaleData' in first
    )
  }) as AAModelEntry[]

  // Filter to only dict-like entries with slugs
  const valid = models.filter(
    (m): m is AAModelEntry =>
      typeof m === 'object' && m !== null && typeof m.slug === 'string'
  )

  const withSpeed = valid.filter(
    (m) =>
      m.timescaleData &&
      ((m.timescaleData.median_output_speed ?? 0) > 0 ||
        (m.timescaleData.median_time_to_first_chunk ?? 0) > 0)
  )

  console.log(`  /models: ${valid.length} models, ${withSpeed.length} with speed data`)
  return valid
}

/**
 * Fallback: fetch evaluation pages and merge by slug.
 * Each eval page has a "defaultData" array with timescaleData.
 */
async function fetchEvalPagesFallback(): Promise<AAModelEntry[]> {
  console.log('  Falling back to evaluation pages...')
  const mergedModels = new Map<string, AAModelEntry>()

  for (const page of AA_EVAL_PAGES) {
    try {
      const rscText = await fetchRSC(`${AA_EVAL_BASE}/${page}`)
      const data = extractArray(rscText, 'defaultData') as AAModelEntry[]
      const valid = data.filter(
        (m): m is AAModelEntry =>
          typeof m === 'object' && m !== null && typeof m.slug === 'string'
      )
      console.log(`    ${page}: ${valid.length} models`)

      for (const entry of valid) {
        if (!entry.slug) continue
        const existing = mergedModels.get(entry.slug)
        if (existing) {
          // Merge timescaleData
          if (entry.timescaleData && !existing.timescaleData) {
            existing.timescaleData = entry.timescaleData
          } else if (entry.timescaleData && existing.timescaleData) {
            const ts = existing.timescaleData
            const newTs = entry.timescaleData
            if ((!ts.median_output_speed || ts.median_output_speed === 0) &&
                newTs.median_output_speed && newTs.median_output_speed > 0) {
              ts.median_output_speed = newTs.median_output_speed
            }
            if ((!ts.median_time_to_first_chunk || ts.median_time_to_first_chunk === 0) &&
                newTs.median_time_to_first_chunk && newTs.median_time_to_first_chunk > 0) {
              ts.median_time_to_first_chunk = newTs.median_time_to_first_chunk
            }
          }
        } else {
          mergedModels.set(entry.slug, { ...entry })
        }
      }
    } catch (err) {
      console.warn(`    ${page}: failed - ${err instanceof Error ? err.message : err}`)
    }
  }

  const results = Array.from(mergedModels.values())
  const withSpeed = results.filter(
    (m) =>
      m.timescaleData &&
      ((m.timescaleData.median_output_speed ?? 0) > 0 ||
        (m.timescaleData.median_time_to_first_chunk ?? 0) > 0)
  )
  console.log(`  Eval pages merged: ${results.length} models, ${withSpeed.length} with speed data`)
  return results
}

async function main() {
  console.log('Fetching AA speed metrics (output_tps, ttft_ms) via RSC scraping...')

  // Try /models page first (superset of eval pages: ~408 vs ~343 models)
  let models: AAModelEntry[]
  try {
    models = await fetchModelsPage()
    if (models.length === 0) throw new Error('No models found on /models page')
  } catch (err) {
    console.warn(`  /models page failed: ${err instanceof Error ? err.message : err}`)
    models = await fetchEvalPagesFallback()
  }

  if (models.length === 0) {
    console.log('  No models found from any source.')
    return
  }

  const ctx = await buildMatchContext(supabase, SOURCE_KEY)
  console.log(`  Match context: ${ctx.dbMappings.size} DB mappings, ${ctx.dbSlugs.size} model slugs`)

  // Load model slug -> model_id mapping for speed_metrics table
  const { data: dbModels } = await supabase.from('models').select('id, slug')
  const slugToModelId = new Map((dbModels ?? []).map((m) => [m.slug, m.id]))

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
  let unmapped = 0
  let withSpeed = 0
  const unmappedSlugs = new Set<string>()

  for (const entry of models) {
    if (!entry.slug) continue

    const slug = resolveModelSlug(entry.slug, ctx)
    if (!slug) {
      unmapped++
      unmappedSlugs.add(entry.slug)
      continue
    }

    const ts = entry.timescaleData
    if (!ts) continue

    const tps = ts.median_output_speed
    const ttftSec = ts.median_time_to_first_chunk

    if ((tps == null || tps <= 0) && (ttftSec == null || ttftSec <= 0)) continue

    withSpeed++
    matched++

    // --- staging_benchmarks: best values for benchmark pipeline ---

    if (tps != null && tps > 0) {
      stagingRows.push({
        source_key: SOURCE_KEY,
        model_name: slug,
        benchmark_key: 'output_tps',
        raw_score: Math.round(tps * 100) / 100,
        status: 'pending',
      })
    }

    if (ttftSec != null && ttftSec > 0) {
      const ttftMs = ttftSec * 1000
      stagingRows.push({
        source_key: SOURCE_KEY,
        model_name: slug,
        benchmark_key: 'ttft_ms',
        raw_score: Math.round(ttftMs * 100) / 100,
        status: 'pending',
      })
    }

    // --- speed_metrics: detailed data with percentiles ---

    const modelId = slugToModelId.get(slug)
    if (!modelId) continue

    const ttftMs = ttftSec != null && ttftSec > 0
      ? Math.round(ttftSec * 1000 * 100) / 100
      : null
    const outputTps = tps != null && tps > 0
      ? Math.round(tps * 100) / 100
      : null

    // Median (p50) row
    speedMetricRows.push({
      model_id: modelId,
      provider: 'artificial_analysis',
      route_provider: null,
      ttft_ms: ttftMs,
      output_tps: outputTps,
      metric_percentile: 'p50',
      source_type: 'artificial_analysis',
      observed_at: new Date().toISOString(),
      confidence: 0.9,
    })

    // p95 row (worst-case / tail latency performance)
    const p95Tps = ts.percentile_95_output_speed
    const p95TtftSec = ts.percentile_95_time_to_first_chunk
    if ((p95Tps != null && p95Tps > 0) || (p95TtftSec != null && p95TtftSec > 0)) {
      speedMetricRows.push({
        model_id: modelId,
        provider: 'artificial_analysis',
        route_provider: null,
        ttft_ms: p95TtftSec != null && p95TtftSec > 0
          ? Math.round(p95TtftSec * 1000 * 100) / 100
          : null,
        output_tps: p95Tps != null && p95Tps > 0
          ? Math.round(p95Tps * 100) / 100
          : null,
        metric_percentile: 'p95',
        source_type: 'artificial_analysis',
        observed_at: new Date().toISOString(),
        confidence: 0.9,
      })
    }
  }

  console.log(`  Models with speed data: ${withSpeed}, Matched: ${matched}, Unmapped: ${unmapped}`)
  if (unmappedSlugs.size > 0) {
    console.log(
      `  Unmapped AA slugs: ${Array.from(unmappedSlugs).slice(0, 20).join(', ')}${
        unmappedSlugs.size > 20 ? ` ... (+${unmappedSlugs.size - 20} more)` : ''
      }`
    )
  }

  // --- Deduplicate staging rows ---
  const dedupedStaging = new Map<string, (typeof stagingRows)[0]>()
  for (const row of stagingRows) {
    const key = `${row.model_name}:${row.benchmark_key}`
    if (!dedupedStaging.has(key)) {
      dedupedStaging.set(key, row)
    }
  }
  const finalStagingRows = Array.from(dedupedStaging.values())
  console.log(`  Staging rows: ${finalStagingRows.length} (after dedup)`)

  // --- Insert staging_benchmarks ---
  if (finalStagingRows.length > 0) {
    for (let i = 0; i < finalStagingRows.length; i += 100) {
      const batch = finalStagingRows.slice(i, i + 100)
      const { error } = await supabase.from('staging_benchmarks').insert(batch)
      if (error) throw error
    }
    console.log(`  Inserted ${finalStagingRows.length} staging benchmark rows`)
  }

  // --- Upsert speed_metrics (deduplicate first, then delete+insert) ---
  if (speedMetricRows.length > 0) {
    // Deduplicate: multiple AA slugs can resolve to the same model_id
    const dedupedSpeed = new Map<string, (typeof speedMetricRows)[0]>()
    for (const row of speedMetricRows) {
      const key = `${row.model_id}:${row.provider}:${row.route_provider ?? ''}:${row.metric_percentile}:${row.source_type}`
      if (!dedupedSpeed.has(key)) {
        dedupedSpeed.set(key, row)
      }
    }
    const finalSpeedRows = Array.from(dedupedSpeed.values())
    console.log(`  Speed metric rows: ${finalSpeedRows.length} (after dedup from ${speedMetricRows.length})`)

    // Delete old data, then insert fresh
    const { error: delError } = await supabase
      .from('speed_metrics')
      .delete()
      .eq('source_type', 'artificial_analysis')
    if (delError) {
      console.warn(`  speed_metrics delete error: ${delError.message}`)
    } else {
      console.log(`  Cleared old artificial_analysis speed_metrics`)
    }

    let insertedCount = 0
    for (let i = 0; i < finalSpeedRows.length; i += 100) {
      const batch = finalSpeedRows.slice(i, i + 100)
      const { error } = await supabase.from('speed_metrics').insert(batch)
      if (error) {
        console.warn(`  speed_metrics batch error: ${error.message}`)
      } else {
        insertedCount += batch.length
      }
    }
    console.log(`  Inserted ${insertedCount} speed metric rows`)
  }

  // --- Update data source status ---
  await supabase.from('data_sources').upsert(
    {
      key: 'aa_speed',
      name: 'Artificial Analysis (Speed)',
      url: AA_MODELS_URL,
      status: 'active',
      last_status: 'success',
      last_fetched_at: new Date().toISOString(),
      last_error: null,
      consecutive_failures: 0,
    },
    { onConflict: 'key' }
  )

  const speedCount = speedMetricRows.length > 0
    ? Array.from(new Map(speedMetricRows.map(r => [`${r.model_id}:${r.provider}:${r.route_provider ?? ''}:${r.metric_percentile}:${r.source_type}`, r])).values()).length
    : 0
  console.log(
    `AA Speed: ${finalStagingRows.length} staging + ${speedCount} speed_metrics (${withSpeed} models)`
  )
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('AA Speed fetch failed:', message)

  supabase
    .from('data_sources')
    .upsert(
      {
        key: 'aa_speed',
        name: 'Artificial Analysis (Speed)',
        url: AA_MODELS_URL,
        last_status: 'failed',
        last_error: message,
      },
      { onConflict: 'key' }
    )
    .then(() => {
      process.exit(1)
    })
})
