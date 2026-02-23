import { fetchModelWithScores, fetchCategories, fetchProviders } from "@/lib/data"
import ModelsClient from "./ModelsClient"

export const revalidate = 3600

export default async function ModelsPage() {
  const [models, categories, providers] = await Promise.all([
    fetchModelWithScores(),
    fetchCategories(),
    fetchProviders(),
  ])

  return (
    <ModelsClient
      models={models}
      categories={categories}
      providers={providers}
    />
  )
}
