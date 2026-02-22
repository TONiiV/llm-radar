"use client"

import { useState } from "react"
import type { ModelWithScores } from "@/lib/types"
import { getModelColor } from "@/lib/colors"
import { SearchIcon } from "@/components/icons/CategoryIcons"
import { useLocale } from "@/lib/i18n-context"

const MAX_MODELS = 6

const PRESET_SLUGS: Record<string, string[]> = {
  frontier: [
    "claude-opus-46",
    "gpt-52",
    "gemini-3-pro",
    "deepseek-v32",
    "llama-4-maverick",
  ],
  value: ["deepseek-v32", "llama-4-maverick", "gemini-3-pro"],
  opensource: ["deepseek-v32", "llama-4-maverick"],
}

interface ModelSelectorProps {
  models: ModelWithScores[]
  selectedSlugs: string[]
  onSelectionChange: (slugs: string[]) => void
}

export default function ModelSelector({
  models,
  selectedSlugs,
  onSelectionChange,
}: ModelSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const { t } = useLocale()

  const presets: Record<string, { label: string; slugs: string[] }> = {
    frontier: { label: t("selector.presetFrontier"), slugs: PRESET_SLUGS.frontier },
    value: { label: t("selector.presetValue"), slugs: PRESET_SLUGS.value },
    opensource: { label: t("selector.presetOpenSource"), slugs: PRESET_SLUGS.opensource },
  }

  const filtered = models.filter((m) =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const toggle = (slug: string) => {
    if (selectedSlugs.includes(slug)) {
      onSelectionChange(selectedSlugs.filter((s) => s !== slug))
    } else if (selectedSlugs.length < MAX_MODELS) {
      onSelectionChange([...selectedSlugs, slug])
    }
  }

  const applyPreset = (key: string) => {
    const preset = presets[key]
    if (preset) {
      onSelectionChange(preset.slugs.slice(0, MAX_MODELS))
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-heading italic font-semibold text-sm text-txt-primary">
          {t("selector.title")} <span className="text-txt-muted">({selectedSlugs.length}/{MAX_MODELS})</span>
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

      {/* Model list */}
      <div className="space-y-0.5 max-h-64 overflow-y-auto" style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 4%, black 92%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 4%, black 92%, transparent 100%)' }}>
        {filtered.map((m) => {
          const isSelected = selectedSlugs.includes(m.slug)
          const selectedIndex = selectedSlugs.indexOf(m.slug)
          const isDisabled = !isSelected && selectedSlugs.length >= MAX_MODELS

          return (
            <label
              key={m.slug}
              className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer text-sm transition-all ${
                isSelected
                  ? "bg-card"
                  : "hover:bg-card"
              } ${isDisabled ? "opacity-30 cursor-not-allowed" : ""}`}
              style={isSelected && selectedIndex >= 0 ? { borderLeft: `2px solid ${getModelColor(selectedIndex)}`, paddingLeft: '6px' } : undefined}
              title={isDisabled ? t("selector.maxModels").replace("{n}", String(MAX_MODELS)) : ""}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(m.slug)}
                disabled={isDisabled}
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
    </div>
  )
}
