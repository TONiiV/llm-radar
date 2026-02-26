"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { type Locale, type TranslationKey, t as translate, getCategoryLabel as getCatLabel } from "./i18n"

interface LocaleContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: TranslationKey) => string
  getCategoryLabel: (key: string) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Default to "zh" — matches server-side default, avoids blank flash
  const [locale, setLocaleState] = useState<Locale>("zh")

  useEffect(() => {
    // After mount, sync locale from localStorage (client-only)
    const saved = localStorage.getItem("locale") as Locale | null
    if (saved === "zh" || saved === "en") {
      setLocaleState(saved)
    }
  }, [])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    localStorage.setItem("locale", l)
    document.documentElement.lang = l === "zh" ? "zh-CN" : "en"
  }, [])

  const tFn = useCallback(
    (key: TranslationKey) => translate(locale, key),
    [locale]
  )

  const getCategoryLabelFn = useCallback(
    (key: string) => getCatLabel(locale, key),
    [locale]
  )

  // Render immediately with default locale — no blank flash
  return (
    <LocaleContext.Provider
      value={{ locale, setLocale, t: tFn, getCategoryLabel: getCategoryLabelFn }}
    >
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider")
  return ctx
}
