import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Models",
  description: "Browse all LLM models with capability scores, benchmark results, and pricing information.",
  openGraph: {
    title: "Model Directory | LLMRadar",
    description: "Browse all LLM models with capability scores, benchmark results, and pricing.",
  },
}

export default function ModelsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
