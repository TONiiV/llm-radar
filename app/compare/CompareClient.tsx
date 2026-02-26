"use client"

import { useMemo } from "react"
import D3RadarChart from "@/components/charts/d3/D3RadarChart"
import D3ScatterChart from "@/components/charts/d3/D3ScatterChart"
import CategoryDetail from "@/components/charts/d3/CategoryDetail"
import StatsTable from "@/components/charts/StatsTable"
import BenchmarkRanking from "@/components/charts/BenchmarkRanking"
import ModelSelector from "@/components/ModelSelector"
import { getParetoFrontier, computeComparativeScores } from "@/lib/data"
import { RadarIcon, PriceIcon, ClearIcon } from "@/components/icons/CategoryIcons"
import { getModelColor } from "@/lib/colors"
import { useLocale } from "@/lib/i18n-context"
import Navbar from "@/components/Navbar"
import { useUrlParams, type CompareTab } from "@/lib/useUrlParams"
import type { ModelWithScores, Categories, Provider, Sources } from "@/lib/types"

const TAB_CONFIG: { key: CompareTab; iconKey: string }[] = [
  { key: "radar", iconKey: "radar" },
  { key: "scatter", iconKey: "scatter" },
  { key: "ranking", iconKey: "ranking" },
]

interface Props {
  allModels: ModelWithScores[]
  providers: Provider[]
  categories: Categories
  sources: Sources
}

export default function CompareClient({ allModels, providers, categories, sources }: Props) {
  const {
    selectedSlugs,
    setSelectedSlugs,
    activeTab,
    setActiveTab,
    drilldownCategory,
    setDrilldownCategory,
  } = useUrlParams(allModels)
  const { t, tParams } = useLocale()

  const paretoSlugs = useMemo(() => getParetoFrontier(allModels), [allModels])

  const selectedModels = useMemo(
    () => allModels.filter((m) => selectedSlugs.includes(m.slug)),
    [allModels, selectedSlugs]
  )

  // Common-benchmark comparative scoring
  const comparative = useMemo(
    () => selectedModels.length > 1
      ? computeComparativeScores(selectedModels, allModels, categories)
      : { models: selectedModels, commonCount: 0, totalCount: 0 },
    [selectedModels, allModels, categories]
  )

  return (
    <div className="min-h-screen">
      <Navbar />
    <main className="max-w-7xl mx-auto px-4 py-2">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar - Selected Models + Model Selector */}
        <aside className="lg:w-72 flex-shrink-0">
          <div className="sticky top-20 space-y-3">
            {/* Selected Models Panel */}
            {selectedSlugs.length > 0 && (
              <div className="paper-card p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-heading italic font-semibold text-sm text-txt-primary">
                    {t("selector.selectedModels" as any)} <span className="text-txt-muted font-mono text-xs">({selectedSlugs.length})</span>
                  </h3>
                  <button
                    onClick={() => setSelectedSlugs([])}
                    className="flex items-center gap-1 font-mono text-[11px] text-txt-muted hover:text-score-low transition-colors"
                    title={t("selector.unselectAll")}
                  >
                    <ClearIcon size={12} />
                    {t("selector.unselectAll")}
                  </button>
                </div>
                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                  {selectedSlugs.map((slug, idx) => {
                    const model = allModels.find((m) => m.slug === slug)
                    if (!model) return null
                    return (
                      <div
                        key={slug}
                        className="flex items-center gap-2 px-2 py-1 text-sm group"
                        style={{ borderLeft: `2px solid ${getModelColor(idx)}`, paddingLeft: '6px' }}
                      >
                        <span
                          className="w-2 h-2 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: getModelColor(idx) }}
                        />
                        <span className="flex-1 truncate text-txt-primary text-xs">{model.name}</span>
                        <span className="font-mono text-[10px] text-txt-muted">
                          {Math.round(model.compositeScore)}
                        </span>
                        <button
                          onClick={() => setSelectedSlugs(selectedSlugs.filter((s) => s !== slug))}
                          className="opacity-0 group-hover:opacity-100 text-txt-muted hover:text-score-low transition-all"
                          title={t("selector.remove" as any)}
                        >
                          <ClearIcon size={10} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Model Selector */}
            <div className="paper-card p-4">
              <ModelSelector
                models={allModels}
                providers={providers}
                selectedSlugs={selectedSlugs}
                onSelectionChange={setSelectedSlugs}
              />
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 space-y-6">
          {/* Tab Navigation */}
          <div className="flex gap-1 paper-card-flat p-1">
            {TAB_CONFIG.map(({ key }) => {
              const isActive = activeTab === key
              const labelKey = `compare.tab${key.charAt(0).toUpperCase() + key.slice(1)}` as Parameters<typeof t>[0]
              return (
                <button
                  key={key}
                  onClick={() => {
                    setActiveTab(key)
                    if (key !== "radar") setDrilldownCategory(null)
                  }}
                  className={`
                    flex-1 px-4 py-2 text-sm font-heading font-medium rounded transition-all
                    ${isActive
                      ? "bg-accent-blue/10 text-accent-blue border border-accent-blue/20"
                      : "text-txt-muted hover:text-txt-primary hover:bg-bg-card/50"
                    }
                  `}
                >
                  {t(labelKey)}
                </button>
              )
            })}
          </div>

          {selectedModels.length === 0 ? (
            <div className="paper-card p-16 text-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="mx-auto mb-4 text-txt-muted/30">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              <p className="text-txt-muted text-lg">{t("compare.emptyState")}</p>
            </div>
          ) : (
            <>
              {/* Radar Tab */}
              {activeTab === "radar" && (
                <>
                  {/* Coverage indicator for common-benchmark comparison */}
                  {selectedModels.length > 1 && comparative.commonCount < comparative.totalCount && (
                    <div className="paper-card-flat px-4 py-2 text-sm text-txt-muted flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-accent-blue flex-shrink-0">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                        <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      <span>
                        {tParams("compare.commonBenchmarksHint", { commonCount: comparative.commonCount, totalCount: comparative.totalCount })}
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Radar Chart */}
                    <div className="paper-card p-5">
                      <div className="flex items-center gap-2 mb-1">
                        <RadarIcon size={16} className="text-accent-blue" />
                        <h2 className="font-heading italic text-xl font-semibold text-txt-primary">
                          {t("compare.radarTitle")}
                        </h2>
                      </div>
                      <p className="text-sm text-txt-muted mb-4">
                        {t("compare.radarDesc")}
                      </p>
                      <D3RadarChart
                        models={selectedModels}
                        categories={categories}
                        onCategoryClick={(key) => {
                          setDrilldownCategory(
                            drilldownCategory === key ? null : key
                          )
                        }}
                      />
                    </div>

                    {/* Scatter Chart */}
                    <div className="paper-card p-5">
                      <div className="flex items-center gap-2 mb-1">
                        <PriceIcon size={16} className="text-accent-blue" />
                        <h2 className="font-heading italic text-xl font-semibold text-txt-primary">
                          {t("compare.scatterTitle")}
                        </h2>
                      </div>
                      <p className="text-sm text-txt-muted mb-4">
                        {t("compare.scatterDesc")}
                      </p>
                      <D3ScatterChart
                        models={allModels}
                        selectedSlugs={selectedSlugs}
                        paretoSlugs={paretoSlugs}
                        sources={sources}
                      />
                    </div>
                  </div>

                  {/* L2 Drill-down Panel */}
                  {drilldownCategory && categories[drilldownCategory] && (
                    <CategoryDetail
                      categoryKey={drilldownCategory}
                      category={categories[drilldownCategory]}
                      models={selectedModels}
                      sources={sources}
                      onClose={() => setDrilldownCategory(null)}
                    />
                  )}

                  {/* Stats Table */}
                  <StatsTable
                    models={selectedModels}
                    categories={categories}
                    sources={sources}
                    onCategoryClick={(key) => {
                      setDrilldownCategory(drilldownCategory === key ? null : key)
                    }}
                  />
                </>
              )}

              {/* Scatter Tab */}
              {activeTab === "scatter" && (
                <div className="paper-card p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <PriceIcon size={16} className="text-accent-blue" />
                    <h2 className="font-heading italic text-xl font-semibold text-txt-primary">
                      {t("compare.scatterTitle")}
                    </h2>
                  </div>
                  <p className="text-sm text-txt-muted mb-4">
                    {t("compare.scatterDesc")}
                  </p>
                  <D3ScatterChart
                    models={allModels}
                    selectedSlugs={selectedSlugs}
                    paretoSlugs={paretoSlugs}
                    sources={sources}
                  />
                </div>
              )}

              {/* Ranking Tab */}
              {activeTab === "ranking" && (
                <div className="paper-card p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" className="text-accent-blue">
                      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <h2 className="font-heading italic text-xl font-semibold text-txt-primary">
                      {t("compare.rankingTitle")}
                    </h2>
                  </div>
                  <p className="text-sm text-txt-muted mb-4">
                    {t("compare.rankingDesc")}
                  </p>
                  <BenchmarkRanking
                    models={allModels}
                    categories={categories}
                    selectedSlugs={selectedSlugs}
                    sources={sources}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
    </div>
  )
}
