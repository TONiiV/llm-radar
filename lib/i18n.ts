export type Locale = "zh" | "en"

const translations = {
  zh: {
    meta: {
      title: "LLMRadar — LLM 能力雷达",
      description: "LLM 模型能力对比与价格分析工具：五维雷达图 + 价格性价比散点图",
    },
    nav: {
      compare: "对比",
    },
    home: {
      heroDesc:
        "LLM 模型能力对比与价格分析工具。五维雷达图展示推理、代码、数学、对话、Agent 能力，散点图分析价格性价比。",
      cta: "开始对比",
      viewCompare: "查看详细对比",
      overview: "模型总览",
      rank: "#",
      model: "模型",
      composite: "综合",
      price: "价格",
      openSource: "开源",
      closedSource: "闭源",
      reasoningModel: "推理模型",
      weight: "权重",
      footer: "LLMRadar — 数据来源: Artificial Analysis, LMArena, OpenRouter",
    },
    compare: {
      tabRadar: "能力雷达",
      tabScatter: "价格性价比",
      tabRanking: "排行榜",
      radarTitle: "五维能力雷达图",
      radarDesc: "点击轴标签可查看该维度的详细 Benchmark 分数",
      scatterTitle: "价格性价比散点图",
      scatterDesc:
        "X 轴: 每百万 token 均价 (log scale) | Y 轴: 综合能力分 | 绿框 = Pareto 前沿",
      rankingTitle: "Benchmark 排行榜",
      rankingDesc: "选择单项 Benchmark 查看所有模型排名",
      model: "模型",
      composite: "综合",
      inputPrice: "输入$/1M",
      outputPrice: "输出$/1M",
      emptyState: "请在左侧选择至少一个模型",
    },
    drilldown: {
      close: "收起",
      normalizedScore: "归一化分数",
      coverage: "数据完整度",
      dataInsufficient: "数据不足",
      dataIncomplete: "数据不完整",
      items: "项",
      selectBenchmark: "选择 Benchmark",
      rank: "排名",
      score: "分数",
    },
    selector: {
      title: "选择模型",
      search: "搜索模型...",
      maxModels: "最多选择 {n} 个模型",
      presetFrontier: "Frontier Top 5",
      presetValue: "性价比之选",
      presetOpenSource: "开源模型",
      openSource: "开源",
      reasoning: "推理",
    },
    chart: {
      overallAbility: "综合能力",
      input: "输入",
      output: "输出",
      avgPrice: "均价",
      paretoFrontier: "Pareto 前沿",
      reasoningModel: "推理模型",
      avgPriceAxis: "每百万 token 均价 (log scale)",
      compositeAxis: "综合能力分",
    },
    categories: {
      reasoning: "推理",
      coding: "代码",
      math: "数学",
      chat: "对话",
      agentic: "Agent",
    },
  },
  en: {
    meta: {
      title: "LLMRadar — LLM Capability Radar",
      description:
        "LLM model comparison & pricing analysis: 5-axis radar chart + price-performance scatter plot",
    },
    nav: {
      compare: "Compare",
    },
    home: {
      heroDesc:
        "LLM model comparison and pricing analysis tool. Five-axis radar chart for Reasoning, Coding, Math, Chat, and Agent capabilities, plus price-performance scatter plot.",
      cta: "Start Comparing",
      viewCompare: "View Detailed Comparison",
      overview: "Model Overview",
      rank: "#",
      model: "Model",
      composite: "Overall",
      price: "Price",
      openSource: "Open Source",
      closedSource: "Closed Source",
      reasoningModel: "Reasoning Model",
      weight: "Weight",
      footer: "LLMRadar — Data: Artificial Analysis, LMArena, OpenRouter",
    },
    compare: {
      tabRadar: "Capability Radar",
      tabScatter: "Price-Performance",
      tabRanking: "Rankings",
      radarTitle: "Five-Axis Capability Radar",
      radarDesc: "Click axis labels to see detailed benchmark scores",
      scatterTitle: "Price-Performance Scatter",
      scatterDesc:
        "X: Avg price per 1M tokens (log) | Y: Overall score | Green = Pareto frontier",
      rankingTitle: "Benchmark Rankings",
      rankingDesc: "Select a benchmark to see all models ranked",
      model: "Model",
      composite: "Overall",
      inputPrice: "In $/1M",
      outputPrice: "Out $/1M",
      emptyState: "Select at least one model from the sidebar",
    },
    drilldown: {
      close: "Close",
      normalizedScore: "Normalized Score",
      coverage: "Data Coverage",
      dataInsufficient: "Insufficient Data",
      dataIncomplete: "Incomplete Data",
      items: "items",
      selectBenchmark: "Select Benchmark",
      rank: "Rank",
      score: "Score",
    },
    selector: {
      title: "Select Models",
      search: "Search models...",
      maxModels: "Max {n} models",
      presetFrontier: "Frontier Top 5",
      presetValue: "Best Value",
      presetOpenSource: "Open Source",
      openSource: "OSS",
      reasoning: "Reason",
    },
    chart: {
      overallAbility: "Overall",
      input: "Input",
      output: "Output",
      avgPrice: "Avg",
      paretoFrontier: "Pareto Frontier",
      reasoningModel: "Reasoning Model",
      avgPriceAxis: "Avg price per 1M tokens (log scale)",
      compositeAxis: "Overall Score",
    },
    categories: {
      reasoning: "Reasoning",
      coding: "Coding",
      math: "Math",
      chat: "Chat",
      agentic: "Agent",
    },
  },
} as const

type TranslationTree = typeof translations.zh

/** Dot-notation key for the translation tree, e.g. "home.cta" */
type FlatKeys<T, Prefix extends string = ""> = T extends string
  ? Prefix
  : {
      [K in keyof T & string]: FlatKeys<T[K], Prefix extends "" ? K : `${Prefix}.${K}`>
    }[keyof T & string]

export type TranslationKey = FlatKeys<TranslationTree>

function getNestedValue(obj: any, path: string): string {
  return path.split(".").reduce((acc, key) => acc?.[key], obj) ?? path
}

export function t(locale: Locale, key: TranslationKey): string {
  return getNestedValue(translations[locale], key)
}

export function getCategoryLabel(locale: Locale, categoryKey: string): string {
  const map = translations[locale].categories as Record<string, string>
  return map[categoryKey] ?? categoryKey
}
