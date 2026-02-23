import type { Metadata } from "next"
import { fetchModelBySlug, fetchAllSlugs } from "@/lib/data"

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const model = await fetchModelBySlug(slug)

  if (!model) {
    return { title: "Model Not Found | LLMRadar" }
  }

  const title = `${model.name}`
  const description = `${model.name} capability scores and benchmark results. Composite score: ${Math.round(model.compositeScore)}/100. Input: $${model.pricing.input_per_1m}/1M, Output: $${model.pricing.output_per_1m}/1M tokens.`

  return {
    title,
    description,
    openGraph: {
      title: `${model.name} | LLMRadar`,
      description,
    },
  }
}

export async function generateStaticParams() {
  const slugs = await fetchAllSlugs()
  return slugs.map((slug) => ({ slug }))
}

export default function ModelDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
