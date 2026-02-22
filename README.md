# LLMRadar

LLM 能力雷达 + 价格性价比分析工具。对比主流大语言模型在推理、代码、数学、对话、Agent 五大维度的表现，找到最适合你的模型。

## Features

- **五维能力雷达图** — 一眼看清模型的能力分布，支持多模型叠加对比（最多 6 个）
- **Benchmark 下钻** — 点击雷达图轴标签，查看该维度下每项 Benchmark 的原始分数
- **价格性价比散点图** — X 轴价格（log scale）、Y 轴综合能力分，标注 Pareto 前沿
- **推理模型标记** — 区分 DeepSeek R1、o1 等推理模型，提供「典型查询成本」估算
- **数据自动更新** — GitHub Actions 每日拉取 OpenRouter / LiteLLM 价格，半自动更新 Benchmark

## Benchmarks Tracked

| 维度 | Benchmarks |
|------|-----------|
| 推理 Reasoning | MMLU-Pro, GPQA Diamond, Humanity's Last Exam, CritPt |
| 代码 Coding | SWE-Bench Verified, LiveCodeBench, Terminal-Bench Hard, SciCode |
| 数学 Math | AIME 2025, MATH, GSM8K |
| 对话 Chat | LMArena ELO, IFBench, AlpacaEval |
| Agent | t2-Bench, GDPval-AA, AA-LCR |

## Tech Stack

- **Next.js 14** (App Router, ISR) + **TypeScript**
- **Tailwind CSS** + **shadcn/ui**
- **Recharts** (radar, scatter, bar charts)
- **Supabase** Postgres + Auth
- **Vercel** deploy + **GitHub Actions** cron

## Getting Started

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建
npm run build
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
├── app/                 # Pages & API routes
│   ├── compare/         # 模型对比工作区
│   ├── models/          # 模型列表 + 详情
│   └── admin/           # 数据管理面板
├── components/charts/   # Radar, Scatter, Bar, Drill-down
├── lib/                 # 归一化、分类、价格计算
├── data/                # 种子数据 JSON
└── scripts/cron/        # 数据自动更新脚本
```

## Development Roadmap

- [x] Phase 1: 纯前端 MVP — JSON 数据 + 雷达图 + 散点图
- [ ] Phase 2: L2 下钻 + 排行榜 + URL 同步
- [ ] Phase 3: Supabase 集成 + 24 模型
- [ ] Phase 4: 部署 + Admin 面板
- [ ] Phase 5: 价格数据自动化
- [ ] Phase 6: Benchmark 数据自动化
- [ ] Phase 7: 迭代增强

## License

MIT
