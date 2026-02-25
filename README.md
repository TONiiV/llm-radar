[**English**](README.md) | [中文](README.zh.md)

# LLMRadar

LLM capability radar + price-performance analysis tool. Compare mainstream large language models across Reasoning, Coding, Math, Chat, Agent, and Speed dimensions to find the best model for your needs.

## Features

- **Six-Dimension Radar Chart** — Visualize model capabilities at a glance, with multi-model overlay comparison (up to 6)
- **Benchmark Drill-Down** — Click radar axis labels to view raw scores for each benchmark in that dimension
- **Price-Performance Scatter Plot** — X-axis price (log scale), Y-axis composite score, with Pareto frontier highlighted
- **Reasoning Model Tags** — Distinguish reasoning models like DeepSeek R1, o1, etc., with "typical query cost" estimates
- **Auto-Updating Data** — GitHub Actions daily cron fetches prices from OpenRouter / LiteLLM, semi-auto benchmark updates

## Benchmarks Tracked

| Dimension | Benchmarks |
| --------- | ---------- |
| Reasoning | GPQA Diamond, MMLU-Pro, Humanity's Last Exam |
| Coding    | SWE-Bench Verified, Terminal-Bench Hard |
| Math      | AIME 2025 |
| Chat      | Chatbot Arena ELO, IFEval |
| Agent     | τ²-Bench, GDPval-AA |
| Speed     | Output TPS, TTFT |

## Tech Stack

- **Next.js 14** (App Router, ISR) + **TypeScript**
- **Tailwind CSS** + **shadcn/ui**
- **Recharts** (radar, scatter, bar charts)
- **Supabase** Postgres + Auth
- **Vercel** deploy + **GitHub Actions** cron

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build
npm run build
```

Open [Vercel Link](https://llm-radar-peach.vercel.app/).

## Project Structure

```
├── app/                 # Pages & API routes
│   ├── compare/         # Model comparison workspace
│   ├── models/          # Model list + detail pages
│   └── admin/           # Data management panel
├── components/charts/   # Radar, Scatter, Bar, Drill-down
├── lib/                 # Normalization, categories, pricing
├── data/                # Seed data JSON
└── scripts/cron/        # Auto-update scripts
```

## License

MIT
