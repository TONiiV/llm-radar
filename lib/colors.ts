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
}

export function getCategoryColor(key: string): string {
  return CATEGORY_COLORS[key] || "#94a3b8"
}
