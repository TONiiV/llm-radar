"use client"

import { useEffect, useRef, useState } from "react"

interface AnimatedContentProps {
  children: React.ReactNode
  className?: string
  direction?: "up" | "down" | "left" | "right" | "none"
  distance?: number
  duration?: number
  delay?: number
  stagger?: number
  threshold?: number
}

export default function AnimatedContent({
  children,
  className = "",
  direction = "up",
  distance = 30,
  duration = 600,
  delay = 0,
  threshold = 0.1,
}: AnimatedContentProps) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [threshold])

  const getTransform = () => {
    if (isVisible) return "translate(0, 0)"
    switch (direction) {
      case "up": return `translate(0, ${distance}px)`
      case "down": return `translate(0, -${distance}px)`
      case "left": return `translate(${distance}px, 0)`
      case "right": return `translate(-${distance}px, 0)`
      case "none": return "translate(0, 0)"
    }
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{
        transition: `opacity ${duration}ms ease-out ${delay}ms, transform ${duration}ms ease-out ${delay}ms`,
        opacity: isVisible ? 1 : 0,
        transform: getTransform(),
      }}
    >
      {children}
    </div>
  )
}
