"use client"

import { useState, useMemo } from "react"
import CategoryRadar from "@/components/charts/CategoryRadar"
import PriceScatter from "@/components/charts/PriceScatter"
import ModelSelector from "@/components/ModelSelector"
import { getModelWithScores, getCategories, getParetoFrontier } from "@/lib/data"
import { LogoIcon, RadarIcon, PriceIcon, CATEGORY_ICONS } from "@/components/icons/CategoryIcons"
import { useLocale } from "@/lib/i18n-context"
import LocaleToggle from "@/components/LocaleToggle"

const DEFAULT_SELECTED = [
  "claude-opus-46",
  "gpt-52",
  "gemini-3-pro",
  "deepseek-v32",
  "llama-4-maverick",
]

type Tab = "radar" | "scatter"

export default function ComparePage() {
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(DEFAULT_SELECTED)
  const [activeTab, setActiveTab] = useState<Tab>("radar")
  const { t, getCategoryLabel } = useLocale()

  const allModels = useMemo(() => getModelWithScores(), [])
  const categories = useMemo(() => getCategories(), [])
  const paretoSlugs = useMemo(() => getParetoFrontier(allModels), [allModels])

  const selectedModels = useMemo(
    () => allModels.filter((m) => selectedSlugs.includes(m.slug)),
    [allModels, selectedSlugs]
  )

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="paper-card-flat sticky top-0 z-50 mx-4 mt-3 mb-4">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <LogoIcon size={28} />
            <span className="text-lg font-heading font-bold text-txt-primary">LLMRadar</span>
          </a>
          <nav className="flex items-center gap-4 text-sm">
            <a
              href="/compare"
              className="text-accent-blue font-medium"
            >
              {t("nav.compare")}
            </a>
            <LocaleToggle />
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar - Model Selector */}
          <aside className="lg:w-72 flex-shrink-0">
            <div className="paper-card p-4 sticky top-20">
              <ModelSelector
                models={allModels}
                selectedSlugs={selectedSlugs}
                onSelectionChange={setSelectedSlugs}
              />
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 space-y-6">
            {/* Tab bar */}
            <div className="flex gap-0 border-b border-border w-fit">
              <button
                onClick={() => setActiveTab("radar")}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-heading italic transition-colors ${
                  activeTab === "radar"
                    ? "text-accent-blue border-b-2 border-accent-blue"
                    : "text-txt-secondary hover:text-txt-primary"
                }`}
              >
                <RadarIcon size={16} />
                {t("compare.tabRadar")}
              </button>
              <button
                onClick={() => setActiveTab("scatter")}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-heading italic transition-colors ${
                  activeTab === "scatter"
                    ? "text-accent-blue border-b-2 border-accent-blue"
                    : "text-txt-secondary hover:text-txt-primary"
                }`}
              >
                <PriceIcon size={16} />
                {t("compare.tabScatter")}
              </button>
            </div>

            {/* Charts */}
            {selectedModels.length === 0 ? (
              <div className="paper-card p-16 text-center">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="mx-auto mb-4 text-txt-muted/30">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
                <p className="text-txt-muted text-lg">{t("compare.emptyState")}</p>
              </div>
            ) : activeTab === "radar" ? (
              <div className="paper-card p-5">
                <h2 className="font-heading italic text-xl font-semibold mb-1 text-txt-primary">
                  {t("compare.radarTitle")}
                </h2>
                <p className="text-sm text-txt-muted mb-4">
                  {t("compare.radarDesc")}
                </p>
                <CategoryRadar
                  models={selectedModels}
                  categories={categories}
                  onCategoryClick={(key) => {
                    console.log("Drill down to:", key)
                  }}
                />
              </div>
            ) : (
              <div className="paper-card p-5">
                <h2 className="font-heading italic text-xl font-semibold mb-1 text-txt-primary">
                  {t("compare.scatterTitle")}
                </h2>
                <p className="text-sm text-txt-muted mb-4">
                  {t("compare.scatterDesc")}
                </p>
                <PriceScatter
                  models={allModels}
                  selectedSlugs={selectedSlugs}
                  paretoSlugs={paretoSlugs}
                />
              </div>
            )}

            {/* Quick stats table */}
            <div className="paper-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 font-heading italic font-medium text-txt-secondary">
                      {t("compare.model")}
                    </th>
                    {Object.entries(categories).map(([key, cat]) => {
                      const Icon = CATEGORY_ICONS[key]
                      return (
                        <th
                          key={key}
                          className="text-center px-2 py-3 font-medium text-txt-secondary"
                          title={getCategoryLabel(key)}
                        >
                          {Icon ? <Icon size={14} className="inline-block text-txt-muted" /> : key}
                        </th>
                      )
                    })}
                    <th className="text-center px-3 py-3 font-heading italic font-medium text-txt-secondary">
                      {t("compare.composite")}
                    </th>
                    <th className="text-right px-4 py-3 font-heading italic font-medium text-txt-secondary">
                      {t("compare.inputPrice")}
                    </th>
                    <th className="text-right px-4 py-3 font-heading italic font-medium text-txt-secondary">
                      {t("compare.outputPrice")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedModels
                    .sort((a, b) => b.compositeScore - a.compositeScore)
                    .map((m) => (
                      <tr
                        key={m.slug}
                        className="border-b border-border hover:bg-card transition-colors"
                      >
                        <td className="px-4 py-2.5 font-medium text-txt-primary">{m.name}</td>
                        {Object.keys(categories).map((key) => {
                          const cs = m.categoryScores[key]
                          return (
                            <td
                              key={key}
                              className={`text-center px-2 py-2.5 font-mono ${
                                !cs?.isReliable ? "text-txt-muted/40" : "text-txt-primary"
                              }`}
                            >
                              {cs ? Math.round(cs.score) : "\u2014"}
                            </td>
                          )
                        })}
                        <td className="text-center px-3 py-2.5 font-mono font-semibold text-accent-blue">
                          {Math.round(m.compositeScore)}
                        </td>
                        <td className="text-right px-4 py-2.5 font-mono text-txt-secondary">
                          {m.pricing.confirmed ? "" : "~"}${m.pricing.input_per_1m}
                        </td>
                        <td className="text-right px-4 py-2.5 font-mono text-txt-secondary">
                          {m.pricing.confirmed ? "" : "~"}${m.pricing.output_per_1m}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
