"use client"

import { useEffect, useRef, useState } from "react"

interface BlurTextProps {
  text: string
  className?: string
  delay?: number
  duration?: number
  blur?: number
  as?: "p" | "span" | "h1" | "h2" | "h3"
}

export default function BlurText({
  text,
  className = "",
  delay = 0,
  duration = 800,
  blur = 10,
  as: Tag = "p",
}: BlurTextProps) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref as any}
      className={`transition-all ${className}`}
      style={{
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`,
        filter: isVisible ? "blur(0px)" : `blur(${blur}px)`,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(10px)",
      }}
    >
      {text}
    </Tag>
  )
}
