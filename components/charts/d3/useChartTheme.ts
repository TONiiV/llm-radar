"use client"

import { useState, useEffect } from "react"

export interface ChartTheme {
  textPrimary: string
  textSecondary: string
  textMuted: string
  borderColor: string
  bgCard: string
  accentBlue: string
  accentOrange: string
  isDark: boolean
}

function readTheme(): ChartTheme {
  if (typeof window === "undefined") {
    return {
      textPrimary: "#0F0F0F",
      textSecondary: "#555555",
      textMuted: "#888888",
      borderColor: "#D1CEC7",
      bgCard: "#E8E4D8",
      accentBlue: "#2B6CB0",
      accentOrange: "#C05621",
      isDark: false,
    }
  }

  const style = getComputedStyle(document.documentElement)
  const get = (name: string) => style.getPropertyValue(name).trim()
  const isDark = document.documentElement.classList.contains("dark")

  return {
    textPrimary: get("--text-primary") || (isDark ? "#E8E4D8" : "#0F0F0F"),
    textSecondary: get("--text-secondary") || (isDark ? "#A09C8F" : "#555555"),
    textMuted: get("--text-muted") || (isDark ? "#706C5F" : "#888888"),
    borderColor: get("--border-color") || (isDark ? "#3A3630" : "#D1CEC7"),
    bgCard: get("--bg-card") || (isDark ? "#242018" : "#E8E4D8"),
    accentBlue: get("--accent-blue") || (isDark ? "#4A90D9" : "#2B6CB0"),
    accentOrange: get("--accent-orange") || (isDark ? "#E07A3A" : "#C05621"),
    isDark,
  }
}

export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(readTheme)

  useEffect(() => {
    setTheme(readTheme())

    const observer = new MutationObserver(() => {
      setTheme(readTheme())
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [])

  return theme
}
