import { createClient } from '@supabase/supabase-js'
import { buildMatchContext, resolveModelSlug } from '../../lib/model-matching'

/**
 * Fetch speed metrics (output_tps, ttft_ms) from Artificial Analysis.
 *
 * AA's evaluation pages embed `timescaleData` in the RSC defaultData payload,
 * which includes:
 *   - median_output_speed: tokens per second
 *   - median_time_to_first_chunk: seconds (we convert to ms)
 *
 * This script does NOT require an AA_API_KEY — it uses the same RSC scraping
 * approach as fetch-artificial-analysis.ts.
 *
 * We fetch multiple eval pages and merge by slug to maximize model coverage,
 * since different pages may list different subsets of models.
 */

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Eval pages to fetch — same as fetch-artificial-analysis.ts.
// Each page returns timescaleData for the models it lists.
// We merge across all pages for maximum coverage.
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

const AA_BASE_URL = 'https://artificialanalysis.ai/evaluations'
const SOURCE_KEY = 'artificial_analysis'

interface TimescaleData {
  median_output_speed?: number
  median_time_to_first_chunk?: number
  percentile_05_output_speed?: number
  percentile_95_output_speed?: number
  percentile_05_time_to_first_chunk?: number
  percentile_95_time_to_first_chunk?: number
  [key: string]: unknown
}

interface AADataPoint {
  slug?: string
  name?: string
  timescaleData?: TimescaleData
  [key: string]: unknown
}

function extractDefaultData(rscText: string): AADataPoint[] {
  const marker = '"defaultData":'
  const idx = rscText.indexOf(marker)
  if (idx === -1) return []

  const arrayStart = rscText.indexOf('[', idx + marker.length)
  if (arrayStart === -1) return []

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

  if (arrayEnd === -1) return []
  const jsonStr = rscText.slice(arrayStart, arrayEnd)
  return JSON.parse(jsonStr) as AADataPoint[]
}

async function fetchEvalPage(page: string): Promise<AADataPoint[]> {
  const url = `${AA_BASE_URL}/${page}`
  try {
    const res = await fetch(url, {
      headers: {
        'RSC': '1',
        'Next-Router-State-Tree': encodeURIComponent(JSON.stringify([''])),
        'User-Agent': 'Mozilla/5.0 (compatible; LLMRadar/1.0)',
      },
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) {
      console.warn(`  ${page}: HTTP ${res.status}`)
      return []
    }
    const rscText = await res.text()
    const data = extractDefaultData(rscText)
    const withSpeed = data.filter(
      (m) =>
        m.timescaleData &&
        ((m.timescaleData.median_output_speed ?? 0) > 0 ||
          (m.timescaleData.median_time_to_first_chunk ?? 0) > 0)
    )
    console.log(`  ${page}: ${data.length} models, ${withSpeed.length} with speed data`)
    return data
  } catch (err) {
    console.warn(`  ${page}: fetch failed - ${err instanceof Error ? err.message : err}`)
    return []
  }
}

async function main() {
  console.log('Fetching AA speed metrics (output_tps, ttft_ms) via RSC scraping...')

  // Fetch all evaluation pages and merge models by slug
  const mergedModels = new Map<string, AADataPoint>()

  for (const page of AA_EVAL_PAGES) {
    const entries = await fetchEvalPage(page)
    for (const entry of entries) {
      if (!entry.slug) continue
      const existing = mergedModels.get(entry.slug)
      if (existing) {
        // Merge timescaleData: prefer non-null/non-zero values
        if (entry.timescaleData && !existing.timescaleData) {
          existing.timescaleData = entry.timescaleData
        } else if (entry.timescaleData && existing.timescaleData) {
          // Fill in missing speed fields
          const existingTs = existing.timescaleData
          const newTs = entry.timescaleData
          if (
            (!existingTs.median_output_speed || existingTs.median_output_speed === 0) &&
            newTs.median_output_speed && newTs.median_output_speed > 0
          ) {
            existingTs.median_output_speed = newTs.median_output_speed
          }
          if (
            (!existingTs.median_time_to_first_chunk || existingTs.median_time_to_first_chunk === 0) &&
            newTs.median_time_to_first_chunk && newTs.median_time_to_first_chunk > 0
          ) {
            existingTs.median_time_to_first_chunk = newTs.median_time_to_first_chunk
          }
        }
      } else {
        mergedModels.set(entry.slug, { ...entry })
      }
    }
  }

  console.log(`  Merged: ${mergedModels.size} unique models across all pages`)

  const ctx = await buildMatchContext(supabase, SOURCE_KEY)
  console.log(`  Match context: ${ctx.dbMappings.size} DB mappings, ${ctx.dbSlugs.size} model slugs`)

  const stagingRows: {
    source_key: string
    model_name: string
    benchmark_key: string
    raw_score: number
    status: string
  }[] = []

  let mapped = 0
  let unmapped = 0
  let withSpeed = 0
  const unmappedSlugs = new Set<string>()

  mergedModels.forEach((entry, aaSlug) => {
    const slug = resolveModelSlug(aaSlug, ctx)
    if (!slug) {
      unmapped++
      unmappedSlugs.add(aaSlug)
      return
    }

    const ts = entry.timescaleData
    if (!ts) return

    const tps = ts.median_output_speed
    const ttftSec = ts.median_time_to_first_chunk

    // output_tps: tokens per second (already in correct unit)
    if (tps != null && tps > 0) {
      stagingRows.push({
        source_key: SOURCE_KEY,
        model_name: slug,
        benchmark_key: 'output_tps',
        raw_score: Math.round(tps * 100) / 100,
        status: 'pending',
      })
      mapped++
    }

    // ttft_ms: convert from seconds to milliseconds
    if (ttftSec != null && ttftSec > 0) {
      const ttftMs = ttftSec * 1000
      stagingRows.push({
        source_key: SOURCE_KEY,
        model_name: slug,
        benchmark_key: 'ttft_ms',
        raw_score: Math.round(ttftMs * 100) / 100,
        status: 'pending',
      })
      // Count models that have at least one speed metric
      if (!(tps != null && tps > 0)) mapped++
    }

    if ((tps != null && tps > 0) || (ttftSec != null && ttftSec > 0)) {
      withSpeed++
    }
  })

  console.log(`  Models with speed data: ${withSpeed}, Unmapped: ${unmapped}`)
  if (unmappedSlugs.size > 0) {
    console.log(
      `  Unmapped AA slugs: ${Array.from(unmappedSlugs).slice(0, 20).join(', ')}${
        unmappedSlugs.size > 20 ? ` ... (+${unmappedSlugs.size - 20} more)` : ''
      }`
    )
  }

  if (stagingRows.length === 0) {
    console.log('  No speed scores to insert.')
    return
  }

  // Deduplicate: keep one score per (model, benchmark)
  const deduped = new Map<string, (typeof stagingRows)[0]>()
  for (const row of stagingRows) {
    const key = `${row.model_name}:${row.benchmark_key}`
    if (!deduped.has(key)) {
      deduped.set(key, row)
    }
  }
  const finalRows = Array.from(deduped.values())
  console.log(`  After dedup: ${finalRows.length} unique (model, benchmark_key) scores`)

  // Insert in batches of 100
  for (let i = 0; i < finalRows.length; i += 100) {
    const batch = finalRows.slice(i, i + 100)
    const { error } = await supabase.from('staging_benchmarks').insert(batch)
    if (error) throw error
  }

  // Update data source status
  await supabase.from('data_sources').upsert(
    {
      key: 'aa_speed',
      name: 'Artificial Analysis (Speed)',
      url: AA_BASE_URL,
      status: 'active',
      last_status: 'success',
      last_fetched_at: new Date().toISOString(),
      last_error: null,
      consecutive_failures: 0,
    },
    { onConflict: 'key' }
  )

  console.log(`AA Speed: ${finalRows.length} speed scores fetched (${withSpeed} models)`)
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
        url: AA_BASE_URL,
        last_status: 'failed',
        last_error: message,
      },
      { onConflict: 'key' }
    )
    .then(() => {
      process.exit(1)
    })
})
