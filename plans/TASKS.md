# LLMRadar — Tasks

## Phase 1: 纯前端 MVP ✅

- [x] T1: 初始化 Next.js 项目 + 安装依赖 (Tailwind, Recharts)
- [x] T2: 创建种子数据 `data/seed.json` + `data/categories.json`
- [x] T3: 实现 `lib/normalize.ts` — Scaled Rank 归一化 + categoryScore
- [x] T4: 实现 `lib/types.ts` + `lib/colors.ts` — 类型定义 + 颜色配置
- [x] T5: 实现 `lib/pricing.ts` — 价格计算 + 典型查询成本
- [x] T6: 实现 `lib/data.ts` — 从 JSON 加载数据 + Pareto 前沿计算
- [x] T7: 构建雷达图组件 `components/charts/CategoryRadar.tsx`
- [x] T8: 构建模型选择器 `components/ModelSelector.tsx`
- [x] T9: 构建价格散点图 `components/charts/PriceScatter.tsx`
- [x] T10: 构建对比页面 `app/compare/page.tsx`
- [x] T11: 构建首页 `app/page.tsx`
- [x] T12: 验证构建通过 `npm run build` ✅

### Phase 1 产出文件:
- `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`
- `app/layout.tsx`, `app/globals.css`, `app/page.tsx`, `app/compare/page.tsx`
- `components/charts/CategoryRadar.tsx`, `components/charts/PriceScatter.tsx`
- `components/ModelSelector.tsx`
- `lib/types.ts`, `lib/normalize.ts`, `lib/pricing.ts`, `lib/data.ts`, `lib/colors.ts`
- `data/seed.json`, `data/categories.json`

## Phase 2: 完善交互 + L2 下钻
(待 Phase 1 完成后细化)
