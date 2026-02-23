import { supabase } from "./supabase"
import seedData from "@/data/seed.json"
import categoriesData from "@/data/categories.json"
import sourcesData from "@/data/sources.json"
import { normalizeByMaxScore, categoryScore, compositeScore } from "./normalize"
import type {
  SeedData,
  Categories,
  Model,
  ModelWithScores,
  Provider,
  Sources,
} from "./types"

// JSON fallback data
const seed = seedData as SeedData
const categories = categoriesData as Categories
const sources = sourcesData as Sources

// ─── Supabase async data fetchers ──────────────────────────────

export async function fetchProviders(): Promise<Provider[]> {
  try {
    const { data, error } = await supabase
      .from("providers")
      .select("name, slug, color")
      .order("name")
    if (error || !data) throw error
    return data
  } catch {
    return seed.providers
  }
}

export async function fetchModels(): Promise<Model[]> {
  try {
    const { data: models, error: modelsErr } = await supabase
      .from("models")
      .select(`
        name, slug, provider_id, context_window_input, context_window_output,
        is_open_source, is_reasoning_model, release_date, tags,
        providers!inner(slug)
      `)
      .eq("status", "active")
      .order("name")
    if (modelsErr || !models) throw modelsErr

    const { data: scores, error: scoresErr } = await supabase
      .from("benchmark_scores")
      .select("model_id, benchmark_key, raw_score")
    if (scoresErr || !scores) throw scoresErr

    const { data: prices, error: pricesErr } = await supabase
      .from("prices")
      .select("model_id, input_price_per_1m, output_price_per_1m, confirmed")
      .order("recorded_at", { ascending: false })
    if (pricesErr || !prices) throw pricesErr

    // Build model_id → slug mapping
    const { data: modelIds } = await supabase
      .from("models")
      .select("id, slug")
    const idToSlug = new Map((modelIds ?? []).map((m) => [m.id, m.slug]))
    const slugToId = new Map((modelIds ?? []).map((m) => [m.slug, m.id]))

    // Group scores by model_id
    const scoresByModel = new Map<string, Record<string, number>>()
    for (const s of scores) {
      const slug = idToSlug.get(s.model_id)
      if (!slug) continue
      if (!scoresByModel.has(slug)) scoresByModel.set(slug, {})
      scoresByModel.get(slug)![s.benchmark_key] = Number(s.raw_score)
    }

    // Get latest price per model
    const priceByModel = new Map<string, { input_price_per_1m: number; output_price_per_1m: number; confirmed: boolean }>()
    for (const p of prices) {
      const slug = idToSlug.get(p.model_id)
      if (!slug || priceByModel.has(slug)) continue // keep first (latest)
      priceByModel.set(slug, {
        input_price_per_1m: Number(p.input_price_per_1m),
        output_price_per_1m: Number(p.output_price_per_1m),
        confirmed: p.confirmed,
      })
    }

    return models.map((m) => {
      // Supabase join returns object for !inner, array for regular
      const prov = m.providers as unknown
      const providerSlug = Array.isArray(prov)
        ? (prov[0] as { slug: string })?.slug ?? ""
        : (prov as { slug: string })?.slug ?? ""
      const slug = m.slug
      const price = priceByModel.get(slug)
      return {
        name: m.name,
        slug: m.slug,
        provider: providerSlug,
        context_window_input: m.context_window_input ?? 0,
        context_window_output: m.context_window_output ?? 0,
        is_open_source: m.is_open_source ?? false,
        is_reasoning_model: m.is_reasoning_model ?? false,
        release_date: m.release_date ?? "",
        tags: m.tags ?? [],
        pricing: {
          input_per_1m: price?.input_price_per_1m ?? 0,
          output_per_1m: price?.output_price_per_1m ?? 0,
          confirmed: price?.confirmed ?? false,
        },
        benchmarks: scoresByModel.get(slug) ?? {},
      }
    })
  } catch {
    return seed.models
  }
}

export async function fetchCategories(): Promise<Categories> {
  try {
    const { data, error } = await supabase
      .from("benchmark_definitions")
      .select("key, label, category, unit, higher_is_better, max_possible_score, weight, display_order")
      .order("display_order")
    if (error || !data || data.length === 0) throw error

    const cats: Categories = {}
    for (const row of data) {
      if (!cats[row.category]) {
        cats[row.category] = {
          label: getCategoryLabel(row.category),
          benchmarks: [],
        }
      }
      cats[row.category].benchmarks.push({
        key: row.key,
        label: row.label,
        weight: Number(row.weight),
        unit: row.unit ?? "%",
        higher_is_better: row.higher_is_better ?? true,
        max_score: row.max_possible_score ? Number(row.max_possible_score) : null,
      })
    }
    return cats
  } catch {
    return categories
  }
}

function getCategoryLabel(key: string): string {
  const labels: Record<string, string> = {
    reasoning: "推理 Reasoning",
    coding: "代码 Coding",
    math: "数学 Math",
    chat: "对话 Chat",
    agentic: "Agent",
  }
  return labels[key] ?? key
}

export async function fetchSources(): Promise<Sources> {
  return sources
}

export async function fetchModelWithScores(models?: Model[]): Promise<ModelWithScores[]> {
  const allModels = models ?? (await fetchModels())
  const cats = await fetchCategories()
  const providers = await fetchProviders()

  // For each category+benchmark, collect all model values for normalization
  const allValuesPerBenchmark: Record<string, number[]> = {}
  for (const catKey of Object.keys(cats)) {
    for (const bm of cats[catKey].benchmarks) {
      allValuesPerBenchmark[bm.key] = allModels
        .map((m) => m.benchmarks[bm.key])
        .filter((v): v is number => v != null)
    }
  }

  return allModels.map((model) => {
    const normalizedScores: Record<string, number | null> = {}
    for (const catKey of Object.keys(cats)) {
      for (const bm of cats[catKey].benchmarks) {
        const raw = model.benchmarks[bm.key]
        if (raw != null) {
          normalizedScores[bm.key] = normalizeByMaxScore(
            raw,
            bm.max_score,
            allValuesPerBenchmark[bm.key],
            bm.higher_is_better
          )
        } else {
          normalizedScores[bm.key] = null
        }
      }
    }

    const catScores: Record<string, ReturnType<typeof categoryScore>> = {}
    for (const catKey of Object.keys(cats)) {
      catScores[catKey] = categoryScore(
        cats[catKey].benchmarks,
        normalizedScores
      )
    }

    const provider = providers.find((p) => p.slug === model.provider)

    const score = compositeScore(catScores)
    return {
      ...model,
      categoryScores: catScores,
      compositeScore: score,
      radarIdx: score,
      providerColor: provider?.color ?? "#888888",
    }
  })
}

export async function fetchModelBySlug(slug: string): Promise<ModelWithScores | undefined> {
  const all = await fetchModelWithScores()
  return all.find((m) => m.slug === slug)
}

export async function fetchAllSlugs(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("models")
      .select("slug")
      .eq("status", "active")
    if (error || !data) throw error
    return data.map((m) => m.slug)
  } catch {
    return seed.models.map((m) => m.slug)
  }
}

// ─── Sync versions (JSON fallback, kept for backward compat) ───

export function getProviders(): Provider[] {
  return seed.providers
}

export function getModels(): Model[] {
  return seed.models
}

export function getCategories(): Categories {
  return categories
}

export function getSources(): Sources {
  return sources
}

export function getModelWithScores(models?: Model[]): ModelWithScores[] {
  const allModels = models ?? seed.models
  const cats = categories

  const allValuesPerBenchmark: Record<string, number[]> = {}
  for (const catKey of Object.keys(cats)) {
    for (const bm of cats[catKey].benchmarks) {
      allValuesPerBenchmark[bm.key] = allModels
        .map((m) => m.benchmarks[bm.key])
        .filter((v): v is number => v != null)
    }
  }

  return allModels.map((model) => {
    const normalizedScores: Record<string, number | null> = {}
    for (const catKey of Object.keys(cats)) {
      for (const bm of cats[catKey].benchmarks) {
        const raw = model.benchmarks[bm.key]
        if (raw != null) {
          normalizedScores[bm.key] = normalizeByMaxScore(
            raw,
            bm.max_score,
            allValuesPerBenchmark[bm.key],
            bm.higher_is_better
          )
        } else {
          normalizedScores[bm.key] = null
        }
      }
    }

    const catScores: Record<string, ReturnType<typeof categoryScore>> = {}
    for (const catKey of Object.keys(cats)) {
      catScores[catKey] = categoryScore(
        cats[catKey].benchmarks,
        normalizedScores
      )
    }

    const provider = seed.providers.find((p) => p.slug === model.provider)

    const score = compositeScore(catScores)
    return {
      ...model,
      categoryScores: catScores,
      compositeScore: score,
      radarIdx: score,
      providerColor: provider?.color ?? "#888888",
    }
  })
}

export function getModelBySlug(slug: string): ModelWithScores | undefined {
  const all = getModelWithScores()
  return all.find((m) => m.slug === slug)
}

export function getAllSlugs(): string[] {
  return seed.models.map((m) => m.slug)
}

// Pareto frontier
export function getParetoFrontier(models: ModelWithScores[]): string[] {
  const priced = models.filter(
    (m) => m.pricing.input_per_1m > 0 && m.pricing.output_per_1m > 0
  )

  const paretoSlugs: string[] = []

  for (const m of priced) {
    const avgPrice =
      (m.pricing.input_per_1m + m.pricing.output_per_1m) / 2
    const isDominated = priced.some((other) => {
      if (other.slug === m.slug) return false
      const otherAvg =
        (other.pricing.input_per_1m + other.pricing.output_per_1m) / 2
      return otherAvg <= avgPrice && other.compositeScore >= m.compositeScore &&
        (otherAvg < avgPrice || other.compositeScore > m.compositeScore)
    })

    if (!isDominated) {
      paretoSlugs.push(m.slug)
    }
  }

  return paretoSlugs
}
