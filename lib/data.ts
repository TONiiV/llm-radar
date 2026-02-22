import seedData from "@/data/seed.json"
import categoriesData from "@/data/categories.json"
import { normalize, categoryScore, compositeScore } from "./normalize"
import type {
  SeedData,
  Categories,
  Model,
  ModelWithScores,
  Provider,
} from "./types"

const seed = seedData as SeedData
const categories = categoriesData as Categories

export function getProviders(): Provider[] {
  return seed.providers
}

export function getModels(): Model[] {
  return seed.models
}

export function getCategories(): Categories {
  return categories
}

export function getModelWithScores(models?: Model[]): ModelWithScores[] {
  const allModels = models ?? seed.models
  const cats = categories

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
    // Normalize each benchmark score
    const normalizedScores: Record<string, number | null> = {}
    for (const catKey of Object.keys(cats)) {
      for (const bm of cats[catKey].benchmarks) {
        const raw = model.benchmarks[bm.key]
        if (raw != null) {
          normalizedScores[bm.key] = normalize(
            raw,
            allValuesPerBenchmark[bm.key],
            bm.higher_is_better
          )
        } else {
          normalizedScores[bm.key] = null
        }
      }
    }

    // Calculate category scores
    const catScores: Record<string, ReturnType<typeof categoryScore>> = {}
    for (const catKey of Object.keys(cats)) {
      catScores[catKey] = categoryScore(
        cats[catKey].benchmarks,
        normalizedScores
      )
    }

    const provider = seed.providers.find((p) => p.slug === model.provider)

    return {
      ...model,
      categoryScores: catScores,
      compositeScore: compositeScore(catScores),
      providerColor: provider?.color ?? "#888888",
    }
  })
}

// Pareto frontier: models where no other model is both cheaper and better
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
