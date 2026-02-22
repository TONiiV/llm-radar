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
  const [locale, setLocaleState] = useState<Locale>("zh")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("locale") as Locale | null
    if (saved === "zh" || saved === "en") {
      setLocaleState(saved)
    }
    setMounted(true)
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

  // Prevent hydration mismatch by rendering children only after mount
  if (!mounted) {
    return null
  }

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
