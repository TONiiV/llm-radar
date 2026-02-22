"use client"

import { useEffect, useRef, useState } from "react"

interface SplitTextProps {
  text: string
  className?: string
  delay?: number
  duration?: number
  as?: "h1" | "h2" | "h3" | "p" | "span"
}

export default function SplitText({
  text,
  className = "",
  delay = 50,
  duration = 600,
  as: Tag = "span",
}: SplitTextProps) {
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
    <Tag ref={ref as any} className={`inline-flex flex-wrap ${className}`} aria-label={text}>
      {text.split("").map((char, i) => (
        <span
          key={i}
          className="inline-block transition-all"
          style={{
            transitionDuration: `${duration}ms`,
            transitionDelay: isVisible ? `${i * delay}ms` : "0ms",
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(30px)",
          }}
          aria-hidden
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </Tag>
  )
}
