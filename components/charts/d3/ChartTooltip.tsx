"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { createPortal } from "react-dom"

export interface TooltipData {
  x: number
  y: number
  content: React.ReactNode
}

interface ChartTooltipProps {
  data: TooltipData | null
}

export function ChartTooltip({ data }: ChartTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !data) return null

  const style: React.CSSProperties = {
    position: "fixed",
    left: data.x + 12,
    top: data.y - 10,
    pointerEvents: "none",
    zIndex: 9999,
    transform: "translateY(-50%)",
  }

  return createPortal(
    <div
      ref={tooltipRef}
      className="paper-card-flat p-3 text-sm"
      style={style}
    >
      {data.content}
    </div>,
    document.body
  )
}

export function useTooltip() {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const containerRef = useRef<SVGSVGElement | null>(null)

  const showTooltip = useCallback((e: React.MouseEvent, content: React.ReactNode) => {
    setTooltip({
      x: e.clientX,
      y: e.clientY,
      content,
    })
  }, [])

  const moveTooltip = useCallback((e: React.MouseEvent) => {
    setTooltip((prev) =>
      prev ? { ...prev, x: e.clientX, y: e.clientY } : null
    )
  }, [])

  const hideTooltip = useCallback(() => {
    setTooltip(null)
  }, [])

  return { tooltip, showTooltip, moveTooltip, hideTooltip, containerRef }
}
