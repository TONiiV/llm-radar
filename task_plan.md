# LLM Radar — Phase 3-6 执行计划

## 当前状态

| Phase | 状态 | 备注 |
|-------|------|------|
| Phase 1 (纯前端 MVP) | ✅ 完成 | 27 个模型, 5 维雷达图, 散点图 |
| Phase 2 (交互完善) | ✅ 完成 | L2 下钻, 排行榜, URL 同步 |
| Phase 3 (Supabase + 扩展) | ❌ 未开始 | 本次目标 |
| Phase 4 (部署 + Admin) | ❌ 未开始 | 本次目标 |
| Phase 5 (价格自动化) | ❌ 未开始 | 本次目标 |
| Phase 6 (Benchmark 自动化) | ❌ 未开始 | 部分 |

## 本次执行目标

**聚焦 Phase 3 的前端部分**：补齐缺失的页面和功能，不依赖 Supabase（保持 JSON 数据源）。

### 理由

1. Supabase 需要用户配置 project + env vars，不应在 agent 会话中完成
2. 前端功能（模型列表页、详情页、API routes、ISR）可以先用 JSON 数据跑通
3. 后续 Supabase 迁移只需替换数据层

---

## 执行阶段

### Phase A: 模型列表页 `/models` [pending]
- `/app/models/page.tsx` — 完整模型列表 + 筛选器
  - 按 provider 分组/筛选
  - 开源/推理模型/status 标签筛选
  - 搜索功能
  - 每个模型显示：综合分、5 维雷达缩略图、价格
  - 点击跳转详情页
- ISR 配置 (`revalidate: 3600`)

### Phase B: 模型详情页 `/models/[slug]` [pending]
- `/app/models/[slug]/page.tsx` — 单模型详情
  - 完整 5 维能力展示
  - 所有 benchmark 详细分数
  - 价格信息 + 典型查询成本
  - 模型元数据（context window、tags、release date）
  - 链接到 compare 页面（预选该模型）
- 动态路由 + generateStaticParams

### Phase C: API Routes [pending]
- `/app/api/models/route.ts` — 模型列表 API
- `/app/api/compare/route.ts` — 对比数据 API
- `/app/api/categories/route.ts` — 类别定义 API
- `/app/api/revalidate/route.ts` — on-demand revalidation

### Phase D: 导航 + 布局完善 [pending]
- 全局导航栏组件（当前仅 compare 页有简单 header）
- 页面间导航（Landing → Compare → Models）
- 面包屑导航
- 移动端响应式菜单

### Phase E: SEO + Meta [pending]
- 各页面 meta tags (title, description, og:image)
- generateMetadata 动态生成
- robots.txt + sitemap

---

## 文件变更清单

### 新建文件
- `app/models/page.tsx`
- `app/models/[slug]/page.tsx`
- `app/api/models/route.ts`
- `app/api/compare/route.ts`
- `app/api/categories/route.ts`
- `app/api/revalidate/route.ts`
- `components/Navbar.tsx`
- `components/ModelCard.tsx`
- `components/charts/MiniRadar.tsx` (缩略雷达图)

### 修改文件
- `app/layout.tsx` — 添加全局导航
- `app/page.tsx` — 更新导航链接
- `app/compare/page.tsx` — 使用全局导航
- `lib/data.ts` — 添加 getModelBySlug()
