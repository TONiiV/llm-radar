"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLocale } from "@/lib/i18n-context"
import LocaleToggle from "@/components/LocaleToggle"
import { ThemeToggle } from "@/components/ThemeProvider"

interface NavbarProps {
  maxWidth?: string // e.g. "max-w-5xl", "max-w-6xl"
}

export default function Navbar({ maxWidth = "max-w-6xl" }: NavbarProps) {
  const pathname = usePathname()
  const { t } = useLocale()

  const links = [
    { href: "/compare", label: t("nav.compare") },
    { href: "/models", label: t("nav.models") },
  ]

  return (
    <header className="border-b border-border">
      <div className={`${maxWidth} mx-auto px-4 py-4 flex items-center justify-between`}>
        <Link href="/" className="font-heading text-2xl tracking-[3px] text-txt-primary">
          LLMRadar
        </Link>
        <nav className="hidden sm:flex items-center gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`font-body text-sm transition-colors ${
                pathname === link.href || pathname.startsWith(link.href + "/")
                  ? "text-accent-blue font-medium"
                  : "text-txt-secondary hover:text-txt-primary"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <LocaleToggle />
          <ThemeToggle />
        </nav>
        {/* Mobile hamburger menu */}
        <MobileMenu links={links} />
      </div>
    </header>
  )
}

// Mobile menu component - shown only on small screens
function MobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const containerRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    if (!open) return

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  return (
    <div className="sm:hidden" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 text-txt-secondary hover:text-txt-primary transition-colors"
        aria-label="Toggle menu"
      >
        {open ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 bg-bg-card border-b border-border shadow-lg z-50">
          <div className="px-4 py-3 space-y-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`block font-body text-sm transition-colors ${
                  pathname === link.href || pathname.startsWith(link.href + "/")
                    ? "text-accent-blue font-medium"
                    : "text-txt-secondary hover:text-txt-primary"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex items-center gap-4 pt-2 border-t border-border">
              <LocaleToggle />
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
