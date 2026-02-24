import { createClient } from '@supabase/supabase-js'
import { buildMatchContext, resolveModelSlug } from '../../lib/model-matching'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// AA evaluation pages to fetch — each page returns a DIFFERENT subset of models.
// We must fetch ALL pages and merge by slug to get maximum coverage.
// Removed: critpt, scicode, livecodebench, simplebench (deprecated)
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

// AA benchmark field name → our benchmark key + score scale
// AA scores are fractions (0-1) for most fields, so scale=100 converts to percentage
// Removed: critpt, scicode, lcr, livecodebench, simplebench — deprecated benchmarks
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

interface AADataPoint {
  slug?: string
  name?: string
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

// Model matching now uses unified lib/model-matching.ts

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
    console.log(`  ${page}: ${data.length} models`)
    return data
  } catch (err) {
    console.warn(`  ${page}: fetch failed - ${err instanceof Error ? err.message : err}`)
    return []
  }
}

async function main() {
  console.log('Fetching Artificial Analysis benchmark data from all evaluation pages...')

  // Fetch all evaluation pages and merge models by slug
  const mergedModels = new Map<string, AADataPoint>()

  for (const page of AA_EVAL_PAGES) {
    const entries = await fetchEvalPage(page)
    for (const entry of entries) {
      if (!entry.slug) continue
      const existing = mergedModels.get(entry.slug)
      if (existing) {
        // Merge: fill in non-null values from this page
        for (const [key, value] of Object.entries(entry)) {
          if (value != null && existing[key] == null) {
            existing[key] = value
          }
        }
      } else {
        mergedModels.set(entry.slug, { ...entry })
      }
    }
  }

  console.log(`  Merged: ${mergedModels.size} unique models across all pages`)

  const ctx = await buildMatchContext(supabase, 'artificial_analysis')
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
  const unmappedSlugs = new Set<string>()
  const resolvedSlugs = new Map<string, string>()

  mergedModels.forEach((entry, aaSlug) => {
    const slug = resolveModelSlug(aaSlug, ctx)
    if (!slug) {
      unmapped++
      unmappedSlugs.add(aaSlug)
      return
    }

    resolvedSlugs.set(aaSlug, slug)

    for (const [aaKey, bmConfig] of Object.entries(AA_BENCHMARK_MAP)) {
      const rawValue = entry[aaKey]
      if (rawValue == null) continue

      const score = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue))
      if (isNaN(score)) continue

      const normalizedScore = Math.round(score * bmConfig.scale * 100) / 100

      mapped++
      stagingRows.push({
        source_key: 'artificial_analysis',
        model_name: slug,
        benchmark_key: bmConfig.key,
        raw_score: normalizedScore,
        status: 'pending',
      })
    }
  })

  console.log(`  Mapped: ${mapped} scores from ${resolvedSlugs.size} models, Unmapped: ${unmapped} models`)
  if (unmappedSlugs.size > 0) {
    console.log(`  Unmapped AA slugs: ${Array.from(unmappedSlugs).slice(0, 30).join(', ')}${unmappedSlugs.size > 30 ? ` ... (+${unmappedSlugs.size - 30} more)` : ''}`)
  }

  if (stagingRows.length === 0) {
    console.log('  No benchmark scores to insert.')
    return
  }

  // Deduplicate: if multiple AA entries (base + variant) map to the same model slug,
  // keep only one score per (model, benchmark) — prefer the first one seen
  const deduped = new Map<string, typeof stagingRows[0]>()
  for (const row of stagingRows) {
    const key = `${row.model_name}:${row.benchmark_key}`
    if (!deduped.has(key)) {
      deduped.set(key, row)
    }
  }
  const finalRows = Array.from(deduped.values())
  console.log(`  After dedup: ${finalRows.length} unique (model, benchmark) scores`)

  // Insert in batches of 100
  for (let i = 0; i < finalRows.length; i += 100) {
    const batch = finalRows.slice(i, i + 100)
    const { error } = await supabase.from('staging_benchmarks').insert(batch)
    if (error) throw error
  }

  // Update data source status
  await supabase.from('data_sources').upsert({
    key: 'artificial_analysis',
    name: 'Artificial Analysis',
    url: AA_BASE_URL,
    status: 'active',
    last_status: 'success',
    last_fetched_at: new Date().toISOString(),
    last_error: null,
    consecutive_failures: 0,
  }, { onConflict: 'key' })

  console.log(`✅ Artificial Analysis: ${finalRows.length} benchmark scores fetched`)
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('❌ Artificial Analysis fetch failed:', message)

  supabase.from('data_sources').upsert({
    key: 'artificial_analysis',
    name: 'Artificial Analysis',
    url: AA_BASE_URL,
    last_status: 'failed',
    last_error: message,
  }, { onConflict: 'key' }).then(() => {
    process.exit(1)
  })
})
