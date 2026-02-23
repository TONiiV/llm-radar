# LLMRadar — LLM 能力雷达 + 价格性价比分析工具

## Project Overview

LLMRadar 是一个 LLM 模型能力对比与价格分析工具，提供分层能力展示：五维雷达图（推理、代码、数学、对话、Agent）+ 点击下钻到具体 Benchmark，以及独立的价格性价比散点图。

详细设计文档：`plans/MASTER_PLAN.md`

## Tech Stack

- **Framework**: Next.js 14 (App Router, ISR)
- **UI**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts (radar, scatter, bar)
- **DB**: Supabase Postgres (Phase 1 用纯 JSON，Phase 3 迁移)
- **Deploy**: Vercel (Hobby)
- **Cron**: GitHub Actions
- **Language**: TypeScript

## Project Structure

```
llm-radar/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Landing (SSG)
│   ├── compare/            # 主工作区：雷达 + 散点 + 排行榜 (ISR)
│   ├── models/             # 模型列表 + 详情 (ISR)
│   ├── admin/              # 数据管理面板 (Supabase Auth)
│   └── api/                # API routes
├── components/
│   └── charts/             # 图表组件 (Radar, Scatter, Bar, L2 Drill-down)
├── lib/                    # 核心逻辑
│   ├── normalize.ts        # Scaled Rank 归一化
│   ├── categories.ts       # 5 维能力分类配置
│   ├── pricing.ts          # 典型查询成本估算
│   └── data-sources/       # 数据源 fetch + fallback
├── scripts/
│   └── cron/               # GitHub Actions 执行的数据更新脚本
├── data/
│   ├── seed.json           # 种子数据 (Phase 1 直接使用)
│   └── categories.json     # Benchmark 分类权重
└── .github/workflows/      # 每日 cron 数据更新
```

## Development Phases

当前阶段：**Phase 1 — 纯前端 MVP**

Phase 1 目标：用 JSON 种子数据跑通 5 个模型的雷达图 + 散点图，不依赖 Supabase。

## Key Conventions

- 页面渲染：Landing/About 用 SSG，数据页用 ISR (`revalidate: 3600`)
- 归一化：n < 30 用 Scaled Rank，n >= 30 用 Percentile Rank
- 数据缺失：coverage < 50% 不计入总分，UI 用虚线 + 灰色标记
- 模型对比上限：最多 6 个模型
- 推理模型（R1/o1）：三角形标记 + 典型查询成本估算
- 价格未确认：用 `~` 前缀标记估算值

## Commands

```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run lint         # 代码检查
```

## Important Notes

- Phase 1 不使用 Supabase，数据从 `data/seed.json` 读取
- 价格数据源：OpenRouter API + LiteLLM JSON
- Benchmark 数据源：Artificial Analysis + LMArena ELO
- Admin 认证：Supabase Auth Magic Link（Phase 4）

## Bug 复盘：ResizeObserver + React 状态更新循环

**模式**：ResizeObserver 监听容器宽度 → `setDimensions` 更新状态 → React 重新渲染 → SVG/子元素尺寸变化 → 容器尺寸变化 → ResizeObserver 再次触发 → 无限循环。

**防范规则**：
1. `setDimensions` 必须使用函数式更新 `(prev) => ...`，对比新旧值相同时返回 `prev` 引用，阻止不必要的重新渲染
2. 使用 `Math.round()` 消除浮点数微小差异导致的抖动
3. 被 ResizeObserver 监听的容器应加 `overflow-hidden`，防止子元素撑宽容器形成反馈循环
4. 动态计算的图表宽度应设置合理上限（如 `Math.min(..., 800)`）

## Bug 复盘：Benchmark 数据源不一致 (2026-02-23)

**模式**：seed.json 手动填入的 "official" benchmark 分数与数据源（Anthropic 官方公布、Artificial Analysis、Epoch AI）不一致，导致 UI 显示错误的分数。

**根因**：
1. seed.json 中的 benchmarks 是手动填入的预估值，从未被自动验证
2. `validate-and-merge-benchmarks.ts` 有两个 bug：`source_key` 字段名不匹配 + `onConflict` 约束不完整，导致自动抓取的数据无法写入 DB
3. 当同一 benchmark 有多个 source 时，data.ts 没有优先级逻辑，取决于 DB 返回顺序

**修复方案**：
1. 修复 merge 脚本：`source_key` → `source`，`onConflict` 补全为 `model_id,benchmark_key,source`
2. 添加 source 优先级（`artificial_analysis > epoch_ai > official`）到 data.ts 和 regenerate-seed.ts
3. 从 seed.json 移除 benchmarks 字段——benchmark 数据只从 Supabase 获取
4. 添加 `validate-seed-against-sources.ts` 到 workflow，自动检测分数漂移

**防范规则**：
1. **Benchmark 分数的唯一真实来源是 Supabase DB**，seed.json 只作为模型元数据 fallback（名称、价格、tags）
2. seed.json 由 `regenerate-seed.ts` 从 DB 自动生成，**禁止手动编辑 benchmark 分数**
3. 新增 cron 脚本必须验证：目标表的列名 + 唯一索引 + `onConflict` 三者一致
4. 当多个数据源提供同一 benchmark 时，必须用 `SOURCE_PRIORITY` 显式声明优先级
5. DB schema 变更后，必须检查所有写入该表的脚本是否兼容

## 复盘学习规范

Bug 修复后执行复盘流程：
1. **根因分析**：找到触发 bug 的核心代码路径
2. **修复方案**：记录核心修复 + 防御性修复
3. **防范规则**：提炼为可复用的编码规则
4. **记录到 CLAUDE.md**：在「Bug 复盘」章节添加条目，确保后续开发不重蹈覆辙
