"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import type { Sources } from "@/lib/types"

interface SourceIconProps {
  sourceKey?: string
  sources: Sources
  size?: number
}

export default function SourceIcon({ sourceKey, sources, size = 14 }: SourceIconProps) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLSpanElement>(null)
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null)

  const source = sourceKey ? sources[sourceKey] : null

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    setPopupPos({
      top: rect.top - 4,
      left: rect.left + rect.width / 2,
    })
  }, [])

  // Position popup and close on outside click
  useEffect(() => {
    if (!open) return
    updatePosition()

    function handleClick(e: MouseEvent) {
      if (
        buttonRef.current?.contains(e.target as Node) ||
        popupRef.current?.contains(e.target as Node)
      ) return
      setOpen(false)
    }
    function handleScroll() {
      setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    window.addEventListener("scroll", handleScroll, true)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      window.removeEventListener("scroll", handleScroll, true)
    }
  }, [open, updatePosition])

  if (!source) return null

  return (
    <span className="inline-flex items-center flex-shrink-0 ml-0.5">
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        className="inline-flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
        style={{ width: size + 4, height: size + 4 }}
        aria-label={`Source: ${source.name}`}
        title={source.name}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-txt-muted hover:text-txt-secondary transition-colors"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      </button>
      {open && popupPos && createPortal(
        <span
          ref={popupRef}
          className="fixed z-[9999] px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap shadow-lg border border-border bg-card"
          style={{
            top: popupPos.top,
            left: popupPos.left,
            transform: "translate(-50%, -100%)",
            minWidth: 80,
          }}
        >
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-blue hover:underline font-mono"
            onClick={(e) => e.stopPropagation()}
          >
            {source.name} ↗
          </a>
        </span>,
        document.body
      )}
    </span>
  )
}
