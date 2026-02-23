"use client"

import { useMemo } from "react"
import D3RadarChart from "@/components/charts/d3/D3RadarChart"
import D3ScatterChart from "@/components/charts/d3/D3ScatterChart"
import CategoryDetail from "@/components/charts/d3/CategoryDetail"
import StatsTable from "@/components/charts/StatsTable"
import BenchmarkRanking from "@/components/charts/BenchmarkRanking"
import ModelSelector from "@/components/ModelSelector"
import { getParetoFrontier } from "@/lib/data"
import { RadarIcon, PriceIcon } from "@/components/icons/CategoryIcons"
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
  } = useUrlParams()
  const { t } = useLocale()

  const paretoSlugs = useMemo(() => getParetoFrontier(allModels), [allModels])

  const selectedModels = useMemo(
    () => allModels.filter((m) => selectedSlugs.includes(m.slug)),
    [allModels, selectedSlugs]
  )

  return (
    <div className="min-h-screen">
      <Navbar />
    <main className="max-w-7xl mx-auto px-4 py-2">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar - Model Selector */}
        <aside className="lg:w-72 flex-shrink-0">
          <div className="paper-card p-4 sticky top-20">
            <ModelSelector
              models={allModels}
              providers={providers}
              selectedSlugs={selectedSlugs}
              onSelectionChange={setSelectedSlugs}
            />
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
