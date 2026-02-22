"use client"

import { useLocale } from "@/lib/i18n-context"

export default function LocaleToggle() {
  const { locale, setLocale } = useLocale()

  return (
    <div className="glass-card-sm flex p-0.5 text-xs font-medium">
      <button
        onClick={() => setLocale("zh")}
        className={`px-2 py-1 rounded-md transition-colors ${
          locale === "zh"
            ? "bg-accent-blue/20 text-accent-blue"
            : "text-txt-muted hover:text-txt-secondary"
        }`}
      >
        ZH
      </button>
      <button
        onClick={() => setLocale("en")}
        className={`px-2 py-1 rounded-md transition-colors ${
          locale === "en"
            ? "bg-accent-blue/20 text-accent-blue"
            : "text-txt-muted hover:text-txt-secondary"
        }`}
      >
        EN
      </button>
    </div>
  )
}
