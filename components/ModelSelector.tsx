"use client"

import { useState, useMemo } from "react"
import type { ModelWithScores, Provider } from "@/lib/types"
import { getModelColor } from "@/lib/colors"
import {
  SearchIcon,
  GridIcon,
  OpenSourceIcon,
  MultimodalIcon,
  VisionIcon,
  ToolUseIcon,
  ReasoningIcon,
  LongContextIcon,
  ClearIcon,
} from "@/components/icons/CategoryIcons"
import { ProviderIcon } from "@/components/icons/ProviderIcons"
import { useLocale } from "@/lib/i18n-context"

/**
 * Pick top N models by compositeScore, one per provider.
 * Models are sorted by score descending; the first model seen
 * from each provider wins.
 */
function topPerProvider(models: ModelWithScores[], n: number): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  const sorted = [...models].sort((a, b) => b.compositeScore - a.compositeScore)
  for (const m of sorted) {
    if (seen.has(m.provider)) continue
    seen.add(m.provider)
    result.push(m.slug)
    if (result.length >= n) break
  }
  return result
}

type FilterKey = "all" | "opensource" | "multimodal" | "vision" | "toolUse" | "reasoning" | "longContext" | `provider:${string}`

interface FilterTab {
  key: FilterKey
  labelKey: string
  icon: React.FC<{ className?: string; size?: number }>
}

const CATEGORY_FILTERS: FilterTab[] = [
  { key: "all", labelKey: "selector.all", icon: GridIcon },
  { key: "opensource", labelKey: "selector.openSource", icon: OpenSourceIcon },
  { key: "multimodal", labelKey: "selector.multimodal", icon: MultimodalIcon },
  { key: "vision", labelKey: "selector.vision", icon: VisionIcon },
  { key: "toolUse", labelKey: "selector.toolUse", icon: ToolUseIcon },
  { key: "reasoning", labelKey: "selector.reasoning", icon: ReasoningIcon },
  { key: "longContext", labelKey: "selector.longContext", icon: LongContextIcon },
]

function filterModel(model: ModelWithScores, filter: FilterKey): boolean {
  if (filter === "all") return true
  if (filter.startsWith("provider:")) {
    return model.provider === filter.slice("provider:".length)
  }
  switch (filter) {
    case "opensource": return model.is_open_source
    case "multimodal": return model.tags.includes("multimodal")
    case "vision": return model.tags.includes("vision")
    case "toolUse": return model.tags.includes("function_calling")
    case "reasoning": return model.is_reasoning_model
    case "longContext": return model.tags.includes("long_context")
    default: return true
  }
}

interface ModelSelectorProps {
  models: ModelWithScores[]
  providers: Provider[]
  selectedSlugs: string[]
  onSelectionChange: (slugs: string[]) => void
}

export default function ModelSelector({
  models,
  providers,
  selectedSlugs,
  onSelectionChange,
}: ModelSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all")
  const { t } = useLocale()

  const providerMap = useMemo(() => {
    const map = new Map<string, Provider>()
    for (const p of providers) map.set(p.slug, p)
    return map
  }, [providers])

  const frontierSlugs = useMemo(() => topPerProvider(models, 5), [models])
  const valueSlugs = useMemo(
    () => topPerProvider(models.filter((m) => {
      const avg = m.pricing ? (m.pricing.input_per_1m + m.pricing.output_per_1m) / 2 : Infinity
      return avg < 10 // affordable models under $10 avg per 1M tokens
    }), 3),
    [models]
  )
  const openSourceSlugs = useMemo(
    () => topPerProvider(models.filter((m) => m.is_open_source), 3),
    [models]
  )

  const presets: Record<string, { label: string; slugs: string[] }> = {
    frontier: { label: t("selector.presetFrontier"), slugs: frontierSlugs },
    value: { label: t("selector.presetValue"), slugs: valueSlugs },
    opensource: { label: t("selector.presetOpenSource"), slugs: openSourceSlugs },
  }

  // Filter by tab, then by search
  const filtered = useMemo(() => {
    return models
      .filter((m) => filterModel(m, activeFilter))
      .filter((m) => m.name.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [models, activeFilter, searchTerm])

  // Group by provider, sorted by best model score desc
  const groupedByProvider = useMemo(() => {
    const groups = new Map<string, ModelWithScores[]>()
    for (const m of filtered) {
      const list = groups.get(m.provider) || []
      list.push(m)
      groups.set(m.provider, list)
    }
    Array.from(groups.values()).forEach((list) => {
      list.sort((a, b) => b.compositeScore - a.compositeScore)
    })
    return Array.from(groups.entries()).sort(
      (a, b) => b[1][0].compositeScore - a[1][0].compositeScore
    )
  }, [filtered])

  const toggle = (slug: string) => {
    if (selectedSlugs.includes(slug)) {
      onSelectionChange(selectedSlugs.filter((s) => s !== slug))
    } else {
      onSelectionChange([...selectedSlugs, slug])
    }
  }

  const applyPreset = (key: string) => {
    const preset = presets[key]
    if (preset) {
      onSelectionChange(preset.slugs)
      setActiveFilter("all")
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-heading italic font-semibold text-sm text-txt-primary">
          {t("selector.title")}
        </h3>
      </div>

      {/* Preset buttons */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(presets).map(([key, preset]) => (
          <button
            key={key}
            onClick={() => applyPreset(key)}
            className="font-mono text-xs tracking-wider uppercase border border-border px-2.5 py-1 text-txt-secondary hover:text-accent-blue hover:border-accent-blue transition-all"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
        {CATEGORY_FILTERS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeFilter === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`flex-shrink-0 flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 border transition-all ${
                isActive
                  ? "border-accent-blue text-accent-blue bg-accent-blue/10"
                  : "border-border text-txt-muted hover:text-txt-secondary hover:border-txt-muted"
              }`}
              title={t(tab.labelKey as any)}
            >
              <Icon size={12} />
              <span>{t(tab.labelKey as any)}</span>
            </button>
          )
        })}
      </div>

      {/* Provider filter tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
        <span className="flex-shrink-0 font-mono text-[10px] uppercase tracking-wider text-txt-muted self-center mr-0.5">
          {t("selector.providers")}
        </span>
        {providers.map((p) => {
          const filterKey: FilterKey = `provider:${p.slug}`
          const isActive = activeFilter === filterKey
          return (
            <button
              key={p.slug}
              onClick={() => setActiveFilter(isActive ? "all" : filterKey)}
              className={`flex-shrink-0 flex items-center gap-1 font-mono text-[11px] px-1.5 py-0.5 border transition-all ${
                isActive
                  ? "border-current bg-current/10"
                  : "border-border text-txt-muted hover:border-txt-muted"
              }`}
              style={isActive ? { color: p.color, borderColor: p.color } : undefined}
              title={p.name}
            >
              <ProviderIcon
                slug={p.slug}
                size={12}
                style={{ color: p.color }}
              />
              <span className="max-w-[4rem] truncate">{p.name}</span>
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
        <input
          type="text"
          placeholder={t("selector.search")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="retro-input w-full pl-8 pr-3 py-1.5 text-sm"
        />
      </div>

      {/* Model list grouped by provider */}
      <div className="space-y-0.5 max-h-64 overflow-y-auto" style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 4%, black 92%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 4%, black 92%, transparent 100%)' }}>
        {groupedByProvider.map(([providerSlug, providerModels]) => {
          const provider = providerMap.get(providerSlug)
          return (
            <div key={providerSlug}>
              {/* Provider group header */}
              <div className="flex items-center gap-1.5 px-2 pt-2 pb-1">
                <ProviderIcon
                  slug={providerSlug}
                  size={13}
                  style={{ color: provider?.color ?? "#888" }}
                />
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-txt-muted">
                  {provider?.name ?? providerSlug}
                </span>
                <span className="font-mono text-[10px] text-txt-muted/50">
                  ({providerModels.length})
                </span>
              </div>
              {/* Models in this provider group */}
              {providerModels.map((m) => {
                const isSelected = selectedSlugs.includes(m.slug)
                const selectedIndex = selectedSlugs.indexOf(m.slug)
                return (
                  <label
                    key={m.slug}
                    className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer text-sm transition-all ${
                      isSelected
                        ? "bg-card"
                        : "hover:bg-card"
                    }`}
                    style={isSelected && selectedIndex >= 0 ? { borderLeft: `2px solid ${getModelColor(selectedIndex)}`, paddingLeft: '6px' } : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(m.slug)}
                      className="border-border bg-transparent accent-accent-blue"
                    />
                    {isSelected && (
                      <span
                        className="w-2.5 h-2.5 flex-shrink-0"
                        style={{
                          backgroundColor: getModelColor(selectedIndex),
                        }}
                      />
                    )}
                    <span className="flex-1 truncate text-txt-primary">{m.name}</span>
                    <span className="font-mono text-xs text-txt-muted">
                      {Math.round(m.compositeScore)}
                    </span>
                    {m.is_open_source && (
                      <span className="font-mono text-[10px] px-1 py-0.5 bg-score-high/10 text-score-high">
                        {t("selector.openSource")}
                      </span>
                    )}
                    {m.is_reasoning_model && (
                      <span className="font-mono text-[10px] px-1 py-0.5 bg-score-mid/10 text-score-mid">
                        {t("selector.reasoning")}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
