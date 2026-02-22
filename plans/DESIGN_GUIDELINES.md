# LLMRadar Design Guidelines

> Extracted from Pencil design mockups (frames `AnYkq` light, `hGoeJ` dark) and implemented theme system.
> Last updated: 2026-02-22

---

## 1. Design Philosophy

**"复古风格融合现代" — Retro Editorial meets Modern Data Viz**

- **Editorial typography**: Serif headings (EB Garamond), monospace data (VT323), clean sans body (DM Sans)
- **Paper textures**: Warm cream/sepia backgrounds, not clinical white
- **Sharp geometry**: 0 border-radius everywhere — no rounded corners
- **CRT decoration**: Terminal-style accents for branding only, not for functional UI
- **Modern charts**: D3.js-powered with clean lines — charts stay crisp and readable
- **Minimal ink**: Muted borders, subtle shadows, content-first hierarchy

---

## 2. Color System

### 2.1 Theme Variables (CSS Custom Properties)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--bg-page` | `#F4F1E6` (warm cream) | `#1A1814` (deep sepia-black) | Page background |
| `--bg-card` | `#E8E4D8` (tan parchment) | `#242018` (dark parchment) | Card backgrounds |
| `--bg-card-hover` | `#DDD9CC` | `#2E2A1E` | Card hover state |
| `--bg-inverted` | `#0F0F0F` (ink black) | `#E8E4D8` (cream) | Inverted elements (buttons, footer) |
| `--text-primary` | `#0F0F0F` | `#E8E4D8` | Body text, headings |
| `--text-secondary` | `#555555` | `#A09C8F` | Descriptions, supporting text |
| `--text-muted` | `#888888` | `#706C5F` | Captions, placeholders |
| `--text-inverted` | `#F4F1E6` | `#1A1814` | Text on inverted backgrounds |
| `--accent-blue` | `#2B6CB0` | `#4A90D9` | Links, active states, accent |
| `--accent-orange` | `#C05621` | `#E07A3A` | Provider tags (Anthropic), warnings |
| `--border-color` | `#D1CEC7` | `#3A3630` | All borders and dividers |

### 2.2 Fixed Colors (Not theme-dependent)

| Token | Value | Usage |
|-------|-------|-------|
| CRT Green | `#33FF00` | Terminal text in CRT decoration |
| CRT Screen | `#222529` | Terminal background |
| Score High | `#22C55E` | Good scores, Pareto frontier |
| Score Mid | `#F59E0B` | Medium scores, warnings |
| Score Low | `#64748B` | Low/unreliable scores |

### 2.3 Category Colors

| Category | Color | Tailwind Class |
|----------|-------|---------------|
| Reasoning | `#2B6CB0` (blue) | `text-category-reasoning` |
| Coding | `#22C55E` (emerald) | `text-category-coding` |
| Math | `#F59E0B` (amber) | `text-category-math` |
| Chat | `#8B5CF6` (violet) | `text-category-chat` |
| Agentic | `#F43F5E` (rose) | `text-category-agentic` |

### 2.4 Model Colors (6-color rotation)

```
#f59e0b  amber
#10b981  emerald
#3b82f6  blue
#f43f5e  rose
#a78bfa  violet
#06b6d4  cyan
```

### 2.5 Provider Colors

| Provider | Color | Usage |
|----------|-------|-------|
| Anthropic | `#D97706` | Provider tags |
| OpenAI | `#10A37F` | Provider tags |
| Google | `#4285F4` | Provider tags |
| DeepSeek | `#5B6CF0` | Provider tags |
| Meta | `#1877F2` | Provider tags |
| xAI | `#1DA1F2` | Provider tags |
| Mistral | `#FF7000` | Provider tags |
| Alibaba | `#FF6A00` | Provider tags |
| Zhipu | `#6366F1` | Provider tags |
| Moonshot | `#8B5CF6` | Provider tags |
| MiniMax | `#EC4899` | Provider tags |
| NVIDIA | `#76B900` | Provider tags |

---

## 3. Typography

### 3.1 Font Stack

| Role | Font | CSS Variable | Fallback |
|------|------|-------------|----------|
| **Heading** | EB Garamond | `--font-eb-garamond` | Georgia, serif |
| **Body** | DM Sans | `--font-dm-sans` | system-ui, sans-serif |
| **Mono / Data** | VT323 | `--font-vt323` | Courier New, monospace |

### 3.2 Type Scale (from Pencil design)

| Element | Font | Size | Weight | Style | Letter Spacing |
|---------|------|------|--------|-------|---------------|
| Hero title | EB Garamond | 72px | 500 | normal + italic line | -2px |
| Section title | EB Garamond | 22px | 600 | italic | 0.5px |
| Card model name | EB Garamond | 20px | 600 | normal | — |
| Category name | EB Garamond | 16px | 600 | normal | — |
| Body text | Inter/DM Sans | 18px | 400 | normal | — |
| Nav links | Inter/DM Sans | 16px | 500 | normal | — |
| Body small | Inter/DM Sans | 13px | 400–500 | normal | — |
| Logo | EB Garamond | 24px | 700 | normal | 3px |
| Provider tag | VT323 | 12px | normal | uppercase | 2px |
| Score large | VT323 | 32px | normal | normal | — |
| Score small | VT323 | 14px | normal | normal | — |
| Benchmark list | VT323 | 13px | normal | normal | — |
| CRT terminal text | VT323 | 16px | normal | normal | — |
| Footer copyright | VT323 | 14px | normal | normal | — |
| Tag badge | VT323 | 14px | normal | uppercase | 2px |

### 3.3 Typography Rules

- **Headings**: Always EB Garamond. Section titles use italic.
- **Data values**: Always VT323. Scores, prices, benchmark values.
- **Provider names**: VT323, uppercase, 2px letter-spacing, colored by provider.
- **Body text**: DM Sans (or Inter as seen in Pencil). Keep line-height ~1.6 for descriptions.
- **No bold body text**: Body stays regular weight; only headings get semibold/bold.

---

## 4. Component Patterns

### 4.1 Paper Card (`paper-card`)

The primary container component. Replaces all glassmorphism cards.

```css
.paper-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.06);
  border-radius: 0;           /* CRITICAL: no rounding */
}
.paper-card:hover {
  transform: translateY(-2px);
  box-shadow: 4px 4px 16px rgba(0, 0, 0, 0.1);
}
```

**Flat variant** (`paper-card-flat`): No shadow, no hover transform. Use for inline containers, sticky headers, input wrappers.

### 4.2 Model Card (from Pencil design)

Structure:
```
┌─────────────────────────┐
│ PROVIDER (VT323 12px, provider color, uppercase, 2px tracking)
│ Model Name (EB Garamond 20px, semibold)
│ 82 / 100 (VT323 32px score + Inter 13px label)
│ $5.00 / $25.00 per 1M (VT323 14px, text-secondary)
└─────────────────────────┘
```

- Background: `var(--bg-card)`
- Border: `1px solid var(--border-color)`
- Padding: 20px
- Gap: 12px vertical
- No border-radius

### 4.3 Category Card (from Pencil design)

Structure:
```
┌─────────────────────────┐
│ 🔵 (category icon, 24px, category color)
│ Reasoning (EB Garamond 16px, semibold)
│ MMLU-Pro · GPQA · HLE (VT323 13px, text-muted)
└─────────────────────────┘
```

- Same container as paper-card
- Padding: 20px
- Gap: 8px vertical

### 4.4 Section Divider

```
────────────────────────────────────
Frontier Models                View All →
```

- Top border: `1px solid var(--border-color)`
- Title: EB Garamond 22px, italic, semibold
- Link: accent-blue, 13px, medium weight
- Layout: `justify-between`
- Padding: `0 64px` (in design; responsive in code)

### 4.5 CRT Terminal (Decorative)

```css
.crt-screen {
  background: #222529;
}
.crt-screen::before {  /* scanlines */
  background: linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.15) 50%),
              linear-gradient(90deg, rgba(255,0,0,0.04), rgba(0,255,0,0.02), rgba(0,0,255,0.04));
  background-size: 100% 2px, 3px 100%;
}
.crt-screen::after {  /* vignette */
  background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.3) 100%);
}
```

- Header: 3 colored dots (orange, amber, green) + title in VT323
- Content: VT323 16px, CRT green (#33FF00)
- Prompt line: white text with blinking cursor
- Fixed size: 360px wide, 280px tall (in design)
- Padding: 20px, gap: 8px

### 4.6 Buttons

**Primary** (`btn-primary`):
```css
background: var(--bg-inverted);  /* ink black / cream */
color: var(--text-inverted);
border: 2px solid var(--bg-inverted);
font-family: EB Garamond;
padding: 16px 32px;
```
Hover: transparent background, text-primary color.

**Tab button** (active):
```css
bg-accent-blue/10
text-accent-blue
border border-accent-blue/20
font-heading font-medium
```

**Preset button** (selector):
```css
font-mono text-xs tracking-wider uppercase
border border-border
px-2.5 py-1
```

### 4.7 Input (`retro-input`)

```css
background: var(--bg-card);
border: 1px solid var(--border-color);
/* Focus: */
border-color: var(--accent-blue);
box-shadow: 0 0 0 2px rgba(43, 108, 176, 0.15);
```

### 4.8 Provider Tag

```css
font-family: VT323;
font-size: 12px;
letter-spacing: 2px;
text-transform: uppercase;
color: {provider.color};
```

---

## 5. Layout Patterns

### 5.1 Page Widths

- Max content width: `max-w-7xl` (1280px)
- Horizontal padding: `px-4` (code) / 64px (Pencil design at 1440px viewport)
- Design frame width: 1440px

### 5.2 Header

```
[Logo (EB Garamond 24px, 3px tracking)] ............... [Nav links] [Locale] [Theme]
```
- Sticky top, `paper-card-flat`
- Padding: 20px vertical, 64px horizontal (design) / responsive in code
- Bottom border: `1px solid var(--border-color)`

### 5.3 Compare Page Layout

```
┌──────────┬──────────────────────────────────┐
│ Sidebar  │  Tab Bar (Radar | Scatter | Rank)│
│ (lg:w-72)│  ┌─────────────┬────────────────┐│
│          │  │ Radar Chart │ Scatter Chart  ││
│ Model    │  │   (D3 SVG)  │   (D3 SVG)    ││
│ Selector │  └─────────────┴────────────────┘│
│          │  ┌──────────────────────────────┐│
│ (sticky  │  │   L2 Drilldown (if active)   ││
│  top-20) │  └──────────────────────────────┘│
│          │  ┌──────────────────────────────┐│
│          │  │      Stats Table             ││
│          │  └──────────────────────────────┘│
└──────────┴──────────────────────────────────┘
```

- Sidebar: `lg:w-72`, sticky `top-20`
- Main content: `flex-1`
- Radar tab: 2-column grid (`grid-cols-1 lg:grid-cols-2 gap-6`)
- Responsive: stacks vertically on mobile

### 5.4 Landing Page Layout

```
[Header]
[Hero Section: Text (left) + CRT Terminal (right), gap-64, padding 80px vertical]
[Section Divider: "Frontier Models" + "View All →"]
[Model Cards: 3-column grid, gap-24]
[Section Divider: "Five Dimensions"]
[Category Cards: 5-column grid, gap-16]
[Footer: inverted background]
```

### 5.5 Footer

- Full width, inverted background (`--bg-inverted`)
- Logo: EB Garamond 18px, 700 weight, 2px tracking
- Links: text with gap-24
- Copyright: VT323 14px
- Layout: `justify-between`
- Padding: 32px vertical, 64px horizontal

---

## 6. Chart Design (D3.js)

### 6.1 General Chart Rules

- **No border-radius** on tooltips, containers, or labels
- **Font usage in SVG**:
  - Axis category labels: EB Garamond italic, 13px, category color
  - Score values: VT323, 12px, text-primary
  - Tick labels: VT323, 11px, text-muted
  - Model name labels: VT323, 11px, text-secondary
  - Quadrant annotations: EB Garamond italic, 11px, opacity 0.12
- **Grid lines**: `stroke: var(--border-color)`, `strokeWidth: 0.5`
- **Tooltip style**: `paper-card-flat`, sharp corners, `boxShadow: 4px 4px 0 var(--border-color)`

### 6.2 Radar Chart

- Pentagon-shaped grid (not circular)
- 5 axes at 72-degree intervals from top (-90deg)
- Grid levels at 20, 40, 60, 80, 100
- Model polygons: semi-transparent gradient fills (15% opacity)
- Hover: highlight one model (others dim to 0.15 opacity), show score labels
- Category icons at vertices
- Click axis label for drill-down

### 6.3 Scatter Chart

- X-axis: `d3.scaleLog()` for price (avg per 1M tokens)
- Y-axis: `d3.scaleLinear([0, 100])` for composite score
- Circle dots (r=6) for standard models, triangles for reasoning models
- Pareto frontier: dashed green line connecting optimal points
- Model name labels next to each dot (VT323 11px)
- Quadrant annotations at low opacity
- Pareto points get green ring highlight

### 6.4 Stats Table with Score Bars

Each score cell includes a visual bar:
```
[████████░░] 82
```
- Bar width proportional to score (0-100%)
- Bar color: corresponding category color
- Unreliable scores: dashed bar + muted color
- Number: VT323 font

---

## 7. Spacing Reference

| Context | Value |
|---------|-------|
| Card padding | 20px |
| Card gap (vertical items) | 8px–12px |
| Grid gap (cards) | 16px–24px |
| Section padding | 48px–80px vertical |
| Page horizontal padding | 64px (design) / 16px (mobile) |
| Header padding | 20px vertical |
| Footer padding | 32px vertical |
| Button padding (primary) | 16px 32px |
| Button padding (small) | 4px 12px |
| Input padding | 6px 12px |

---

## 8. Dark Mode

- Triggered by `.dark` class on `<html>` element
- Persisted in `localStorage` key `"theme"`
- FOUC prevention: inline `<script>` in `<head>` applies class before hydration
- All theme colors swap via CSS variables (see Section 2.1)
- CRT terminal is unchanged between themes (always dark)
- Charts must use CSS variables (`var(--border-color)`, etc.) for automatic theme switching

---

## 9. Accessibility & Motion

- All interactive elements must have visible focus states
- Focus ring: `box-shadow: 0 0 0 2px rgba(43, 108, 176, 0.15)` with `border-color: var(--accent-blue)`
- Reduced motion: all animations disabled via `prefers-reduced-motion: reduce`
- Color contrast: text-primary on bg-page meets WCAG AA
- Chart tooltips positioned to stay within viewport
- Keyboard navigation for model selector checkboxes

---

## 10. Responsive Breakpoints

| Breakpoint | Behavior |
|-----------|----------|
| `< 768px` (mobile) | Single column, sidebar above content, charts stacked |
| `768px–1024px` (tablet) | Sidebar collapses, charts in single column |
| `> 1024px` (desktop) | Full layout: sidebar + 2-column charts |

---

## 11. Internationalization

- Two locales: `zh` (Chinese, default) and `en` (English)
- All visible text goes through `t()` function from `useLocale()` hook
- Translation keys use dot-notation: `compare.radarTitle`, `chart.paretoFrontier`
- Category labels: dynamic via `getCategoryLabel(key)`
- Provider names stay in original language (not translated)
- Price format: always `$X.XX` with dollar sign
- Unconfirmed prices prefixed with `~`

---

## 12. Do's and Don'ts

### Do
- Use sharp corners (0 border-radius) everywhere
- Use VT323 for all numerical/data values
- Use EB Garamond for all headings and section titles
- Use CSS variables for all theme-dependent colors
- Keep cards on `paper-card` pattern with 1px borders
- Use provider's brand color for provider tags
- Keep CRT effects only in decorative terminal widget

### Don't
- Don't use border-radius anywhere (no `rounded-*` classes)
- Don't use gradient text effects or glow effects
- Don't use glassmorphism (blur/backdrop-filter)
- Don't use colored shadows
- Don't use circular radar grids (always pentagon)
- Don't hardcode light/dark colors — always use CSS variables
- Don't put CRT/scanline effects on functional UI elements
- Don't use emojis in UI (use SVG icons)
