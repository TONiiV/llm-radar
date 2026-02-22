"use client"

import { useState, useMemo } from "react"
import D3RadarChart from "@/components/charts/d3/D3RadarChart"
import D3ScatterChart from "@/components/charts/d3/D3ScatterChart"
import StatsTable from "@/components/charts/StatsTable"
import ModelSelector from "@/components/ModelSelector"
import { getModelWithScores, getCategories, getParetoFrontier } from "@/lib/data"
import { LogoIcon, RadarIcon, PriceIcon } from "@/components/icons/CategoryIcons"
import { useLocale } from "@/lib/i18n-context"
import LocaleToggle from "@/components/LocaleToggle"

const DEFAULT_SELECTED = [
  "claude-opus-46",
  "gpt-52",
  "gemini-3-pro",
  "deepseek-v32",
  "llama-4-maverick",
]

export default function ComparePage() {
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(DEFAULT_SELECTED)
  const { t } = useLocale()

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
            {selectedModels.length === 0 ? (
              <div className="paper-card p-16 text-center">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="mx-auto mb-4 text-txt-muted/30">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
                <p className="text-txt-muted text-lg">{t("compare.emptyState")}</p>
              </div>
            ) : (
              <>
                {/* Charts side by side on desktop, stacked on mobile */}
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
                        console.log("Drill down to:", key)
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
                    />
                  </div>
                </div>

                {/* Stats Table - full width below */}
                <StatsTable models={selectedModels} categories={categories} />
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
