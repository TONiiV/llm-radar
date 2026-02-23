import { fetchModelWithScores, fetchProviders, fetchCategories, fetchSources } from "@/lib/data"
import CompareClient from "./CompareClient"

export const revalidate = 3600

export default async function ComparePage() {
  const [allModels, providers, categories, sources] = await Promise.all([
    fetchModelWithScores(),
    fetchProviders(),
    fetchCategories(),
    fetchSources(),
  ])

  return (
    <CompareClient
      allModels={allModels}
      providers={providers}
      categories={categories}
      sources={sources}
    />
  )
}
