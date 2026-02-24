// Vibrant colors optimized for dark backgrounds
export const MODEL_COLORS = [
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
  "#f43f5e", // rose
  "#a78bfa", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
  "#f97316", // orange
  "#14b8a6", // teal
  "#e879f9", // fuchsia
  "#facc15", // yellow
]

export function getModelColor(index: number): string {
  return MODEL_COLORS[index % MODEL_COLORS.length]
}

export const CATEGORY_COLORS: Record<string, string> = {
  reasoning: "#3b82f6",
  coding: "#10b981",
  math: "#f59e0b",
  chat: "#8b5cf6",
  agentic: "#f43f5e",
  speed: "#06b6d4",
}

export function getCategoryColor(key: string): string {
  return CATEGORY_COLORS[key] || "#94a3b8"
}

// Provider colors — used as fallback when provider has no color in DB
export const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "#D97706",
  openai: "#10A37F",
  google: "#4285F4",
  xai: "#1DA1F2",
  deepseek: "#5B6CF0",
  meta: "#1877F2",
  mistral: "#FF7000",
  alibaba: "#FF6A00",
  zhipu: "#00D4AA",
  moonshot: "#8B5CF6",
  minimax: "#EC4899",
  nvidia: "#76B900",
}

// Generate a deterministic color from a string (for unknown providers)
export function getProviderColor(slug: string): string {
  if (PROVIDER_COLORS[slug]) return PROVIDER_COLORS[slug]
  // Hash-based fallback: generate a hue from the slug
  let hash = 0
  for (let i = 0; i < slug.length; i++) {
    hash = slug.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 65%, 55%)`
}
