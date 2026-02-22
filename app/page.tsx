"use client"

import Link from "next/link"
import { useMemo, useState, useEffect } from "react"
import { getModelWithScores, getCategories, getProviders } from "@/lib/data"
import { CATEGORY_ICONS } from "@/components/icons/CategoryIcons"
import { useLocale } from "@/lib/i18n-context"
import LocaleToggle from "@/components/LocaleToggle"
import { ThemeToggle } from "@/components/ThemeProvider"
import { getCategoryColor } from "@/lib/colors"

/* ─── Typewriter effect for the CRT terminal ─── */
function TypewriterLine({ text, delay }: { text: string; delay: number }) {
  const [displayed, setDisplayed] = useState("")
  const [done, setDone] = useState(false)

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    let i = 0

    const startTimeout = setTimeout(() => {
      const tick = () => {
        if (i < text.length) {
          setDisplayed(text.slice(0, i + 1))
          i++
          timeout = setTimeout(tick, 40)
        } else {
          setDone(true)
        }
      }
      tick()
    }, delay)

    return () => {
      clearTimeout(startTimeout)
      clearTimeout(timeout)
    }
  }, [text, delay])

  return (
    <span>
      {displayed}
      {!done && <span className="cursor-blink" />}
    </span>
  )
}

/* ─── Category dimension config ─── */
const DIMENSION_COLORS: Record<string, string> = {
  reasoning: "#2B6CB0",
  coding: "#22C55E",
  math: "#F59E0B",
  chat: "#8B5CF6",
  agentic: "#F43F5E",
}

export default function Home() {
  const models = useMemo(() => getModelWithScores(), [])
  const categories = useMemo(() => getCategories(), [])
  const providers = useMemo(() => getProviders(), [])
  const sorted = useMemo(() => [...models].sort((a, b) => b.compositeScore - a.compositeScore), [models])
  const { t, getCategoryLabel } = useLocale()

  const categoryKeys = Object.keys(categories)

  // Top 3 models for CRT terminal display
  const topModels = sorted.slice(0, 3)

  // Provider lookup
  const providerMap = useMemo(() => {
    const map: Record<string, { name: string; color: string }> = {}
    providers.forEach((p) => {
      map[p.slug] = { name: p.name, color: p.color }
    })
    return map
  }, [providers])

  return (
    <div className="min-h-screen">
      {/* ─── Header ─── */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="font-heading text-2xl tracking-[3px] text-txt-primary">
            LLMRadar
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/compare" className="font-body text-sm text-txt-secondary hover:text-txt-primary transition-colors">
              {t("nav.compare")}
            </Link>
            <Link href="/models" className="font-body text-sm text-txt-secondary hover:text-txt-primary transition-colors">
              Models
            </Link>
            <Link href="/about" className="font-body text-sm text-txt-secondary hover:text-txt-primary transition-colors">
              About
            </Link>
            <LocaleToggle />
            <ThemeToggle />
          </nav>
        </div>
      </header>

      {/* ─── Hero Section ─── */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left column */}
          <div>
            <span className="inline-block bg-inverted text-txt-inverted px-3 py-1 tracking-[2px] text-sm font-mono mb-8">
              LLM CAPABILITY RADAR
            </span>
            <h1 className="mb-6">
              <span className="block font-heading text-7xl text-txt-primary">Introducing</span>
              <span className="block font-heading text-7xl italic text-txt-primary">LLM Radar.</span>
            </h1>
            <p className="text-lg text-txt-secondary mb-10 max-w-lg leading-relaxed font-body">
              {t("home.heroDesc")}
            </p>
            <div className="flex items-center gap-6">
              <Link href="/compare" className="btn-primary px-8 py-4 text-lg inline-block">
                {t("home.cta")}
              </Link>
              <Link href="/models" className="text-accent-blue font-body hover:underline transition-colors">
                {t("home.viewCompare")} →
              </Link>
            </div>
          </div>

          {/* Right column — CRT Terminal */}
          <div className="crt-screen p-1">
            {/* Terminal header */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10">
              <span className="w-3 h-3 rounded-full bg-[#FF5F56]" />
              <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
              <span className="w-3 h-3 rounded-full bg-[#27C93F]" />
              <span className="ml-3 text-xs text-white/40 font-mono">llm-radar v1.0</span>
            </div>
            {/* Terminal body */}
            <div className="p-5 space-y-3 font-mono text-sm">
              <div className="text-white/50">$ llm-radar --top 3</div>
              <div className="text-white/30 text-xs mb-2">Loading models...</div>
              {topModels.map((m, i) => {
                const score = Math.round(m.compositeScore)
                const barWidth = score
                return (
                  <div key={m.slug} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-crt-green">
                        {i + 1}. {m.name}
                      </span>
                      <span className="text-crt-green">{score}/100</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10">
                      <div
                        className="h-full bg-crt-green/70"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              <div className="pt-3 text-crt-green">
                <TypewriterLine text='> compare --radar' delay={1200} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Frontier Models Section ─── */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <div className="section-divider mb-8">
          <h2 className="font-heading text-2xl italic text-txt-primary">{t("home.overview")}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((m) => {
            const provider = providerMap[m.provider]
            return (
              <div key={m.slug} className="paper-card p-5">
                {/* Provider tag */}
                <div className="mb-3">
                  <span
                    className="provider-tag px-2 py-0.5"
                    style={{ color: provider?.color, borderBottom: `2px solid ${provider?.color}` }}
                  >
                    {provider?.name ?? m.provider}
                  </span>
                </div>

                {/* Model name */}
                <h3 className="font-heading text-xl text-txt-primary mb-1">{m.name}</h3>

                {/* Tags */}
                <div className="flex gap-1.5 mb-4">
                  {m.is_open_source && (
                    <span className="text-[10px] px-1.5 py-0.5 border border-score-high text-score-high font-mono tracking-wider">
                      {t("home.openSource")}
                    </span>
                  )}
                  {m.is_reasoning_model && (
                    <span className="text-[10px] px-1.5 py-0.5 border border-score-mid text-score-mid font-mono tracking-wider">
                      {t("home.reasoningModel")}
                    </span>
                  )}
                </div>

                {/* Score + Price */}
                <div className="flex items-end justify-between pt-3 border-t border-border">
                  <div>
                    <div className="text-xs text-txt-muted mb-0.5">{t("home.composite")}</div>
                    <span className="font-mono text-3xl text-txt-primary">{Math.round(m.compositeScore)}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-txt-muted mb-0.5">{t("home.price")}</div>
                    <span className="font-mono text-sm text-txt-secondary">
                      {m.pricing.confirmed ? "" : "~"}${m.pricing.input_per_1m}/{m.pricing.confirmed ? "" : "~"}${m.pricing.output_per_1m}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ─── Five Dimensions Section ─── */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <div className="section-divider mb-8">
          <h2 className="font-heading text-2xl italic text-txt-primary">Five Dimensions</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {categoryKeys.map((key) => {
            const cat = categories[key]
            const Icon = CATEGORY_ICONS[key]
            const color = DIMENSION_COLORS[key] || getCategoryColor(key)
            return (
              <div key={key} className="paper-card p-4 text-center">
                <div className="flex justify-center mb-3">
                  {Icon && <Icon size={28} style={{ color }} />}
                </div>
                <h3 className="font-heading text-lg text-txt-primary mb-2" style={{ color }}>
                  {getCategoryLabel(key)}
                </h3>
                <ul className="space-y-1">
                  {cat.benchmarks.map((bm) => (
                    <li key={bm.key} className="font-mono text-sm text-txt-muted">
                      {bm.label}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="bg-inverted text-txt-inverted">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="font-heading text-xl tracking-[3px]">LLMRadar</div>
            <div className="flex gap-6 font-mono text-sm">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline opacity-70 hover:opacity-100 transition-opacity"
              >
                GitHub
              </a>
              <span className="opacity-70">Data Sources</span>
              <span className="opacity-70">API</span>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-white/10 font-mono text-xs opacity-50">
            {t("home.footer")}
          </div>
        </div>
      </footer>
    </div>
  )
}
