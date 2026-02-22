"use client"

import { useCallback, useEffect, useState } from "react"

export type CompareTab = "radar" | "scatter" | "ranking"

interface UrlParamsState {
  selectedSlugs: string[]
  activeTab: CompareTab
  drilldownCategory: string | null
}

const DEFAULT_SELECTED = [
  "claude-opus-46",
  "gpt-52",
  "gemini-3-pro",
  "deepseek-v32",
  "llama-4-maverick",
]

function parseParams(): UrlParamsState {
  if (typeof window === "undefined") {
    return { selectedSlugs: DEFAULT_SELECTED, activeTab: "radar", drilldownCategory: null }
  }

  const params = new URLSearchParams(window.location.search)
  const ids = params.get("ids")
  const tab = params.get("tab") as CompareTab | null
  const drill = params.get("drill")

  return {
    selectedSlugs: ids ? ids.split(",").filter(Boolean) : DEFAULT_SELECTED,
    activeTab: tab && ["radar", "scatter", "ranking"].includes(tab) ? tab : "radar",
    drilldownCategory: drill || null,
  }
}

function updateUrl(state: UrlParamsState) {
  if (typeof window === "undefined") return

  const params = new URLSearchParams()

  // Only set ids if different from default
  const isDefault =
    state.selectedSlugs.length === DEFAULT_SELECTED.length &&
    state.selectedSlugs.every((s) => DEFAULT_SELECTED.includes(s))

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

export function useUrlParams() {
  const [state, setState] = useState<UrlParamsState>(parseParams)

  // Sync to URL on state change
  useEffect(() => {
    updateUrl(state)
  }, [state])

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
