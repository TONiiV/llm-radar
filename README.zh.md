[English](README.md) | [**中文**](README.zh.md)

# LLMRadar

LLM 能力雷达 + 价格性价比分析工具。对比主流大语言模型在推理、代码、数学、对话、Agent、速度六大维度的表现，找到最适合你的模型。

## 功能特点

- **六维能力雷达图** — 一眼看清模型的能力分布，支持多模型叠加对比（最多 6 个）
- **Benchmark 下钻** — 点击雷达图轴标签，查看该维度下每项 Benchmark 的原始分数
- **价格性价比散点图** — X 轴价格（log scale）、Y 轴综合能力分，标注 Pareto 前沿
- **推理模型标记** — 区分 DeepSeek R1、o1 等推理模型，提供「典型查询成本」估算
- **数据自动更新** — GitHub Actions 每日拉取 OpenRouter / LiteLLM 价格，半自动更新 Benchmark

## 追踪的 Benchmarks

| 维度           | Benchmarks                                                      |
| -------------- | --------------------------------------------------------------- |
| 推理 Reasoning | GPQA Diamond, MMLU-Pro, Humanity's Last Exam                    |
| 代码 Coding    | SWE-Bench Verified, Terminal-Bench Hard                         |
| 数学 Math      | AIME 2025                                                       |
| 对话 Chat      | Chatbot Arena ELO, IFEval                                       |
| Agent          | τ²-Bench, GDPval-AA                                             |
| 速度 Speed     | Output TPS, TTFT                                                |

## 技术栈

- **Next.js 14** (App Router, ISR) + **TypeScript**
- **Tailwind CSS** + **shadcn/ui**
- **Recharts** (radar, scatter, bar charts)
- **Supabase** Postgres + Auth
- **Vercel** 部署 + **GitHub Actions** 定时任务

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建
npm run build
```

打开 [http://localhost:3000](http://localhost:3000)，或访问 [线上版本](https://llm-radar-peach.vercel.app/)。

## 项目结构

```
├── app/                 # 页面和 API 路由
│   ├── compare/         # 模型对比工作区
│   ├── models/          # 模型列表 + 详情
│   └── admin/           # 数据管理面板
├── components/charts/   # Radar, Scatter, Bar, Drill-down
├── lib/                 # 归一化、分类、价格计算
├── data/                # 种子数据 JSON
└── scripts/cron/        # 数据自动更新脚本
```

## 许可证

MIT
