# LLMRadar — Build Plan v3 (Refined)

> LLM 能力雷达 + 价格性价比分析工具
> 分层能力展示：大类雷达图 → 点击下钻具体 Benchmark

> **v3 变更摘要**：
> - 新增 ISR/revalidation 机制解决 SSG 与动态数据矛盾
> - Cron 执行方案改用 GitHub Actions（绕过 Vercel Hobby 限制）
> - 归一化策略加入小样本 fallback（模型数 <30 用 scaled rank）
> - 效率维度拆分为「速度 Speed」和独立的「价格性价比散点图」
> - 数据库约束修正（UNIQUE、清理策略、幂等写入）
> - Admin 认证方案：Supabase Auth（Magic Link）
> - 开发计划重排：Phase 1 用纯 JSON 跑通前端，Supabase 延后

---

## 1. Tech Stack

| 层 | 选型 | 备注 |
|---|---|---|
| Framework | Next.js 14 (App Router, **ISR**) | 默认 `revalidate: 3600`，cron 完成后 on-demand revalidate |
| UI | Tailwind CSS + shadcn/ui | |
| Charts | Recharts (radar, scatter, bar) | 自定义 tick component 实现轴点击 |
| DB | Supabase Postgres (Free tier) | Phase 1 用纯 JSON，Phase 3 迁移 |
| Deploy | Vercel (Hobby) | git push 自动部署 |
| 价格数据 | OpenRouter API + LiteLLM JSON | 全自动 |
| Benchmark 数据 | Artificial Analysis 解析 + LLM 辅助提取 | 半自动，需人工确认 |
| **Cron** | **GitHub Actions** (免费) | 每天 UTC 0:00，无执行时间限制 |
| Admin Auth | Supabase Auth (Magic Link) | 仅允许白名单邮箱 |

**预计成本：< $1/月**（Vercel Hobby + Supabase Free + LLM 提取 ~$0.30/月）

### 关键架构决策：SSG → ISR + On-Demand Revalidation

**问题**：原计划 SSG 静态生成与每日 cron 数据更新矛盾——SSG 页面不会感知数据库变化。

**方案**：

```
数据页面（/compare, /models）:
  → ISR: revalidate = 3600 (1小时兜底)
  → Cron 完成后调用 on-demand revalidation API

纯静态页面（/, /about）:
  → 标准 SSG，无需 revalidate
```

```typescript
// app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { secret } = await request.json()
  if (secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 数据更新后刷新所有动态页面
  revalidatePath('/compare', 'page')
  revalidatePath('/models', 'page')
  revalidatePath('/models/[slug]', 'page')

  return NextResponse.json({ revalidated: true })
}
```

### 关键架构决策：Cron 改用 GitHub Actions

**问题**：Vercel Hobby 只支持 1 个 cron job，Edge Runtime 最长 10s / Serverless 最长 60s，pipeline 全部跑完不够用。Edge Runtime 还不支持 Node.js 原生模块（Anthropic SDK 跑不了）。

**方案**：GitHub Actions 免费，无执行时间限制，适合这种重型 pipeline。

```yaml
# .github/workflows/update-data.yml
name: Daily Data Update
on:
  schedule:
    - cron: '0 0 * * *'  # 每天 UTC 0:00
  workflow_dispatch: {}    # 支持手动触发

jobs:
  update:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci

      # Step 1: 拉取数据 → staging
      - name: Fetch OpenRouter
        run: npx tsx scripts/cron/fetch-openrouter.ts
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}

      - name: Fetch LiteLLM
        run: npx tsx scripts/cron/fetch-litellm.ts
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}

      # Step 2: 交叉验证 + 合并
      - name: Validate and Merge
        run: npx tsx scripts/cron/validate-and-merge.ts
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}

      # Step 3: 重算归一化分数
      - name: Recalculate Scores
        run: npx tsx scripts/cron/recalculate-scores.ts
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}

      # Step 4: 触发 Vercel 页面刷新
      - name: Revalidate Vercel Pages
        run: |
          curl -X POST "$VERCEL_URL/api/revalidate" \
            -H "Content-Type: application/json" \
            -d '{"secret": "${{ secrets.REVALIDATION_SECRET }}"}'
        env:
          VERCEL_URL: ${{ secrets.VERCEL_URL }}

      # Step 5: 可选 — LLM 提取（仅周一执行，降低成本）
      - name: LLM Extract (Weekly)
        if: github.event.schedule == '0 0 * * 1' || github.event_name == 'workflow_dispatch'
        run: npx tsx scripts/cron/llm-extract-pricing.ts
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
```

**优势**：
- 无时间限制，每步独立执行，失败可单独重试
- LLM 提取改为每周一次（$0.30/月 → ~$0.08/月）
- 完整日志，GitHub 自带失败通知邮件
- `workflow_dispatch` 支持手动触发调试

---

## 2. 能力分类体系（修订）

**变更**：原「效率 Efficiency」维度拆分。延迟/速度是技术指标，价格是商业指标，混在一起不合理。

**五大能力维度 + 独立价格性价比视图**：

```
🧠 推理 Reasoning               💻 代码 Coding
├── MMLU-Pro (知识与推理)         ├── SWE-Bench Verified (真实工程)
├── GPQA Diamond (研究生级推理)   ├── LiveCodeBench (竞赛编程)
├── Humanity's Last Exam (极限)   ├── Terminal-Bench Hard (终端操作)
└── CritPt (批判性思维)           └── SciCode (科学计算编程)

📐 数学 Math                     💬 对话与指令 Chat & Instruction
├── AIME 2025 (奥赛数学)         ├── LMArena ELO (人类盲测偏好)
├── MATH (竞赛数学)               ├── IFBench (指令遵循)
└── GSM8K (应用题)                └── AlpacaEval (指令遵循)

🤖 Agent 能力 Agentic             ⚡ 速度 Speed (原效率维度，去掉价格)
├── τ²-Bench Telecom (对话Agent)  ├── TTFT (首 token 延迟)
├── GDPval-AA (44职业真实任务)    ├── TPS (生成速度 tokens/sec)
└── AA-LCR (长上下文推理)        └── Latency P95 (尾部延迟)

💰 价格性价比 → 独立散点图视图（不进雷达图）
   X轴: 价格 (log scale)
   Y轴: 综合能力分 (5维加权)
   标注 Pareto 前沿线
```

**理由**：
- 雷达图 5 维比 6 维更对称美观（正五边形）
- 价格作为独立维度用散点图展示更直观（价格有几个数量级的跨度，雷达图上压缩后失去信息）
- 用户可以先看雷达图了解"谁更强"，再看散点图了解"谁更值"

---

## 3. Database Schema（修订）

### 修复项

1. **`benchmark_scores` UNIQUE 约束**：改为 `UNIQUE(model_id, benchmark_key, source)` — 同一来源同一分数不应重复
2. **`prices` 表加幂等约束**：`UNIQUE(model_id, recorded_at::date)` 防止同天重复
3. **staging 表加清理策略**：30 天自动清理已处理记录
4. **`model_name_mappings` 初始数据**：seed 阶段一起灌入

```sql
-- ============================================
-- 核心数据表
-- ============================================

-- 服务商表
CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  color TEXT,
  logo_url TEXT,
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 模型表
CREATE TABLE models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  provider_id UUID REFERENCES providers(id),
  context_window_input INT,
  context_window_output INT,
  status TEXT DEFAULT 'active',       -- 'active' | 'deprecated' | 'preview'
  is_open_source BOOLEAN DEFAULT false,
  is_reasoning_model BOOLEAN DEFAULT false,  -- ← 新增: R1/o1 等推理模型标记
  release_date DATE,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Benchmark 定义表
CREATE TABLE benchmark_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL,             -- 'reasoning' | 'coding' | 'math' | 'chat' | 'agentic' | 'speed'
  description TEXT,
  higher_is_better BOOLEAN DEFAULT true,
  max_possible_score NUMERIC,
  unit TEXT,                          -- ← 新增: '%', 'ms', 'tokens/s', 'ELO'（用于 L2 展示）
  weight NUMERIC DEFAULT 1.0,         -- ← 新增: 类内权重
  source_url TEXT,
  display_order INT DEFAULT 0
);

-- Benchmark 分数表
CREATE TABLE benchmark_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES models(id) ON DELETE CASCADE,
  benchmark_key TEXT REFERENCES benchmark_definitions(key),
  raw_score NUMERIC NOT NULL,
  normalized_score NUMERIC,
  recorded_at TIMESTAMPTZ DEFAULT now(),
  source TEXT DEFAULT 'official',
  -- 修正: 同一来源同一模型同一 benchmark 不应重复
  UNIQUE(model_id, benchmark_key, source)
);

-- 价格表
CREATE TABLE prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES models(id) ON DELETE CASCADE,
  input_price_per_1m NUMERIC NOT NULL,
  output_price_per_1m NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT now(),
  -- 修正: 同一模型同一天最多一条价格记录（幂等）
  UNIQUE(model_id, (recorded_at::date))
);

-- ============================================
-- 数据自动化相关表
-- ============================================

-- 数据源注册
CREATE TABLE data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  url TEXT,
  fetch_frequency TEXT DEFAULT 'daily',
  last_fetched_at TIMESTAMPTZ,
  last_status TEXT DEFAULT 'pending',
  last_error TEXT,                    -- ← 新增: 记录最后一次失败原因
  consecutive_failures INT DEFAULT 0, -- ← 新增: 连续失败计数，>3 自动 disable
  status TEXT DEFAULT 'active'
);

-- 价格暂存表
CREATE TABLE staging_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT REFERENCES data_sources(key),
  model_name TEXT NOT NULL,
  input_price_per_1m NUMERIC,
  output_price_per_1m NUMERIC,
  context_window INT,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'pending',
  processed_at TIMESTAMPTZ,           -- ← 新增: 处理时间
  validation_notes TEXT
);

-- Benchmark 暂存表
CREATE TABLE staging_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT REFERENCES data_sources(key),
  model_name TEXT NOT NULL,
  benchmark_key TEXT,
  raw_score NUMERIC,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  validation_notes TEXT
);

-- 模型名称映射
CREATE TABLE model_name_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT REFERENCES data_sources(key),
  external_name TEXT NOT NULL,
  model_id UUID REFERENCES models(id),
  UNIQUE(source_key, external_name)
);

-- ============================================
-- 索引
-- ============================================
CREATE INDEX idx_scores_model ON benchmark_scores(model_id);
CREATE INDEX idx_scores_benchmark ON benchmark_scores(benchmark_key);
CREATE INDEX idx_prices_model ON prices(model_id);
CREATE INDEX idx_prices_date ON prices(recorded_at);
CREATE INDEX idx_models_status ON models(status);
CREATE INDEX idx_staging_prices_status ON staging_prices(status);
CREATE INDEX idx_staging_benchmarks_status ON staging_benchmarks(status);

-- ============================================
-- Staging 表自动清理（保留 30 天）
-- ============================================
-- 由 GitHub Actions 每周执行一次:
-- DELETE FROM staging_prices WHERE processed_at < now() - interval '30 days';
-- DELETE FROM staging_benchmarks WHERE processed_at < now() - interval '30 days';

-- ============================================
-- Admin 认证 (Supabase Auth)
-- ============================================
-- 使用 Supabase Auth Magic Link，白名单邮箱：
-- ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
-- Admin 页面通过 Supabase Auth session 保护

-- RLS Policies
ALTER TABLE staging_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging_benchmarks ENABLE ROW LEVEL SECURITY;
-- 公开读（API 用 service_role key）
-- Admin 写操作需要 authenticated session
```

---

## 4. 归一化策略（修订）

**问题**：Percentile Rank 在模型数量少时粒度太粗。5 个模型只有 0/25/50/75/100 五档。

**方案**：Scaled Rank — 小样本时平滑，大样本时趋近 percentile。

```typescript
// lib/normalize.ts

/**
 * 归一化策略：根据样本量自动选择
 * - n < 10: Scaled Rank (平滑线性插值)
 * - n >= 10 且 < 30: Scaled Rank
 * - n >= 30: Percentile Rank
 */
function normalize(value: number, allValues: number[], higherIsBetter = true): number {
  const sorted = [...allValues].sort((a, b) => a - b)
  const n = sorted.length

  if (n <= 1) return 50 // 只有一个模型，居中

  // Scaled Rank: 线性插值，连续且平滑
  // 比 percentile rank 在小样本时表现更好
  const min = sorted[0]
  const max = sorted[n - 1]

  if (max === min) return 50 // 所有值相同

  let score: number

  if (n < 30) {
    // Scaled Rank: 在 [0, 100] 线性映射
    // 但用排名位置而非原始值，避免极端值拉扯
    const rank = sorted.filter(v => v < value).length
    const ties = sorted.filter(v => v === value).length
    const midRank = rank + (ties - 1) / 2 // 并列取中间排名
    score = (midRank / (n - 1)) * 100
  } else {
    // n >= 30: 标准 Percentile Rank
    const rank = sorted.filter(v => v < value).length
    score = (rank / (n - 1)) * 100
  }

  return higherIsBetter ? score : 100 - score
}

// 大类分数：类内 benchmark 加权平均（自动跳过缺失数据）
interface CategoryResult {
  score: number
  coverage: number     // 0-1, 数据完整度
  isReliable: boolean  // coverage >= 0.5
  benchmarkCount: number
  availableCount: number
}

function categoryScore(
  benchmarks: { key: string; weight: number }[],
  scores: Record<string, number | null>
): CategoryResult {
  let totalWeight = 0, weightedSum = 0, available = 0

  for (const b of benchmarks) {
    if (scores[b.key] != null) {
      weightedSum += scores[b.key]! * b.weight
      totalWeight += b.weight
      available++
    }
  }

  const coverage = available / benchmarks.length

  return {
    score: totalWeight > 0 ? weightedSum / totalWeight : 0,
    coverage,
    isReliable: coverage >= 0.5,  // ← 关键: 低于 50% 标记为不可靠
    benchmarkCount: benchmarks.length,
    availableCount: available,
  }
}

/**
 * 综合总分计算
 * - 仅使用 isReliable 的大类参与总分
 * - 不可靠的大类分数展示但不计入排名
 */
function compositeScore(categories: Record<string, CategoryResult>): {
  score: number
  reliableCategories: number
  totalCategories: number
} {
  const entries = Object.values(categories)
  const reliable = entries.filter(c => c.isReliable)

  if (reliable.length === 0) return { score: 0, reliableCategories: 0, totalCategories: entries.length }

  const avg = reliable.reduce((sum, c) => sum + c.score, 0) / reliable.length

  return {
    score: avg,
    reliableCategories: reliable.length,
    totalCategories: entries.length,
  }
}
```

**数据缺失展示规则**：

| coverage | 雷达图表现 | tooltip |
|----------|-----------|---------|
| ≥ 75% | 实线，正常颜色 | `推理: 82/100 (3/4 项)` |
| 50%–75% | 虚线边框 | `推理: 82/100 (2/4 项) ⚠️ 数据不完整` |
| < 50% | 灰色虚线，不计入总分 | `推理: --/100 (1/4 项) 数据不足` |

---

## 5. 推理型模型的价格处理

**问题**：DeepSeek R1、o1 等推理模型的实际使用成本远高于标价（思考 token 消耗大量输出 token）。

**方案**：增加 "典型查询成本" 估算维度。

```typescript
// lib/pricing.ts

interface PricingDisplay {
  // 原始 API 定价
  inputPer1M: number
  outputPer1M: number

  // 估算典型查询成本（方便用户直觉理解）
  typicalQueryCost: number  // 一次典型查询（1000 input + N output tokens）

  // 推理模型标记
  isReasoningModel: boolean
  reasoningNote?: string  // "推理模型：实际输出 token 可能为普通模型的 3-10x"
}

function estimateTypicalQueryCost(
  inputPricePer1M: number,
  outputPricePer1M: number,
  isReasoningModel: boolean
): number {
  const inputTokens = 1000
  // 推理模型典型输出 ~5000 tokens（含思考链），普通模型 ~500 tokens
  const outputTokens = isReasoningModel ? 5000 : 500

  return (inputTokens * inputPricePer1M + outputTokens * outputPricePer1M) / 1_000_000
}
```

**在散点图中**：
- 提供切换按钮：「API 定价」vs「典型查询成本」
- 推理模型默认用三角形标记（区别于普通模型的圆形）
- hover 时显示详细价格分解

---

## 6. 交互设计（修订）

### L1：大类雷达图（5 维正五边形）

```
         推理 82
        /    \
   Agent 71    代码 91
       |      |
   速度 78    数学 75
        \    /
        对话 88
         ↓
  (价格性价比在独立散点图中展示)
```

- 5 个顶点 = 5 大能力维度
- 多模型半透明填充叠加
- **最多 6 个模型**：超出时 checkbox 禁用 + tooltip "最多选择 6 个模型进行对比"
- 坐标轴标签可点击（自定义 Recharts tick component）
- 低 coverage 维度用虚线 + 灰色显示

### L2：下钻详情面板（按单位分组展示）

**问题**：不同 benchmark 量纲差异大（百分比 vs ELO vs 毫秒），同一柱状图内不可比。

**方案**：下钻面板内按 unit 分组，每组独立 x 轴。

```
┌─ 💻 代码能力 详情 ─────────────────────────────────────┐
│                                                         │
│  准确率 (%)                                             │
│  SWE-Bench      ████████████████░░░ 80.9%              │
│  LiveCodeBench  ██████████████░░░░░ 74.2%              │
│  Terminal-Bench ████████████░░░░░░░ 62.1%              │
│  SciCode        ████████░░░░░░░░░░ 48.7%              │
│                                                         │
│  ● Claude Opus 4.6  ● GPT-5.2  ● Gemini 3 Pro         │
│                                                         │
│  归一化分数: 82/100 (4/4 项 ✓)                          │
│  数据来源: ArtificialAnalysis.ai                        │
└─────────────────────────────────────────────────────────┘

┌─ ⚡ 速度 详情 ──────────────────────────────────────────┐
│                                                         │
│  延迟 (ms, 越低越好)           速度 (tokens/s, 越高越好)│
│  TTFT        ██░░░░ 230ms      TPS    █████████ 142t/s │
│  Latency P95 ████░░ 890ms                               │
│                                                         │
│  ⚠️ 注：延迟受 region 和负载影响，仅供参考              │
└─────────────────────────────────────────────────────────┘
```

### 价格性价比散点图

```
综合  │  ★ Claude Opus 4.6        ◆ = Pareto 前沿
能力  │     ○ Gemini 3 Pro
分    │  ◆ GPT-5.2
(5维) │        ◆ Claude Sonnet 4.5
      │     ○ Grok 4.1
      │            ◆ Haiku 4.5
      │                  ◆ DeepSeek V3.2    △ = 推理模型
      │  △ DeepSeek R1           ◆ Gemini Flash
      │                                ◆ GPT-5 mini
      └──────────────────────────────────────────
        $0.1    $1       $5      $15     $30
              每百万 token 均价 (log scale)

  切换: [API 定价] [典型查询成本]
```

### 模型选择器行为

| 已选数量 | 行为 |
|---------|------|
| 0-5 | 自由勾选 |
| 6 | 新勾选项禁用，显示 tooltip "最多选择 6 个模型" |
| 取消一个 | 重新释放一个名额 |

提供快捷预设按钮：「Frontier Top 5」「性价比之选」「开源模型」「全部 Anthropic」

---

## 7. 数据源 Fallback 策略

**问题**：Artificial Analysis 页面解析是最脆弱环节，LMArena HuggingFace Space API 无稳定性保证。

```
┌─ 数据源健康监控 ──────────────────────────────────────┐
│                                                        │
│  每个数据源维护：                                       │
│  - last_status: 最近一次拉取状态                        │
│  - last_error: 失败原因                                 │
│  - consecutive_failures: 连续失败计数                    │
│                                                        │
│  自动降级规则：                                         │
│  - 失败 1 次: 记录日志，下次重试                        │
│  - 连续失败 3 次: 数据源标记 'failing'，发告警           │
│  - 连续失败 7 次: 自动 disable，不再尝试                │
│  - 恢复: 手动在 Admin 面板 re-enable 后重置计数         │
│                                                        │
│  数据保护：                                             │
│  - 解析失败时保留上一次成功数据（不写入空值）             │
│  - staging 表状态标记 'fetch_failed'                    │
│  - Admin 面板显示数据新鲜度（上次成功更新时间）          │
│                                                        │
└────────────────────────────────────────────────────────┘
```

```typescript
// lib/data-sources/fetch-with-fallback.ts

interface FetchResult<T> {
  data: T[] | null
  source: string
  status: 'success' | 'failed'
  error?: string
}

async function fetchWithFallback<T>(
  primaryFn: () => Promise<T[]>,
  primarySource: string,
  fallbackFn?: () => Promise<T[]>,
  fallbackSource?: string,
): Promise<FetchResult<T>> {
  try {
    const data = await primaryFn()
    if (data.length === 0) throw new Error('Empty result from primary source')

    await updateDataSourceStatus(primarySource, 'success')
    return { data, source: primarySource, status: 'success' }
  } catch (err) {
    await updateDataSourceStatus(primarySource, 'failed', err.message)

    if (fallbackFn && fallbackSource) {
      try {
        const data = await fallbackFn()
        await updateDataSourceStatus(fallbackSource, 'success')
        return { data, source: fallbackSource, status: 'success' }
      } catch (fallbackErr) {
        await updateDataSourceStatus(fallbackSource, 'failed', fallbackErr.message)
      }
    }

    return { data: null, source: primarySource, status: 'failed', error: err.message }
  }
}

async function updateDataSourceStatus(key: string, status: 'success' | 'failed', error?: string) {
  if (status === 'success') {
    await supabase.from('data_sources').update({
      last_status: 'success',
      last_fetched_at: new Date().toISOString(),
      last_error: null,
      consecutive_failures: 0,
    }).eq('key', key)
  } else {
    // 递增连续失败计数
    const { data } = await supabase.from('data_sources').select('consecutive_failures').eq('key', key).single()
    const failures = (data?.consecutive_failures ?? 0) + 1

    await supabase.from('data_sources').update({
      last_status: 'failed',
      last_error: error,
      consecutive_failures: failures,
      status: failures >= 7 ? 'disabled' : failures >= 3 ? 'failing' : 'active',
    }).eq('key', key)
  }
}
```

---

## 8. 数据自动化 Pipeline（修订）

### 价格数据 — 全自动

（与 v2 相同，但执行环境改为 GitHub Actions，不再受 Vercel 时间限制）

```typescript
// scripts/cron/fetch-openrouter.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

async function main() {
  const res = await fetch('https://openrouter.ai/api/v1/models')
  const { data } = await res.json()

  const rows = data.map((m: any) => ({
    source_key: 'openrouter',
    model_name: m.id,
    input_price_per_1m: parseFloat(m.pricing.prompt) * 1_000_000,
    output_price_per_1m: parseFloat(m.pricing.completion) * 1_000_000,
    context_window: m.context_length,
    status: 'pending',
  }))

  // Upsert to staging (幂等)
  const { error } = await supabase.from('staging_prices').upsert(rows, {
    onConflict: 'source_key,model_name,fetched_at::date',
  })

  if (error) throw error
  console.log(`✅ OpenRouter: ${rows.length} models fetched`)
}

main().catch(err => { console.error(err); process.exit(1) })
```

### Benchmark 数据 — 半自动

```typescript
// scripts/cron/fetch-benchmarks.ts
// Artificial Analysis — 带 fallback 保护
async function fetchAABenchmarks() {
  const result = await fetchWithFallback(
    async () => {
      const html = await fetchPage('https://artificialanalysis.ai/leaderboards/models')
      const csvBlocks = extractCSVFromHTML(html)
      if (csvBlocks.length === 0) throw new Error('No CSV data found in AA page — format may have changed')
      return csvBlocks.map(parseAARow)
    },
    'artificial_analysis',
    // fallback: 使用上次缓存的数据（不更新，只记录失败）
    undefined,
    undefined,
  )

  if (result.status === 'failed') {
    console.warn(`⚠️ AA fetch failed: ${result.error}. Keeping previous data.`)
    // 不写入 staging，保留上次成功数据
    return
  }

  // 写入 staging
  await insertStagingBenchmarks('artificial_analysis', result.data!)
}
```

### LMArena ELO — 预探测 + Gradio API Backup

```typescript
// scripts/cron/fetch-lmarena.ts

// 主路径: HuggingFace Space 文件
const LMARENA_URLS = [
  // 尝试多个已知路径
  'https://huggingface.co/spaces/lmarena-ai/chatbot-arena-leaderboard/resolve/main/data/elo_results.json',
  'https://huggingface.co/spaces/lmarena-ai/chatbot-arena-leaderboard/resolve/main/elo_results_latest.json',
]

// Backup: Gradio API
const GRADIO_API = 'https://lmarena-ai-chatbot-arena-leaderboard.hf.space/api/predict'

async function fetchLMArenaELO() {
  // 尝试直接 JSON
  for (const url of LMARENA_URLS) {
    try {
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        return parseELOData(data)
      }
    } catch { continue }
  }

  // Fallback: Gradio API
  try {
    const res = await fetch(GRADIO_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [], fn_index: 0 }),
    })
    const data = await res.json()
    return parseGradioELOData(data)
  } catch (err) {
    throw new Error(`All LMArena sources failed: ${err.message}`)
  }
}
```

### Staging 表清理（每周）

```yaml
# 添加到 .github/workflows/update-data.yml
      - name: Cleanup Old Staging Data
        if: github.event.schedule == '0 0 * * 0'  # 每周日
        run: npx tsx scripts/cron/cleanup-staging.ts
```

```typescript
// scripts/cron/cleanup-staging.ts
async function main() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { count: pricesDeleted } = await supabase
    .from('staging_prices')
    .delete()
    .not('status', 'eq', 'pending')
    .lt('processed_at', thirtyDaysAgo)

  const { count: benchmarksDeleted } = await supabase
    .from('staging_benchmarks')
    .delete()
    .not('status', 'eq', 'pending')
    .lt('processed_at', thirtyDaysAgo)

  console.log(`🧹 Cleanup: ${pricesDeleted} prices, ${benchmarksDeleted} benchmarks removed`)
}
```

---

## 9. Admin 认证方案

**问题**：Admin 面板无认证保护。

**方案**：Supabase Auth Magic Link，白名单邮箱。

```typescript
// lib/admin-auth.ts
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim())

export async function requireAdmin() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/admin/login')
  if (!ADMIN_EMAILS.includes(session.user.email!)) redirect('/admin/unauthorized')

  return session
}
```

```tsx
// app/admin/login/page.tsx
'use client'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useState } from 'react'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const supabase = createClientComponentClient()

  const handleLogin = async () => {
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/admin` },
    })
    setSent(true)
  }

  if (sent) return <p>Check your email for login link</p>

  return (
    <div className="max-w-sm mx-auto mt-20">
      <h1 className="text-xl font-bold mb-4">Admin Login</h1>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
             placeholder="your@email.com" className="w-full border p-2 rounded mb-2" />
      <button onClick={handleLogin} className="w-full bg-primary text-white p-2 rounded">
        Send Magic Link
      </button>
    </div>
  )
}
```

```tsx
// app/admin/layout.tsx
import { requireAdmin } from '@/lib/admin-auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return <div className="max-w-6xl mx-auto p-6">{children}</div>
}
```

---

## 10. 页面路由（修订）

```
/                    → Landing + 模型总览表格 (SSG)
/compare             → 主工作区：雷达 + 散点 + 排行榜 (ISR revalidate=3600)
/compare?ids=...&tab=radar
/models              → 完整模型列表 + 筛选器 (ISR revalidate=3600)
/models/[slug]       → 单模型详情页 + 历史变化 (ISR revalidate=3600)
/admin/login         → Admin 登录 (SSG)
/admin               → 数据管理面板 (CSR, Supabase Auth 保护)
/admin/staging       → 待审核数据
/admin/mappings      → 名称映射管理
/admin/health        → 数据源健康状态
```

---

## 11. 开发计划（修订重排）

### Phase 1：纯前端 MVP（Day 1）

**目标：5 个模型 + 雷达图 + 散点图用 JSON 跑通，不依赖 Supabase**

**理由**：跳过 DB setup 的复杂度，先验证 UI 和交互逻辑。

- [ ] `npx create-next-app llm-radar` + 安装 Tailwind / shadcn / Recharts
- [ ] 创建 `data/seed.json` — 5 个核心模型的完整数据
  - Claude Opus 4.6, GPT-5.2, Gemini 3 Pro, DeepSeek V3.2, Llama 4 Maverick
  - 包含 5 维 benchmark 分数 + 价格数据
  - 同时写好 `data/categories.json` 定义 benchmark 权重
- [ ] `lib/normalize.ts` — Scaled Rank 归一化 + categoryScore
- [ ] 雷达图组件（L1 五维视图，读 JSON 数据）
- [ ] 模型选择器组件（checkbox + 颜色分配 + 6 模型上限 + 预设按钮）
- [ ] 价格散点图（log scale + Pareto 前沿 + 推理模型三角标记）

### Phase 2：完善交互 + L2 下钻（Day 2 上午）

- [ ] 雷达图轴标签点击 → L2 下钻面板
- [ ] 自定义 `ClickableAxisTick` 组件
- [ ] L2 面板：按 unit 分组的柱状图（原始分数展示）
- [ ] Benchmark 排行榜页签（单项指标切换下拉）
- [ ] 页面布局 + 导航 + tab 切换
- [ ] URL params 同步（模型选择 + tab 状态）

### Phase 3：接入 Supabase + 扩展数据（Day 2 下午 ~ Day 3 上午）

- [ ] Supabase 项目创建 + schema migration（使用修订后的 schema）
- [ ] `scripts/seed.ts` — 导入种子数据（含 model_name_mappings 初始映射）
- [ ] 数据层从 JSON 切换为 Supabase 查询
- [ ] `/api/models` + `/api/compare` 接口
- [ ] ISR 配置（`revalidate: 3600`）
- [ ] 补全至 24 个模型
- [ ] 模型列表页 + 筛选器（provider / 开源 / 推理模型 / status / tags）
- [ ] 单模型详情页

### Phase 4：部署 + Admin（Day 3 下午）

- [ ] 部署到 Vercel，配置环境变量
- [ ] Supabase Auth 配置（Magic Link + 白名单邮箱）
- [ ] Admin 登录页 + layout 保护
- [ ] Admin 面板：查看 staging 数据 + 一键 approve/reject
- [ ] Admin 健康面板：数据源状态一览
- [ ] 基础 SEO meta tags
- [ ] `is_reasoning_model` 标记 + 典型查询成本估算

### Phase 5：价格数据自动化（Day 4）

**目标：价格数据全自动更新**

- [ ] `scripts/cron/fetch-openrouter.ts`
- [ ] `scripts/cron/fetch-litellm.ts`
- [ ] `scripts/cron/validate-and-merge.ts`（含交叉验证 + 变化幅度检查）
- [ ] `scripts/cron/recalculate-scores.ts`
- [ ] `.github/workflows/update-data.yml` — GitHub Actions Cron
- [ ] `/api/revalidate` — on-demand revalidation endpoint
- [ ] 测试：手动 `workflow_dispatch` 触发全流程
- [ ] Admin 面板：名称映射管理

### Phase 6：Benchmark 数据自动化（Day 5）

**目标：Benchmark 半自动更新，失败有 fallback**

- [ ] Artificial Analysis 页面解析（带 fallback 保护）
- [ ] LMArena ELO 数据拉取（多路径 + Gradio API backup）
- [ ] LLM 辅助提取 pipeline（Haiku 4.5，每周一次）
- [ ] `scripts/cron/cleanup-staging.ts`（每周清理）
- [ ] 数据源健康监控（连续失败自动降级）
- [ ] GitHub Actions 失败通知（内置邮件 + 可选 Slack webhook）

### Phase 7：迭代增强（后续）

- [ ] FIFA 风格模型卡片 UI
- [ ] 用户自定义权重（拖动调整各 benchmark 权重）
- [ ] 深色模式
- [ ] 新模型自动发现（OpenRouter 出现新模型 → 创建 staging 记录 + Admin 通知）
- [ ] 历史价格趋势图（`prices` 表时序数据）
- [ ] Epoch AI (ECI) 综合评分集成
- [ ] HuggingFace Open LLM Leaderboard 集成
- [ ] 响应式移动端适配
- [ ] 典型查询成本 vs API 定价切换
- [ ] 模型对比分享链接 OG image 生成

---

## 12. Seed 数据与名称映射

### 种子数据结构

```typescript
// data/seed.json 结构（Phase 1 用，Phase 3 导入 Supabase）
{
  "providers": [
    { "name": "OpenAI", "slug": "openai", "color": "#10A37F" },
    { "name": "Anthropic", "slug": "anthropic", "color": "#D97706" },
    // ...
  ],
  "models": [
    {
      "name": "Claude Opus 4.6",
      "slug": "claude-opus-46",
      "provider": "anthropic",
      "context_window_input": 200000,
      "context_window_output": 32000,
      "is_open_source": false,
      "is_reasoning_model": false,
      "release_date": "2026-01-15",
      "tags": ["multimodal", "function_calling", "vision"],
      "pricing": {
        "input_per_1m": 5.00,
        "output_per_1m": 25.00,
        "confirmed": true        // ← false 表示估算值，UI 上显示 "~"
      },
      "benchmarks": {
        "mmlu_pro": { "score": 78.5, "source": "official" },
        "gpqa_diamond": { "score": 72.1, "source": "artificial_analysis" },
        "swe_bench": { "score": 80.9, "source": "official" },
        // ...
      }
    },
    // ...
  ],
  // ← 关键新增: Phase 3 导入时同步灌入
  "name_mappings": [
    { "source": "openrouter", "external": "anthropic/claude-opus-4.6", "model_slug": "claude-opus-46" },
    { "source": "litellm", "external": "claude-opus-4-6-20260115", "model_slug": "claude-opus-46" },
    { "source": "openrouter", "external": "openai/gpt-5.2", "model_slug": "gpt-52" },
    { "source": "litellm", "external": "gpt-5.2", "model_slug": "gpt-52" },
    // ... 为 24 个模型 × 2 数据源 = ~48 条映射
  ]
}
```

### 种子模型列表（24 个）

（同 v2，增加 `is_reasoning_model` 标记和价格确认状态）

| # | 模型 | Provider | 输入 $/1M | 输出 $/1M | 推理模型 | 价格确认 |
|---|------|----------|----------|----------|---------|---------|
| 1 | GPT-5.2 | OpenAI | ~$2.50 | ~$10.00 | ✗ | ❌ 估算 |
| 2 | GPT-5.1 | OpenAI | ~$1.25 | ~$5.00 | ✗ | ❌ 估算 |
| 3 | Claude Opus 4.6 | Anthropic | $5.00 | $25.00 | ✗ | ✅ |
| 4 | Claude Opus 4.5 | Anthropic | $5.00 | $25.00 | ✗ | ✅ |
| 5 | Gemini 3 Pro | Google | ~$1.25 | ~$10.00 | ✗ | ❌ 估算 |
| 6 | Grok 4.1 | xAI | ~$3.00 | ~$15.00 | ✗ | ❌ 估算 |
| 7 | Claude Sonnet 4.5 | Anthropic | $3.00 | $15.00 | ✗ | ✅ |
| 8 | Claude Haiku 4.5 | Anthropic | $1.00 | $5.00 | ✗ | ✅ |
| 9 | GPT-5 | OpenAI | $1.25 | $5.00 | ✗ | ✅ |
| 10 | GPT-5 mini | OpenAI | ~$0.30 | ~$1.20 | ✗ | ❌ 估算 |
| 11 | Gemini 3 Flash | Google | ~$0.10 | ~$0.40 | ✗ | ❌ 估算 |
| 12 | Mistral Large 3 | Mistral | ~$2.00 | ~$6.00 | ✗ | ❌ 估算 |
| 13 | Grok 4.1 Fast | xAI | $0.20 | $1.00 | ✗ | ✅ |
| 14 | DeepSeek V3.2 | DeepSeek | $0.55 | $2.19 | ✗ | ✅ |
| 15 | DeepSeek R1 | DeepSeek | $0.55 | $2.19 | **✓** | ✅ |
| 16 | Llama 4 Maverick | Meta | 自托管 | 自托管 | ✗ | N/A |
| 17 | Llama 4 Scout | Meta | 自托管 | 自托管 | ✗ | N/A |
| 18 | Qwen 3.5 397B | Alibaba | 自托管 | 自托管 | ✗ | N/A |
| 19 | GLM-4.7 | 智谱 Zhipu | ~$0.50 | ~$2.00 | ✗ | ❌ 估算 |
| 20 | Kimi K2.5 | Moonshot | ~$0.60 | ~$2.40 | ✗ | ❌ 估算 |
| 21 | MiniMax-M2.5 | MiniMax | ~$0.50 | ~$2.00 | ✗ | ❌ 估算 |
| 22 | NVIDIA Nemotron 3 | NVIDIA | 自托管 | 自托管 | ✗ | N/A |
| 23 | Gemini 2.5 Pro | Google | $1.25 | $10.00 | ✗ | ✅ |
| 24 | GPT-4o | OpenAI | $2.50 | $10.00 | ✗ | ✅ |

**自托管模型价格处理**：通过 OpenRouter / Together / DeepInfra 等推理平台的 API 定价展示，标注 "hosted by X"。在散点图中用空心圆表示"价格取决于托管平台"。

---

## 13. 文件结构（修订）

```
llm-radar/
├── app/
│   ├── page.tsx                    # Landing (SSG)
│   ├── compare/page.tsx            # 主工作区 (ISR)
│   ├── models/
│   │   ├── page.tsx                # 模型列表 (ISR)
│   │   └── [slug]/page.tsx         # 模型详情 (ISR)
│   ├── admin/
│   │   ├── layout.tsx              # Auth 保护
│   │   ├── login/page.tsx          # Magic Link 登录
│   │   ├── page.tsx                # 数据管理面板
│   │   ├── staging/page.tsx        # 待审核数据
│   │   ├── mappings/page.tsx       # 名称映射管理
│   │   └── health/page.tsx         # 数据源健康状态 (新增)
│   └── api/
│       ├── models/route.ts
│       ├── compare/route.ts
│       ├── benchmarks/route.ts
│       ├── categories/route.ts
│       └── revalidate/route.ts     # on-demand revalidation (新增)
├── components/
│   ├── charts/
│   │   ├── CategoryRadar.tsx       # L1 雷达图 (5维)
│   │   ├── CategoryDetail.tsx      # L2 下钻面板 (按 unit 分组)
│   │   ├── PriceScatter.tsx        # 价格性价比散点 (含推理模型标记)
│   │   ├── BenchmarkRanking.tsx    # 排行榜柱状图
│   │   └── ClickableAxisTick.tsx
│   ├── ModelSelector.tsx           # 含预设按钮 + 6 模型上限
│   ├── ModelCard.tsx               # FIFA 风格卡片
│   ├── ParetoBadge.tsx
│   └── CoverageIndicator.tsx       # 数据完整度指示器 (新增)
├── lib/
│   ├── supabase.ts
│   ├── admin-auth.ts               # Admin 认证 (新增)
│   ├── normalize.ts                # Scaled Rank + categoryScore
│   ├── categories.ts               # 5 维能力分类配置
│   ├── pareto.ts
│   ├── pricing.ts                  # 含典型查询成本估算 (新增)
│   ├── validation.ts
│   └── data-sources/
│       ├── openrouter.ts
│       ├── litellm.ts
│       ├── llm-extract.ts          # runtime: nodejs (非 edge)
│       ├── artificial-analysis.ts
│       ├── lmarena.ts              # 多路径 + Gradio API backup
│       └── fetch-with-fallback.ts  # 通用 fallback 包装器 (新增)
├── scripts/
│   ├── seed.ts                     # 数据库导入 (含 name_mappings)
│   ├── update-model.ts
│   ├── backfill-mappings.ts
│   └── cron/                       # GitHub Actions 执行的脚本 (新增)
│       ├── fetch-openrouter.ts
│       ├── fetch-litellm.ts
│       ├── fetch-benchmarks.ts
│       ├── validate-and-merge.ts
│       ├── recalculate-scores.ts
│       ├── llm-extract-pricing.ts
│       └── cleanup-staging.ts
├── data/
│   ├── seed.json                   # 含 name_mappings + pricing.confirmed
│   └── categories.json
├── .github/
│   └── workflows/
│       └── update-data.yml         # 每日 cron (新增, 替代 vercel.json cron)
└── ...config files
```

---

## 14. 成本明细（修订）

| 服务 | 额度 | 实际用量 | 月费用 |
|------|------|---------|--------|
| Vercel Hobby | 100GB bandwidth | < 1GB/月 | $0 |
| Supabase Free | 500MB DB, 50K auth emails/月 | < 5MB, < 10 auth emails | $0 |
| **GitHub Actions** | 2000 min/月 (free) | ~30 min/月 (每天 1 min) | **$0** |
| OpenRouter API | 公开，无限制 | 每天 1 次 | $0 |
| LiteLLM GitHub | 公开，无限制 | 每天 1 次 | $0 |
| Haiku 4.5 提取 | $1/1M input tokens | **每周 1 次** × 4 周 | **~$0.08** |
| 域名（可选） | — | llmradar.dev 之类 | ~$1/月 |
| **合计** | | | **$0 ~ $1.08/月** |

---

## 15. v2 → v3 变更对照表

| 问题 | v2 | v3 修订 |
|------|-----|---------|
| SSG 不感知数据更新 | 纯 SSG | ISR + on-demand revalidation |
| Vercel Cron 时间不够 | Vercel Cron (60s 限制) | GitHub Actions (无限制) |
| Edge Runtime 不支持 SDK | `runtime = 'edge'` | 独立 Node.js 脚本 |
| benchmark_scores UNIQUE 不合理 | `UNIQUE(model_id, key, recorded_at)` | `UNIQUE(model_id, key, source)` |
| prices 无幂等保护 | 无 UNIQUE | `UNIQUE(model_id, date)` |
| staging 表无限增长 | 无清理 | 每周清理 >30 天已处理记录 |
| name_mappings 无初始数据 | 缺失 | seed.json 含 ~48 条映射 |
| 归一化小样本粗糙 | Percentile Rank | Scaled Rank (n<30 平滑) |
| 低 coverage 分数不公平 | 无处理 | coverage <50% 不计入总分 |
| 效率维度混搭 | 延迟 + 价格混在一维 | 拆分: 速度(5维) + 价格(独立散点) |
| 推理模型成本失真 | 无处理 | 典型查询成本 + 三角标记 |
| L2 量纲不统一 | 混排 | 按 unit 分组展示 |
| 模型选择超限无处理 | 未提及 | 6 上限 + 禁用 + tooltip |
| AA/LMArena 无 fallback | 承认脆弱但无方案 | fetchWithFallback + 连续失败降级 |
| Admin 无认证 | 无 | Supabase Auth Magic Link |
| Phase 1 工作量过大 | 含 Supabase + API + UI | 纯 JSON 跑通前端 |
| 项目名 | ModelScope | LLMRadar |
| 未确认价格混淆 | 无标记 | `pricing.confirmed` + UI "~" 标记 |
