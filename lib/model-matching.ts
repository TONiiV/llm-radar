import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Unified model name matching module.
 * Replaces hardcoded AA_MODEL_MAP, MODEL_NAME_MAP, LMARENA_MODEL_MAP
 * with a single resolveModelSlug() function.
 *
 * Matching priority:
 * 1. DB model_name_mappings exact match (source-specific)
 * 2. DB models.slug exact match
 * 3. Normalized match (both sides normalize then compare)
 * 4. Token-based fuzzy match (Jaccard > 0.7)
 */

// Variant suffixes to strip during normalization (order matters: longer/compound first)
const VARIANT_SUFFIXES = [
  // Compound suffixes (must come before their base forms)
  '-thinking-16k', '-thinking-32k', '-thinking-64k', '-thinking-128k',
  '-non-reasoning',
  // Behavior variants
  '-adaptive', '-reasoning', '-thinking',
  '-so-true', '-so-false',
  // Effort levels
  '-low', '-medium', '-high', '-xhigh',
  // Release variants
  '-instruct', '-preview', '-experimental', '-exp',
  '-beta', '-old', '-latest', '-free',
]

// Provider prefixes to strip
const PROVIDER_PREFIXES = [
  'anthropic/', 'openai/', 'google/', 'meta-llama/', 'mistralai/',
  'deepseek/', 'x-ai/', 'qwen/', 'nvidia/', 'cohere/',
  'moonshot/', 'zhipu/', 'minimax/',
]

/**
 * Normalize a model name for comparison.
 * - lowercase
 * - remove parenthetical content: (extra high), (Nov 2024)
 * - unify version separators: 4.6 = 46 = 4-6
 * - strip variant suffixes
 * - strip provider prefixes
 * - remove extra punctuation and whitespace
 */
export function normalizeName(name: string): string {
  let s = name.toLowerCase().trim()

  // Remove provider prefixes
  for (const prefix of PROVIDER_PREFIXES) {
    if (s.startsWith(prefix)) {
      s = s.slice(prefix.length)
      break
    }
  }

  // Remove parenthetical content
  s = s.replace(/\([^)]*\)/g, '')

  // Strip variant suffixes (may match multiple rounds, e.g. "-instruct" then "-preview")
  let changed = true
  while (changed) {
    changed = false
    for (const suffix of VARIANT_SUFFIXES) {
      if (s.endsWith(suffix)) {
        s = s.slice(0, -suffix.length)
        changed = true
        break
      }
    }
  }

  // Remove date suffixes: -20251101, -2025-12-11
  s = s.replace(/-\d{8,}$/g, '')
  s = s.replace(/-\d{4}-\d{2}-\d{2}$/g, '')

  // Remove short date-like suffixes at end: -02-24, -12-17 (month-day after preview/etc stripped)
  s = s.replace(/-\d{2}-\d{2}$/g, '')

  // Remove parameter suffixes like -17b-128e, -7b, -405b, -70b, etc.
  // Matches: -<digits><b/e/m/k> patterns (model size params)
  s = s.replace(/(-\d+[bemk])+(-\d+[bemk])*/gi, '')

  // Unify version separators: dots and hyphens between digits → nothing
  // "4.6" → "46", "4-6" → "46", "3.5" → "35"
  s = s.replace(/(\d)[.\-](\d)/g, '$1$2')

  // Remove remaining non-alphanumeric (except spaces)
  s = s.replace(/[^a-z0-9 ]/g, ' ')

  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim()

  return s
}

/**
 * Tokenize a normalized name for Jaccard similarity.
 * "claude opus 46" → Set{"claude", "opus", "46"}
 */
export function tokenize(name: string): Set<string> {
  const normalized = normalizeName(name)
  return new Set(normalized.split(' ').filter(Boolean))
}

/**
 * Jaccard similarity between two token sets.
 */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let intersection = 0
  a.forEach((token) => {
    if (b.has(token)) intersection++
  })
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

const JACCARD_THRESHOLD = 0.7

export interface MatchContext {
  dbMappings: Map<string, string>  // source_name → model_slug
  dbSlugs: Set<string>            // all model slugs in DB
  normalizedDbSlugs: Map<string, string> // normalizeName(slug) → slug
}

/**
 * Resolve an external model name to our internal model slug.
 *
 * @param externalName - The model name from external source (AA slug, Epoch name, etc.)
 * @param ctx - Preloaded match context
 * @returns Our model slug, or null if no match
 */
export function resolveModelSlug(
  externalName: string,
  ctx: MatchContext,
): string | null {
  // 1. DB mappings exact match
  const dbSlug = ctx.dbMappings.get(externalName)
  if (dbSlug) return dbSlug

  // 2. DB slugs exact match
  if (ctx.dbSlugs.has(externalName)) return externalName

  // 3. Normalized match
  const normalized = normalizeName(externalName)
  const normMatch = ctx.normalizedDbSlugs.get(normalized)
  if (normMatch) return normMatch

  // 4. Token-based fuzzy match (Jaccard > threshold)
  const tokens = tokenize(externalName)
  let bestMatch: string | null = null
  let bestScore = 0

  ctx.normalizedDbSlugs.forEach((slug) => {
    const slugTokens = tokenize(slug)
    const score = jaccardSimilarity(tokens, slugTokens)
    if (score > bestScore && score >= JACCARD_THRESHOLD) {
      bestScore = score
      bestMatch = slug
    }
  })

  return bestMatch
}

/**
 * Build a MatchContext by loading data from Supabase.
 *
 * @param supabase - Supabase client
 * @param sourceKey - The source key to filter mappings (e.g., 'artificial_analysis', 'epoch_ai')
 */
export async function buildMatchContext(
  supabase: SupabaseClient,
  sourceKey: string,
): Promise<MatchContext> {
  // Load source-specific mappings
  const dbMappings = new Map<string, string>()
  try {
    // Load mappings with model slug via join
    const { data, error } = await supabase
      .from('model_name_mappings')
      .select('external_name, model_id, models!inner(slug)')
      .eq('source_key', sourceKey)
    if (!error && data) {
      for (const r of data) {
        const slug = (r as any).models?.slug
        if (slug) dbMappings.set(r.external_name, slug)
      }
    }
  } catch { /* ignore */ }

  // Load all model slugs
  const dbSlugs = new Set<string>()
  const normalizedDbSlugs = new Map<string, string>()
  try {
    const { data, error } = await supabase
      .from('models')
      .select('slug')
    if (!error && data) {
      for (const m of data) {
        dbSlugs.add(m.slug)
        normalizedDbSlugs.set(normalizeName(m.slug), m.slug)
      }
    }
  } catch { /* ignore */ }

  return { dbMappings, dbSlugs, normalizedDbSlugs }
}

/**
 * Build a MatchContext for pricing sources (OpenRouter, LiteLLM).
 * These need mappings from ALL sources, not just one.
 */
export async function buildPricingMatchContext(
  supabase: SupabaseClient,
): Promise<MatchContext> {
  const dbMappings = new Map<string, string>()
  try {
    const { data, error } = await supabase
      .from('model_name_mappings')
      .select('external_name, model_id, models!inner(slug)')
    if (!error && data) {
      for (const r of data) {
        const slug = (r as any).models?.slug
        if (slug) dbMappings.set(r.external_name, slug)
      }
    }
  } catch { /* ignore */ }

  const dbSlugs = new Set<string>()
  const normalizedDbSlugs = new Map<string, string>()
  try {
    const { data, error } = await supabase
      .from('models')
      .select('slug')
    if (!error && data) {
      for (const m of data) {
        dbSlugs.add(m.slug)
        normalizedDbSlugs.set(normalizeName(m.slug), m.slug)
      }
    }
  } catch { /* ignore */ }

  return { dbMappings, dbSlugs, normalizedDbSlugs }
}
