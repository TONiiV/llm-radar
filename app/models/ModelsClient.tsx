"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useLocale } from "@/lib/i18n-context"
import Navbar from "@/components/Navbar"
import { getCategoryColor } from "@/lib/colors"
import type { ModelWithScores, Categories, Provider } from "@/lib/types"

type SortKey = "score" | "name" | "price"
type FilterTag = "all" | "open_source" | "reasoning" | "multimodal" | "vision" | "tool_use" | "long_context"

const FILTER_TAGS: { key: FilterTag; zhLabel: string; enLabel: string }[] = [
  { key: "all", zhLabel: "全部", enLabel: "All" },
  { key: "open_source", zhLabel: "开源", enLabel: "Open Source" },
  { key: "reasoning", zhLabel: "推理模型", enLabel: "Reasoning" },
  { key: "multimodal", zhLabel: "多模态", enLabel: "Multimodal" },
  { key: "vision", zhLabel: "视觉", enLabel: "Vision" },
  { key: "tool_use", zhLabel: "工具调用", enLabel: "Tool Use" },
  { key: "long_context", zhLabel: "长上下文", enLabel: "Long Context" },
]

function matchesFilter(model: ModelWithScores, filter: FilterTag): boolean {
  if (filter === "all") return true
  if (filter === "open_source") return model.is_open_source
  if (filter === "reasoning") return model.is_reasoning_model
  const tagMap: Record<string, string> = {
    multimodal: "multimodal",
    vision: "vision",
    tool_use: "tool_use",
    long_context: "long_context",
  }
  return model.tags.includes(tagMap[filter] ?? filter)
}

interface Props {
  models: ModelWithScores[]
  categories: Categories
  providers: Provider[]
}

export default function ModelsClient({ models, categories, providers }: Props) {
  const { t, getCategoryLabel, locale } = useLocale()

  const [search, setSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState<FilterTag>("all")
  const [sortKey, setSortKey] = useState<SortKey>("score")

  const providerMap = useMemo(() => {
    const map: Record<string, { name: string; color: string }> = {}
    providers.forEach((p) => {
      map[p.slug] = { name: p.name, color: p.color }
    })
    return map
  }, [providers])

  const categoryKeys = Object.keys(categories)

  const filtered = useMemo(() => {
    let list = models

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.provider.toLowerCase().includes(q) ||
          (providerMap[m.provider]?.name ?? "").toLowerCase().includes(q)
      )
    }

    list = list.filter((m) => matchesFilter(m, activeFilter))

    list = [...list].sort((a, b) => {
      if (sortKey === "score") {
        // Primary: more data → ranked higher
        const dataDiff = (b.availableBenchmarks ?? 0) - (a.availableBenchmarks ?? 0)
        if (dataDiff !== 0) return dataDiff
        // Secondary: higher score within same completeness tier
        return b.compositeScore - a.compositeScore
      }
      if (sortKey === "name") return a.name.localeCompare(b.name)
      const avgA = (a.pricing.input_per_1m + a.pricing.output_per_1m) / 2
      const avgB = (b.pricing.input_per_1m + b.pricing.output_per_1m) / 2
      return avgA - avgB
    })

    return list
  }, [models, search, activeFilter, sortKey, providerMap])

  const isZh = locale === "zh"

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-heading text-4xl text-txt-primary mb-2">
            {isZh ? "模型列表" : "Model Directory"}
          </h1>
          <p className="font-body text-txt-secondary">
            {isZh ? "浏览所有模型的能力评分与价格信息" : "Browse capability scores and pricing for all models"}
          </p>
        </div>

        {/* Search + Sort */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isZh ? "搜索模型名或供应商..." : "Search model or provider..."}
              className="w-full pl-10 pr-4 py-2.5 bg-bg-card border border-border rounded-lg font-body text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-2 focus:ring-accent-blue/30 focus:border-accent-blue transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-txt-muted font-body whitespace-nowrap">{isZh ? "排序:" : "Sort:"}</span>
            {([
              { key: "score" as SortKey, label: isZh ? "Radar Score" : "Radar Score" },
              { key: "name" as SortKey, label: isZh ? "名称" : "Name" },
              { key: "price" as SortKey, label: isZh ? "价格" : "Price" },
            ]).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortKey(opt.key)}
                className={`px-3 py-1.5 text-xs font-mono rounded-md border transition-colors ${
                  sortKey === opt.key
                    ? "border-accent-blue text-accent-blue bg-accent-blue/10"
                    : "border-border text-txt-muted hover:text-txt-secondary hover:border-txt-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Tags */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
          {FILTER_TAGS.map((tag) => (
            <button
              key={tag.key}
              onClick={() => setActiveFilter(tag.key)}
              className={`px-3 py-1.5 text-xs font-mono rounded-full border whitespace-nowrap transition-colors ${
                activeFilter === tag.key
                  ? "border-accent-blue text-accent-blue bg-accent-blue/10"
                  : "border-border text-txt-muted hover:text-txt-secondary hover:border-txt-muted"
              }`}
            >
              {isZh ? tag.zhLabel : tag.enLabel}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <span className="text-xs text-txt-muted font-mono">{filtered.length} {isZh ? "个模型" : "models"}</span>
        </div>

        {/* Model Cards Grid */}
        {filtered.length === 0 ? (
          <div className="paper-card-flat p-12 text-center">
            <p className="font-body text-txt-muted text-lg mb-2">{isZh ? "没有找到匹配的模型" : "No models found"}</p>
            <p className="font-body text-txt-muted text-sm">{isZh ? "尝试调整搜索或筛选条件" : "Try adjusting your search or filters"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((m) => {
              const provider = providerMap[m.provider]
              return (
                <div key={m.slug} className="paper-card p-5 flex flex-col">
                  <div className="mb-3">
                    <span className="provider-tag px-2 py-0.5" style={{ color: provider?.color, borderBottom: `2px solid ${provider?.color}` }}>
                      {provider?.name ?? m.provider}
                    </span>
                  </div>
                  <h3 className="font-heading text-xl text-txt-primary mb-1.5">{m.name}</h3>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {m.is_open_source && (
                      <span className="text-[10px] px-1.5 py-0.5 border border-score-high text-score-high font-mono tracking-wider">{t("home.openSource")}</span>
                    )}
                    {m.is_reasoning_model && (
                      <span className="text-[10px] px-1.5 py-0.5 border border-score-mid text-score-mid font-mono tracking-wider">{t("home.reasoningModel")}</span>
                    )}
                    {m.tags.filter((tag) => tag !== "frontier").slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 border border-border text-txt-muted font-mono tracking-wider">{tag}</span>
                    ))}
                  </div>
                  <div className="space-y-1.5 mb-4">
                    {categoryKeys.map((key) => {
                      const cat = m.categoryScores[key]
                      if (!cat) return null
                      return (
                        <div key={key} className="flex items-center gap-1.5">
                          <span className="text-[10px] w-8 text-txt-muted font-mono">{getCategoryLabel(key).slice(0, 2)}</span>
                          <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${cat.score}%`, backgroundColor: getCategoryColor(key), opacity: cat.isReliable ? 1 : 0.4 }} />
                          </div>
                          <span className="text-[10px] font-mono text-txt-muted w-5 text-right">{Math.round(cat.score)}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-auto pt-3 border-t border-border">
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-xs text-txt-muted mb-0.5">{t("home.composite")}</div>
                        <span className="font-mono text-3xl text-txt-primary">{Math.round(m.compositeScore)}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-txt-muted mb-0.5">{t("home.price")}</div>
                        <div className="font-mono text-sm text-txt-secondary">
                          <span className="text-[10px] text-txt-muted">in </span>
                          {m.pricing.confirmed ? "" : "~"}${m.pricing.input_per_1m}
                          <span className="text-txt-muted mx-1">/</span>
                          <span className="text-[10px] text-txt-muted">out </span>
                          {m.pricing.confirmed ? "" : "~"}${m.pricing.output_per_1m}
                        </div>
                      </div>
                    </div>
                    {(m.availableBenchmarks ?? 0) < (m.totalBenchmarks ?? 12) && (
                      <div className="mt-2 text-[10px] font-mono text-txt-muted opacity-60">
                        {m.availableBenchmarks ?? 0}/{m.totalBenchmarks ?? 12} {isZh ? "基准数据" : "benchmarks"}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border">
                    <Link href={`/models/${m.slug}`} className="text-xs font-body text-accent-blue hover:underline transition-colors">
                      {isZh ? "查看详情" : "View Details"} &rarr;
                    </Link>
                    <Link href={`/compare?ids=${m.slug}`} className="text-xs font-body text-txt-muted hover:text-txt-secondary transition-colors">
                      {isZh ? "加入对比" : "Add to Compare"}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      <footer className="bg-inverted text-txt-inverted mt-16">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="font-heading text-xl tracking-[3px]">LLMRadar</div>
            <div className="flex gap-6 font-mono text-sm">
              <a href="https://github.com/TONiiV/llm-radar" target="_blank" rel="noopener noreferrer" className="hover:underline opacity-70 hover:opacity-100 transition-opacity">GitHub</a>
              <Link href="/compare" className="hover:underline opacity-70 hover:opacity-100 transition-opacity">Compare</Link>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-white/10 font-mono text-xs opacity-50">{t("home.footer")}</div>
        </div>
      </footer>
    </div>
  )
}
