"use client"

import type { ModelWithScores } from "@/lib/types"
import { getModelColor } from "@/lib/colors"

interface ChartLegendProps {
  models: ModelWithScores[]
  hoveredSlug: string | null
  onHover: (slug: string | null) => void
}

export default function ChartLegend({ models, hoveredSlug, onHover }: ChartLegendProps) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-3">
      {models.map((m, i) => (
        <button
          key={m.slug}
          className="flex items-center gap-1.5 text-xs font-mono transition-opacity"
          style={{
            opacity: hoveredSlug && hoveredSlug !== m.slug ? 0.3 : 1,
          }}
          onMouseEnter={() => onHover(m.slug)}
          onMouseLeave={() => onHover(null)}
        >
          <span
            className="inline-block w-3 h-3 flex-shrink-0"
            style={{ backgroundColor: getModelColor(i) }}
          />
          <span className="text-txt-secondary">{m.name}</span>
        </button>
      ))}
    </div>
  )
}
