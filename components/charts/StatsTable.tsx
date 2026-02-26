"use client"

import type { ModelWithScores, Categories, Sources } from "@/lib/types"
import { CATEGORY_COLORS } from "@/lib/colors"
import { CATEGORY_ICONS } from "@/components/icons/CategoryIcons"
import { useLocale } from "@/lib/i18n-context"
import SourceIcon from "@/components/SourceIcon"

interface StatsTableProps {
  models: ModelWithScores[]
  categories: Categories
  sources: Sources
  onCategoryClick?: (categoryKey: string) => void
}

export default function StatsTable({ models, categories, sources, onCategoryClick }: StatsTableProps) {
  const { t, getCategoryLabel } = useLocale()
  const sorted = [...models].sort((a, b) => b.compositeScore - a.compositeScore)
  const categoryKeys = Object.keys(categories)

  return (
    <div className="paper-card">
      <div className="overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-4 py-3 font-heading italic font-medium text-txt-secondary">
              {t("compare.model")}
            </th>
            {categoryKeys.map((key) => {
              const Icon = CATEGORY_ICONS[key]
              return (
                <th
                  key={key}
                  className="text-center px-2 py-3 font-medium text-txt-secondary cursor-pointer hover:text-txt-primary transition-colors"
                  title={getCategoryLabel(key)}
                  onClick={() => onCategoryClick?.(key)}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    {Icon && <Icon size={14} className="inline-block text-txt-muted" />}
                    <span className="text-[10px] leading-tight">{getCategoryLabel(key)}</span>
                  </div>
                </th>
              )
            })}
            <th className="text-center px-3 py-3 font-heading italic font-medium text-txt-secondary">
              {t("compare.composite")}
            </th>
            <th className="text-right px-4 py-3 font-heading italic font-medium text-txt-secondary">
              <span className="inline-flex items-center">
                {t("compare.inputPrice")}
                <SourceIcon sourceKey="openrouter" sources={sources} size={12} />
              </span>
            </th>
            <th className="text-right px-4 py-3 font-heading italic font-medium text-txt-secondary">
              <span className="inline-flex items-center">
                {t("compare.outputPrice")}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((m) => (
            <tr
              key={m.slug}
              className="border-b border-border hover:bg-card transition-colors"
            >
              <td className="px-4 py-2.5 font-medium text-txt-primary whitespace-nowrap">
                {m.name}
              </td>
              {categoryKeys.map((key) => {
                const cs = m.categoryScores[key]
                const score = cs ? Math.round(cs.score) : 0
                const isReliable = cs?.isReliable ?? false
                const color = CATEGORY_COLORS[key] || "#94a3b8"

                return (
                  <td key={key} className="px-2 py-2.5 cursor-pointer" onClick={() => onCategoryClick?.(key)}>
                    <div className="flex items-center gap-1.5 min-w-[60px]">
                      {/* Visual score bar */}
                      <div className="flex-1 h-2.5 rounded-sm overflow-hidden" style={{ backgroundColor: `${color}15` }}>
                        <div
                          className="h-full rounded-sm"
                          style={{
                            width: `${score}%`,
                            backgroundColor: isReliable ? color : "transparent",
                            borderRight: !isReliable && score > 0 ? `2px dashed ${color}50` : "none",
                            backgroundImage: !isReliable && score > 0
                              ? `repeating-linear-gradient(90deg, ${color}30, ${color}30 2px, transparent 2px, transparent 4px)`
                              : "none",
                            backgroundSize: "4px 100%",
                          }}
                        />
                      </div>
                      {/* Score number */}
                      <span
                        className={`font-mono text-xs w-6 text-right flex-shrink-0 ${
                          !isReliable ? "text-txt-muted/40" : "text-txt-primary"
                        }`}
                      >
                        {cs ? score : "\u2014"}
                      </span>
                    </div>
                  </td>
                )
              })}
              {/* Composite score */}
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1.5 min-w-[60px]">
                  <div
                    className="flex-1 h-2.5 rounded-sm overflow-hidden"
                    style={{ backgroundColor: "var(--accent-blue)" + "15" }}
                  >
                    <div
                      className="h-full rounded-sm"
                      style={{
                        width: `${Math.round(m.compositeScore)}%`,
                        backgroundColor: "var(--accent-blue)",
                      }}
                    />
                  </div>
                  <span className="font-mono text-xs font-semibold text-accent-blue w-6 text-right flex-shrink-0">
                    {Math.round(m.compositeScore)}
                  </span>
                </div>
              </td>
              <td className="text-right px-4 py-2.5 font-mono text-xs text-txt-secondary whitespace-nowrap">
                {m.pricing.confirmed ? "" : "~"}${m.pricing.input_per_1m}
              </td>
              <td className="text-right px-4 py-2.5 font-mono text-xs text-txt-secondary whitespace-nowrap">
                {m.pricing.confirmed ? "" : "~"}${m.pricing.output_per_1m}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
