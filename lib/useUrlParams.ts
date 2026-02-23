"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { ModelWithScores } from "@/lib/types"

export type CompareTab = "radar" | "scatter" | "ranking"

interface UrlParamsState {
  selectedSlugs: string[]
  activeTab: CompareTab
  drilldownCategory: string | null
}

/**
 * Pick top N models by compositeScore, one per provider.
 */
export function topPerProvider(models: ModelWithScores[], n: number): string[] {
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

function parseParams(defaultSlugs: string[]): UrlParamsState {
  if (typeof window === "undefined") {
    return { selectedSlugs: defaultSlugs, activeTab: "radar", drilldownCategory: null }
  }

  const params = new URLSearchParams(window.location.search)
  const ids = params.get("ids")
  const tab = params.get("tab") as CompareTab | null
  const drill = params.get("drill")

  return {
    selectedSlugs: ids ? ids.split(",").filter(Boolean) : defaultSlugs,
    activeTab: tab && ["radar", "scatter", "ranking"].includes(tab) ? tab : "radar",
    drilldownCategory: drill || null,
  }
}

function updateUrl(state: UrlParamsState, defaultSlugs: string[]) {
  if (typeof window === "undefined") return

  const params = new URLSearchParams()

  // Only set ids if different from default
  const isDefault =
    state.selectedSlugs.length === defaultSlugs.length &&
    state.selectedSlugs.every((s) => defaultSlugs.includes(s))

  if (!isDefault) {
    params.set("ids", state.selectedSlugs.join(","))
  }

  if (state.activeTab !== "radar") {
    params.set("tab", state.activeTab)
  }

  if (state.drilldownCategory) {
    params.set("drill", state.drilldownCategory)
  }

  const search = params.toString()
  const url = search ? `${window.location.pathname}?${search}` : window.location.pathname
  window.history.replaceState(null, "", url)
}

export function useUrlParams(models: ModelWithScores[]) {
  const defaultSlugs = useMemo(() => topPerProvider(models, 5), [models])
  const [state, setState] = useState<UrlParamsState>(() => parseParams(defaultSlugs))

  // Sync to URL on state change
  useEffect(() => {
    updateUrl(state, defaultSlugs)
  }, [state, defaultSlugs])

  const setSelectedSlugs = useCallback((slugs: string[]) => {
    setState((prev) => ({ ...prev, selectedSlugs: slugs }))
  }, [])

  const setActiveTab = useCallback((tab: CompareTab) => {
    setState((prev) => ({ ...prev, activeTab: tab }))
  }, [])

  const setDrilldownCategory = useCallback((category: string | null) => {
    setState((prev) => ({ ...prev, drilldownCategory: category }))
  }, [])

  return {
    ...state,
    setSelectedSlugs,
    setActiveTab,
    setDrilldownCategory,
  }
}
