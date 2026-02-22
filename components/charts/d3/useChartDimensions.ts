"use client"

import { useState, useEffect, useRef, useCallback } from "react"

export interface ChartDimensions {
  width: number
  height: number
}

export function useChartDimensions(
  aspectRatio?: number
): [React.RefObject<HTMLDivElement | null>, ChartDimensions] {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [dimensions, setDimensions] = useState<ChartDimensions>({
    width: 0,
    height: 0,
  })

  const updateDimensions = useCallback(() => {
    if (!containerRef.current) return
    const { width } = containerRef.current.getBoundingClientRect()
    const roundedWidth = Math.round(width)
    const height = aspectRatio ? roundedWidth * aspectRatio : Math.round(containerRef.current.getBoundingClientRect().height)
    setDimensions((prev) => {
      if (prev.width === roundedWidth && prev.height === height) return prev
      return { width: roundedWidth, height }
    })
  }, [aspectRatio])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    updateDimensions()

    const observer = new ResizeObserver(() => {
      updateDimensions()
    })
    observer.observe(el)

    return () => observer.disconnect()
  }, [updateDimensions])

  return [containerRef, dimensions]
}
