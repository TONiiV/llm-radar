import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Compare Models",
  description: "Compare LLM models side-by-side with five-axis radar chart, price-performance scatter plot, and benchmark rankings.",
  openGraph: {
    title: "Compare LLM Models | LLMRadar",
    description: "Compare LLM models with radar charts, scatter plots, and benchmark rankings.",
  },
}

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
