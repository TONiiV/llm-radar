"use client"

import Link from "next/link"
import { getCategoryColor } from "@/lib/colors"
import { CATEGORY_ICONS } from "@/components/icons/CategoryIcons"
import { useLocale } from "@/lib/i18n-context"
import { estimateTypicalQueryCost, formatPrice } from "@/lib/pricing"
import Navbar from "@/components/Navbar"
import SourceIcon from "@/components/SourceIcon"
import type { ModelWithScores, Categories, Provider, Sources } from "@/lib/types"

interface Props {
  model: ModelWithScores
  categories: Categories
  providers: Provider[]
  sources: Sources
}

export default function ModelDetailClient({ model, categories, providers, sources }: Props) {
  const { t, getCategoryLabel } = useLocale()

  const provider = providers.find((p) => p.slug === model.provider)
  const typicalCost = estimateTypicalQueryCost(
    model.pricing.input_per_1m,
    model.pricing.output_per_1m,
    model.is_reasoning_model
  )
  const categoryKeys = Object.keys(categories)

  return (
    <div className="min-h-screen">
      <Navbar maxWidth="max-w-5xl" />

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-txt-muted mb-6">
          <Link href="/" className="hover:text-txt-primary transition-colors">{t("model.home")}</Link>
          <span>/</span>
          <Link href="/models" className="hover:text-txt-primary transition-colors">{t("model.models")}</Link>
          <span>/</span>
          <span className="text-txt-primary">{model.name}</span>
        </nav>

        {/* Model Header */}
        <div className="paper-card p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="mb-2">
                <span
                  className="provider-tag px-2 py-0.5 text-sm"
                  style={{ color: provider?.color, borderBottom: `2px solid ${provider?.color}` }}
                >
                  {provider?.name ?? model.provider}
                </span>
              </div>
              <h1 className="font-heading text-4xl text-txt-primary mb-3">{model.name}</h1>
              <div className="flex flex-wrap gap-2">
                {model.is_open_source && (
                  <span className="text-xs px-2 py-0.5 border border-score-high text-score-high font-mono">{t("model.openSource")}</span>
                )}
                {model.is_reasoning_model && (
                  <span className="text-xs px-2 py-0.5 border border-score-mid text-score-mid font-mono">{t("model.reasoningModel")}</span>
                )}
                {model.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 border border-border text-txt-muted font-mono">{tag}</span>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="text-right">
                <div className="text-xs text-txt-muted mb-1">{t("model.radarScore")}</div>
                <span className="font-mono text-5xl text-txt-primary">{Math.round(model.radarIdx)}</span>
                <span className="text-txt-muted text-lg">/100</span>
                {(() => {
                  const avail = Object.values(model.categoryScores).reduce((s, c) => s + c.availableCount, 0)
                  const total = Object.values(model.categoryScores).reduce((s, c) => s + c.benchmarkCount, 0)
                  return avail < total ? (
                    <div className="text-[10px] font-mono text-score-mid mt-1">
                      {avail}/{total} benchmarks — {t("model.partialData")}
                    </div>
                  ) : null
                })()}
              </div>
              <Link href={`/compare?ids=${model.slug}`} className="btn-primary px-4 py-2 text-sm inline-block mt-2">
                {t("model.compareWithOthers")}
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Capability Scores */}
          <div className="lg:col-span-2 space-y-6">
            <div className="paper-card p-6">
              <h2 className="font-heading text-xl italic text-txt-primary mb-4">{t("model.capabilityScores")}</h2>
              <div className="space-y-4">
                {categoryKeys.map((key) => {
                  const cat = model.categoryScores[key]
                  if (!cat) return null
                  const Icon = CATEGORY_ICONS[key]
                  const color = getCategoryColor(key)
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div className="w-8 flex justify-center">
                        {Icon && <Icon size={20} style={{ color }} />}
                      </div>
                      <div className="w-16 text-sm font-body text-txt-secondary">{getCategoryLabel(key)}</div>
                      <div className="flex-1 h-3 bg-border rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${cat.score}%`, backgroundColor: color, opacity: cat.isReliable ? 1 : 0.4 }} />
                      </div>
                      <div className="w-14 text-right">
                        <span className="font-mono text-sm text-txt-primary">{Math.round(cat.score)}</span>
                        <span className="text-txt-muted text-xs">/100</span>
                      </div>
                      <div className="w-16 text-right">
                        <span className="text-xs text-txt-muted">{cat.availableCount}/{cat.benchmarkCount}{!cat.isReliable && " ⚠️"}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="paper-card p-6">
              <h2 className="font-heading text-xl italic text-txt-primary mb-4">{t("model.benchmarkDetails")}</h2>
              {categoryKeys.map((key) => {
                const catDef = categories[key]
                const color = getCategoryColor(key)
                return (
                  <div key={key} className="mb-6 last:mb-0">
                    <h3 className="text-sm font-heading font-semibold mb-3 flex items-center gap-2" style={{ color }}>
                      {getCategoryLabel(key)}
                    </h3>
                    <div className="space-y-2">
                      {catDef.benchmarks.map((bm) => {
                        const raw = model.benchmarks[bm.key]
                        const hasData = raw != null
                        return (
                          <div key={bm.key} className="flex items-center gap-3 text-sm">
                            <div className="w-40 text-txt-secondary font-body flex items-center gap-0.5">
                              <span className="truncate" title={bm.label}>{bm.label}</span>
                              {bm.source && <SourceIcon sourceKey={bm.source} sources={sources} size={12} url={bm.sourceUrl} />}
                            </div>
                            <div className="flex-1">
                              {hasData ? (
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: bm.max_score ? `${Math.min((raw / bm.max_score) * 100, 100)}%` : "50%", backgroundColor: color }} />
                                  </div>
                                  <span className="font-mono text-txt-primary w-24 text-right">
                                    {bm.unit === "ELO" ? `${raw.toFixed(0)} ELO` : bm.unit === "%" ? `${raw.toFixed(1)}%` : `${raw.toFixed(1)} ${bm.unit}`}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-txt-muted text-xs">{t("model.noData")}</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right Column: Model Info */}
          <div className="space-y-6">
            <div className="paper-card p-6">
              <h2 className="font-heading text-xl italic text-txt-primary mb-4">{t("model.pricing")}</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-txt-muted">{t("model.inputPer1M")}</span>
                  <span className="font-mono text-txt-primary">{model.pricing.confirmed ? "" : "~"}${model.pricing.input_per_1m.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-txt-muted">{t("model.outputPer1M")}</span>
                  <span className="font-mono text-txt-primary">{model.pricing.confirmed ? "" : "~"}${model.pricing.output_per_1m.toFixed(2)}</span>
                </div>
                <div className="border-t border-border pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-txt-muted">{t("model.typicalQueryCost")}</span>
                    <span className="font-mono text-txt-primary">{formatPrice(typicalCost)}</span>
                  </div>
                  <p className="text-xs text-txt-muted mt-1">
                    {model.is_reasoning_model ? t("model.reasoningTokensDesc") : t("model.standardTokensDesc")}
                  </p>
                </div>
                {!model.pricing.confirmed && <p className="text-xs text-score-mid mt-2">{t("model.estimatedPrice")}</p>}
              </div>
            </div>

            <div className="paper-card p-6">
              <h2 className="font-heading text-xl italic text-txt-primary mb-4">{t("model.specifications")}</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-txt-muted">{t("model.provider")}</span>
                  <span className="text-txt-primary">{provider?.name ?? model.provider}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-txt-muted">{t("model.releaseDate")}</span>
                  <span className="text-txt-primary font-mono">{model.release_date || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-txt-muted">{t("model.contextInput")}</span>
                  <span className="text-txt-primary font-mono">
                    {model.context_window_input > 0 ? `${(model.context_window_input / 1000).toFixed(0)}K` : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-txt-muted">{t("model.contextOutput")}</span>
                  <span className="text-txt-primary font-mono">
                    {model.context_window_output > 0 ? `${(model.context_window_output / 1000).toFixed(0)}K` : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-txt-muted">{t("model.openSource")}</span>
                  <span className="text-txt-primary">{model.is_open_source ? t("model.yes") : t("model.no")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-txt-muted">{t("model.reasoningModel")}</span>
                  <span className="text-txt-primary">{model.is_reasoning_model ? t("model.yes") : t("model.no")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
