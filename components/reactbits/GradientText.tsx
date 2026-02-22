"use client"

interface GradientTextProps {
  children: React.ReactNode
  className?: string
  from?: string
  via?: string
  to?: string
  animate?: boolean
  as?: "span" | "h1" | "h2" | "h3" | "p"
}

export default function GradientText({
  children,
  className = "",
  from = "#3b82f6",
  via = "#8b5cf6",
  to = "#3b82f6",
  animate = true,
  as: Tag = "span",
}: GradientTextProps) {
  return (
    <Tag
      className={`inline-block bg-clip-text text-transparent ${animate ? "animate-gradient-shift" : ""} ${className}`}
      style={{
        backgroundImage: `linear-gradient(90deg, ${from}, ${via}, ${to}, ${from})`,
        backgroundSize: animate ? "200% auto" : "100% auto",
      }}
    >
      {children}
    </Tag>
  )
}
