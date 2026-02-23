import { fetchModelWithScores, fetchCategories, fetchProviders } from "@/lib/data"
import HomeClient from "./HomeClient"

export default async function Home() {
  const [models, categories, providers] = await Promise.all([
    fetchModelWithScores(),
    fetchCategories(),
    fetchProviders(),
  ])

  return (
    <HomeClient
      models={models}
      categories={categories}
      providers={providers}
    />
  )
}
