"use client"

import { useEffect, useRef } from "react"

interface AuroraProps {
  colorOne?: string
  colorTwo?: string
  colorThree?: string
  speed?: number
  blur?: number
  opacity?: number
  className?: string
}

export default function Aurora({
  colorOne = "#1e3a5f",
  colorTwo = "#2d1b69",
  colorThree = "#0f2847",
  speed = 1,
  blur = 80,
  opacity = 0.6,
  className = "",
}: AuroraProps) {
  return (
    <div
      className={`aurora-container ${className}`}
      style={{ '--aurora-speed': `${20 / speed}s`, '--aurora-blur': `${blur}px`, '--aurora-opacity': opacity } as React.CSSProperties}
    >
      <div className="aurora-layer" style={{ background: `radial-gradient(ellipse 80% 50% at 20% 40%, ${colorOne}, transparent)` }} />
      <div className="aurora-layer aurora-layer-2" style={{ background: `radial-gradient(ellipse 60% 60% at 70% 60%, ${colorTwo}, transparent)` }} />
      <div className="aurora-layer aurora-layer-3" style={{ background: `radial-gradient(ellipse 70% 40% at 50% 30%, ${colorThree}, transparent)` }} />
    </div>
  )
}
