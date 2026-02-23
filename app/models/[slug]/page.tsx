import { notFound } from "next/navigation"
import { fetchModelBySlug, fetchCategories, fetchProviders, fetchSources } from "@/lib/data"
import ModelDetailClient from "./ModelDetailClient"

export const revalidate = 3600

interface Props {
  params: Promise<{ slug: string }>
}

export default async function ModelDetailPage({ params }: Props) {
  const { slug } = await params
  const [model, categories, providers, sources] = await Promise.all([
    fetchModelBySlug(slug),
    fetchCategories(),
    fetchProviders(),
    fetchSources(),
  ])

  if (!model) {
    notFound()
  }

  return (
    <ModelDetailClient
      model={model}
      categories={categories}
      providers={providers}
      sources={sources}
    />
  )
}
