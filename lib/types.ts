export interface Source {
  name: string
  url: string
}

export type Sources = Record<string, Source>

export interface Provider {
  name: string
  slug: string
  color: string
}

export interface ModelPricing {
  input_per_1m: number
  output_per_1m: number
  confirmed: boolean
  source?: string
}

export interface Model {
  name: string
  slug: string
  provider: string
  context_window_input: number
  context_window_output: number
  is_open_source: boolean
  is_reasoning_model: boolean
  release_date: string
  tags: string[]
  pricing: ModelPricing
  benchmarks: Record<string, number>
}

export interface BenchmarkDef {
  key: string
  label: string
  weight: number
  unit: string
  higher_is_better: boolean
  max_score: number | null
  source?: string
}

export interface CategoryDef {
  label: string
  icon?: string
  benchmarks: BenchmarkDef[]
}

export type Categories = Record<string, CategoryDef>

export interface CategoryResult {
  score: number
  coverage: number
  isReliable: boolean
  benchmarkCount: number
  availableCount: number
}

export interface ModelWithScores extends Model {
  categoryScores: Record<string, CategoryResult>
  compositeScore: number
  providerColor: string
}

export interface SeedData {
  providers: Provider[]
  models: Model[]
}
