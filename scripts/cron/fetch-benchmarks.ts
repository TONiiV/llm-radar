import { createClient } from '@supabase/supabase-js'
import { buildMatchContext, resolveModelSlug } from '../../lib/model-matching'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// ─── Data Sources ────────────────────────────────────────────────────────────
// Primary: arena.ai SSR leaderboard page (text category, ~314 models with ELO)
// The page server-renders a full HTML table with rank, model name, score, votes.
const ARENA_LEADERBOARD_URL = 'https://arena.ai/leaderboard/text'

// Fallback: lmarena/arena-catalog GitHub repo JSON files
// These contain category-specific scores (coding, chinese, creative_writing)
// but NOT overall scores. We take the max across categories as a proxy.
const ARENA_CATALOG_BASE = 'https://raw.githubusercontent.com/lmarena/arena-catalog/main/data'
const ARENA_CATALOG_FILES = [
  'leaderboard-text.json',
  'leaderboard-text-style-control.json',
]

// ─── HTML Table Parser ───────────────────────────────────────────────────────
/**
 * Parse ELO scores from arena.ai SSR HTML table.
 *
 * Table row structure (confirmed from arena.ai/leaderboard/text):
 *   <tr class="hover:bg-surface...">
 *     <td>...<span class="text-sm font-medium">{rank}</span></td>
 *     <td>...<a ... title="{model-name}">...</a></td>
 *     <td>...<span class="text-sm">{score}</span></td>
 *     <td>...<span class="text-sm">{votes}</span></td>
 *   </tr>
 */
function parseArenaHTML(html: string): { model: string; score: number }[] {
  const results: { model: string; score: number }[] = []

  // Match each table row
  const rowRegex = /<tr class="hover:bg-surface[\s\S]*?<\/tr>/g
  let rowMatch: RegExpExecArray | null

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const row = rowMatch[0]

    // Extract rank (to validate it's a data row)
    const rankMatch = row.match(/<span class="text-sm font-medium">(\d+)<\/span>/)
    if (!rankMatch) continue

    // Extract model name from <a> tag's title attribute
    const nameMatch = row.match(/<a[^>]*title="([^"]+)"/)
    if (!nameMatch) continue

    // Extract score and votes (text-sm spans without font-medium)
    const spanMatches = row.match(/<span class="text-sm">([^<]+)<\/span>/g)
    if (!spanMatches || spanMatches.length < 2) continue

    const scoreText = spanMatches[0].replace(/<[^>]+>/g, '').replace(/,/g, '')
    const score = parseInt(scoreText, 10)

    if (isNaN(score) || score <= 0) continue

    results.push({
      model: nameMatch[1],
      score,
    })
  }

  return results
}

// ─── GitHub JSON Fallback Parser ─────────────────────────────────────────────
/**
 * Parse arena-catalog JSON files.
 * Format: { "category": { "model-name": { rating, rating_q975, rating_q025 } } }
 * We collect all models across categories, keeping the highest rating per model.
 */
function parseCatalogJSON(
  data: Record<string, Record<string, { rating: number; rating_q975?: number; rating_q025?: number }>>
): { model: string; score: number }[] {
  const modelScores = new Map<string, number>()

  for (const category of Object.values(data)) {
    for (const [model, info] of Object.entries(category)) {
      if (typeof info?.rating !== 'number' || info.rating <= 0) continue
      const existing = modelScores.get(model) ?? 0
      if (info.rating > existing) {
        modelScores.set(model, Math.round(info.rating))
      }
    }
  }

  return Array.from(modelScores.entries()).map(([model, score]) => ({ model, score }))
}

// ─── Data Fetching ───────────────────────────────────────────────────────────
async function fetchFromArenaPage(): Promise<{ model: string; score: number }[]> {
  console.log('  [Source 1] Fetching arena.ai/leaderboard/text SSR page...')
  const res = await fetch(ARENA_LEADERBOARD_URL, {
    signal: AbortSignal.timeout(30000),
    headers: {
      'User-Agent': 'llm-radar-bot/1.0 (benchmark-data-collection)',
      'Accept': 'text/html',
    },
  })

  if (!res.ok) {
    throw new Error(`arena.ai returned ${res.status} ${res.statusText}`)
  }

  const html = await res.text()
  console.log(`  Page size: ${(html.length / 1024).toFixed(0)} KB`)

  const results = parseArenaHTML(html)
  if (results.length === 0) {
    throw new Error('No scores found in arena.ai HTML — page structure may have changed')
  }

  console.log(`  Parsed ${results.length} models from HTML table`)
  console.log(`  Score range: ${Math.min(...results.map(r => r.score))} - ${Math.max(...results.map(r => r.score))}`)
  return results
}

async function fetchFromCatalogRepo(): Promise<{ model: string; score: number }[]> {
  console.log('  [Source 2] Fetching from lmarena/arena-catalog GitHub...')
  const allResults: { model: string; score: number }[] = []

  for (const file of ARENA_CATALOG_FILES) {
    const url = `${ARENA_CATALOG_BASE}/${file}`
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
      if (!res.ok) {
        console.warn(`    ${file}: HTTP ${res.status}`)
        continue
      }
      const data = await res.json()
      const parsed = parseCatalogJSON(data as any)
      console.log(`    ${file}: ${parsed.length} models`)
      allResults.push(...parsed)
    } catch (err) {
      console.warn(`    ${file} failed:`, err instanceof Error ? err.message : String(err))
    }
  }

  if (allResults.length === 0) {
    throw new Error('All arena-catalog files failed or returned no data')
  }

  // Deduplicate: keep highest score per model
  const modelScores = new Map<string, number>()
  for (const { model, score } of allResults) {
    const existing = modelScores.get(model) ?? 0
    if (score > existing) modelScores.set(model, score)
  }

  const results = Array.from(modelScores.entries()).map(([model, score]) => ({ model, score }))
  console.log(`  Catalog total: ${results.length} unique models`)
  return results
}

async function fetchLMArenaELO(): Promise<{ model: string; score: number }[]> {
  // Try primary source: arena.ai SSR HTML
  try {
    const results = await fetchFromArenaPage()
    if (results.length >= 50) return results // expect 200+ models
    console.warn(`  Only ${results.length} models from HTML — trying fallback`)
  } catch (err) {
    console.warn('  arena.ai page failed:', err instanceof Error ? err.message : String(err))
  }

  // Fallback: arena-catalog GitHub repo
  try {
    return await fetchFromCatalogRepo()
  } catch (err) {
    console.warn('  arena-catalog failed:', err instanceof Error ? err.message : String(err))
  }

  throw new Error('All LMArena sources failed')
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Fetching LMArena ELO data...')

  try {
    const eloData = await fetchLMArenaELO()
    const ctx = await buildMatchContext(supabase, 'lmarena')
    console.log(`  Match context: ${ctx.dbMappings.size} DB mappings, ${ctx.dbSlugs.size} model slugs`)

    let mapped = 0
    let unmapped = 0
    const unmappedNames = new Set<string>()

    const rows: { source_key: string; model_name: string; benchmark_key: string; raw_score: number; status: string }[] = []
    for (const e of eloData) {
      const slug = resolveModelSlug(e.model, ctx)
      if (!slug) {
        unmapped++
        unmappedNames.add(e.model)
        continue
      }
      mapped++
      rows.push({
        source_key: 'lmarena',
        model_name: slug,
        benchmark_key: 'lmarena_elo',
        raw_score: e.score,
        status: 'pending',
      })
    }

    console.log(`  Mapped: ${mapped}, Unmapped: ${unmapped}`)
    if (unmappedNames.size > 0) {
      console.log(`  Unmapped LMArena names: ${Array.from(unmappedNames).slice(0, 30).join(', ')}${unmappedNames.size > 30 ? ` ... (+${unmappedNames.size - 30} more)` : ''}`)
    }

    // Insert in batches of 100
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100)
      const { error } = await supabase.from('staging_benchmarks').insert(batch)
      if (error) throw error
    }

    await supabase.from('data_sources').update({
      last_status: 'success',
      last_fetched_at: new Date().toISOString(),
      last_error: null,
      consecutive_failures: 0,
    }).eq('key', 'lmarena')

    console.log(`Done: LMArena ${rows.length} ELO scores staged (${mapped} matched, ${unmapped} unmatched)`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('LMArena fetch failed:', message)

    const { data } = await supabase
      .from('data_sources')
      .select('consecutive_failures')
      .eq('key', 'lmarena')
      .single()

    const failures = (data?.consecutive_failures ?? 0) + 1
    await supabase.from('data_sources').update({
      last_status: 'failed',
      last_error: message,
      consecutive_failures: failures,
      status: failures >= 7 ? 'disabled' : failures >= 3 ? 'failing' : 'active',
    }).eq('key', 'lmarena')

    // Don't exit(1) — partial failure is OK, keep going
    console.warn('LMArena data preserved from last successful fetch')
  }
}

main().catch((err) => {
  console.error('Benchmark fetch failed:', err.message)
  process.exit(1)
})
