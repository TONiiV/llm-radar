"use client"

interface StarBorderProps {
  children: React.ReactNode
  className?: string
  color?: string
  speed?: number
  borderWidth?: number
  borderRadius?: string
}

export default function StarBorder({
  children,
  className = "",
  color = "#34d399",
  speed = 4,
  borderWidth = 1,
  borderRadius = "1rem",
}: StarBorderProps) {
  return (
    <div
      className={`star-border-container ${className}`}
      style={{
        "--star-color": color,
        "--star-speed": `${speed}s`,
        "--star-border-width": `${borderWidth}px`,
        "--star-border-radius": borderRadius,
        position: "relative",
        borderRadius,
      } as React.CSSProperties}
    >
      <div
        className="star-border-glow"
        style={{
          position: "absolute",
          inset: `-${borderWidth}px`,
          borderRadius,
          overflow: "hidden",
          zIndex: 0,
        }}
      >
        <div
          className="animate-star-rotate"
          style={{
            position: "absolute",
            inset: "-50%",
            background: `conic-gradient(from 0deg, transparent 0%, ${color} 10%, transparent 20%)`,
          }}
        />
      </div>
      <div
        style={{
          position: "relative",
          zIndex: 1,
          borderRadius,
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  )
}
