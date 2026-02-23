# LLM Radar — Progress Log

## Session: 2026-02-22

### 状态评估
- Phase 1 + 2: ✅ 完成（之前session）
- 27 个模型, D3 图表, 完整交互

### 本次完成
- [x] Phase A: 模型列表页 `/models` — 搜索 + 筛选 + 排序 + 卡片网格
- [x] Phase B: 模型详情页 `/models/[slug]` — 完整能力展示 + 价格 + 规格
- [x] Phase C: API Routes — `/api/models`, `/api/compare`, `/api/categories`, `/api/revalidate`
- [x] i18n 补全 — models 相关翻译 + nav.models
- [x] lib/data.ts — 新增 getModelBySlug() + getAllSlugs()

### 新建文件
- `app/models/page.tsx` — 模型列表页
- `app/models/[slug]/page.tsx` — 模型详情页
- `app/api/models/route.ts`
- `app/api/compare/route.ts`
- `app/api/categories/route.ts`
- `app/api/revalidate/route.ts`

### 修改文件
- `lib/data.ts` — 新增 getModelBySlug, getAllSlugs
- `lib/i18n.ts` — 新增 models 翻译组 + nav.models

### 构建结果
✅ Build 成功, 10 个页面:
- ○ / (Static)
- ○ /compare (Static)
- ○ /models (Static)
- ƒ /models/[slug] (Dynamic)
- ○ /api/models, /api/categories (Static)
- ƒ /api/compare, /api/revalidate (Dynamic)

### 剩余工作
- [x] Navbar 组件抽取（当前三个页面各自有 header）
- [x] SEO meta tags (generateMetadata)
- [x] 移动端响应式菜单
- [x] 移除无效 About 链接
- [ ] Phase 4: Supabase 集成
- [ ] Phase 5-6: 数据自动化

## Session: 2026-02-22 (续)

### 本次完成
- [x] 共享 Navbar 组件 — 路径高亮 + 移动端汉堡菜单
- [x] SEO meta tags — 4 个 layout.tsx (root template + compare + models + [slug] dynamic)
- [x] generateStaticParams — 27 个模型详情页预生成为 SSG
- [x] 移除所有页面的无效 About 链接

### 新建文件
- `components/Navbar.tsx` — 共享导航栏 + 移动端菜单
- `app/compare/layout.tsx` — Compare 页 SEO metadata
- `app/models/layout.tsx` — Models 列表 SEO metadata
- `app/models/[slug]/layout.tsx` — 动态 generateMetadata + generateStaticParams

### 修改文件
- `app/layout.tsx` — title 改为 template 模式 + metadataBase + openGraph
- `app/page.tsx` — 使用 Navbar 组件替换内联 header
- `app/models/page.tsx` — 使用 Navbar 组件替换内联 header
- `app/models/[slug]/page.tsx` — 使用 Navbar 组件替换内联 header
- `app/compare/page.tsx` — 移除无效 About 链接

### 构建结果
✅ Build 成功, 10 个路由:
- ○ / (Static)
- ○ /compare (Static)
- ○ /models (Static)
- ● /models/[slug] (SSG, 27 paths prerendered)
- ○ /api/models, /api/categories (Static)
- ƒ /api/compare, /api/revalidate (Dynamic)

### 剩余工作
- [x] Phase 3 后端: Supabase 集成
- [ ] Phase 4: 部署 + Admin 面板
- [ ] Phase 5: 价格数据自动化 (GitHub Actions)
- [ ] Phase 6: Benchmark 数据自动化

## Session: 2026-02-22 (第三次)

### 本次完成: Phase 3 Supabase 集成
- [x] Supabase 项目创建 (llm-radar, us-east-1, Free tier)
- [x] Schema migration — 9 表 + 7 索引 + RLS 策略 + 公开读策略
- [x] 种子数据导入 — 12 providers, 27 models, 17 benchmarks, 459 scores, 27 prices, 4 data sources
- [x] 数据层重构 — Server Component + Client Component 拆分
- [x] Supabase 异步查询 + JSON fallback
- [x] API routes 切换为 async Supabase 查询
- [x] generateMetadata / generateStaticParams 切换为 async
- [x] ISR 配置 (revalidate: 3600)
- [x] on-demand revalidation endpoint (/api/revalidate)

### 架构变更: Server/Client Component 拆分
- `app/page.tsx` → Server (async fetch) + `app/HomeClient.tsx` (client)
- `app/compare/page.tsx` → Server (async fetch) + `app/compare/CompareClient.tsx` (client)
- `app/models/page.tsx` → Server (async fetch) + `app/models/ModelsClient.tsx` (client)
- `app/models/[slug]/page.tsx` → Server (async fetch) + `ModelDetailClient.tsx` (client)

### 新建文件
- `lib/supabase.ts` — Supabase 客户端
- `.env.local` — 环境变量 (SUPABASE_URL, ANON_KEY, REVALIDATION_SECRET)
- `app/HomeClient.tsx` — Landing 页客户端组件
- `app/compare/CompareClient.tsx` — Compare 页客户端组件
- `app/models/ModelsClient.tsx` — Models 列表客户端组件
- `app/models/[slug]/ModelDetailClient.tsx` — 模型详情客户端组件

### 修改文件
- `lib/data.ts` — 新增 async fetch* 系列函数 (Supabase 查询 + JSON fallback)
- `app/page.tsx` — 改为 Server Component
- `app/compare/page.tsx` — 改为 Server Component + revalidate: 3600
- `app/models/page.tsx` — 改为 Server Component + revalidate: 3600
- `app/models/[slug]/page.tsx` — 改为 Server Component + revalidate: 3600
- `app/models/[slug]/layout.tsx` — 使用 async fetch 函数
- `app/api/models/route.ts` — 使用 fetchModelWithScores
- `app/api/compare/route.ts` — 使用 fetchModelWithScores + fetchCategories
- `app/api/categories/route.ts` — 使用 fetchCategories

### Supabase 项目信息
- Project ID: jwgnuzqtctelihhlxfte
- URL: https://jwgnuzqtctelihhlxfte.supabase.co
- Region: us-east-1

### 构建结果
✅ Build 成功, 37 个页面:
- ○ / (Static, data from Supabase)
- ○ /compare (Static, revalidate: 3600)
- ○ /models (Static, revalidate: 3600)
- ● /models/[slug] (SSG, 27 paths, revalidate: 3600)
- ○ /api/models, /api/categories (Static)
- ƒ /api/compare, /api/revalidate (Dynamic)

### 剩余工作
- [x] Phase 4a: 部署到 Vercel ✅ https://llm-radar-peach.vercel.app
- [ ] Phase 4b: Admin 面板 + Supabase Auth
- [ ] Phase 5: 价格数据自动化 (GitHub Actions)
- [ ] Phase 6: Benchmark 数据自动化

## Session: 2026-02-23

### 本次完成: Vercel 部署
- [x] Vercel 项目创建 (tonicistoxic-4789s-projects/llm-radar)
- [x] 环境变量配置 (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, REVALIDATION_SECRET)
- [x] 生产部署成功 — https://llm-radar-peach.vercel.app
- [x] API 验证 — 27 个模型从 Supabase 正常加载

### 剩余工作
- [x] Phase 4b: Admin 面板 + Supabase Auth
- [ ] Phase 5: 价格数据自动化 (GitHub Actions cron)
- [ ] Phase 6: Benchmark 数据自动化
- [ ] Phase 7: 迭代增强

## Session: 2026-02-23 (续)

### 本次完成: Phase 4b Admin 面板
- [x] Admin 认证系统 — Supabase Auth Magic Link + ADMIN_EMAILS 白名单
- [x] Admin Layout — 认证保护 + 顶部导航栏 (Dashboard / Staging / 用户邮箱)
- [x] Admin Dashboard — 数据统计卡片 + Staging Queue 概览 + Data Source Health 表
- [x] Staging Review — Prices/Benchmarks 标签切换 + 单条/批量 Approve/Reject
- [x] Login 页 — Magic Link OTP 发送 + 成功提示
- [x] Unauthorized 页 — 白名单拒绝提示
- [x] 修复 auth-helpers v0.15 API: createBrowserClient / createServerClient (替代旧 createClientComponentClient / createServerComponentClient)

### 新建文件
- `app/admin/layout.tsx` — Auth-protected layout (requireAdmin)
- `app/admin/page.tsx` — Dashboard (stats + staging queue + data source health)
- `app/admin/staging/page.tsx` — Staging data review (approve/reject)

### 修改文件
- `lib/admin-auth.ts` — 适配 auth-helpers v0.15 createServerClient API
- `app/admin/login/page.tsx` — 适配 createBrowserClient API

### 构建结果
✅ Build 成功, 41 个页面:
- ƒ /admin (Dynamic, auth-protected)
- ƒ /admin/login (Dynamic)
- ƒ /admin/staging (Dynamic)
- ƒ /admin/unauthorized (Dynamic)
- ○ / (Static)
- ○ /compare (Static, revalidate: 3600)
- ○ /models (Static, revalidate: 3600)
- ● /models/[slug] (SSG, 27 paths, revalidate: 3600)

### 剩余工作
- [x] Phase 5: 价格数据自动化 (GitHub Actions cron)
- [x] Phase 6: Benchmark 数据自动化
- [ ] Phase 7: 迭代增强

## Session: 2026-02-23 (第三次)

### 本次完成: Phase 5+6 数据自动化
- [x] fetch-openrouter.ts — OpenRouter API 价格拉取 → staging_prices
- [x] fetch-litellm.ts — LiteLLM GitHub JSON 价格拉取 → staging_prices
- [x] fetch-benchmarks.ts — LMArena ELO 数据拉取 (多路径 fallback) → staging_benchmarks
- [x] validate-and-merge.ts — 交叉验证 + 价格变幅检查 (>300% 自动 flag) + 合并到 prices 表
- [x] recalculate-scores.ts — 重算 Scaled Rank 归一化分数
- [x] cleanup-staging.ts — 清理 30 天已处理 staging 数据
- [x] .github/workflows/update-data.yml — GitHub Actions 每日 cron + 手动触发

### 新建文件
- `scripts/cron/fetch-openrouter.ts`
- `scripts/cron/fetch-litellm.ts`
- `scripts/cron/fetch-benchmarks.ts`
- `scripts/cron/validate-and-merge.ts`
- `scripts/cron/recalculate-scores.ts`
- `scripts/cron/cleanup-staging.ts`
- `.github/workflows/update-data.yml`

### 数据自动化 Pipeline
```
Daily UTC 00:00 (GitHub Actions):
1. fetch-openrouter → staging_prices
2. fetch-litellm → staging_prices
3. fetch-benchmarks (LMArena) → staging_benchmarks
4. validate-and-merge → prices 表 (flagged 需人工审核)
5. recalculate-scores → normalized_score 更新
6. curl revalidate → Vercel ISR 刷新
7. (周日) cleanup-staging → 清理旧数据
```

### GitHub Actions Secrets 需配置
- SUPABASE_URL
- SUPABASE_SERVICE_KEY (service_role key, 非 anon key)
- VERCEL_URL (https://llm-radar-peach.vercel.app)
- REVALIDATION_SECRET

### 剩余工作
- [ ] Phase 7: 迭代增强
