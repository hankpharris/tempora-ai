"use client"

import { Button, cn } from "@heroui/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

import { ThemeToggle } from "@/components/ThemeToggle"

const links = [
  { href: "/", label: "Overview" },
  { href: "/calendar", label: "Calendar" },
  { href: "/admin", label: "Admin" },
]

export function GlobalNavbar() {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href))

  return (
    <header className="relative sticky top-0 z-40 border-b border-primary/15 bg-background/90 backdrop-blur-xl dark:border-primary/25">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
      />
      <div className="mx-auto flex max-w-(--breakpoint-xl) items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/80 via-primary to-secondary/80 shadow-inner shadow-primary/30">
            <span className="text-lg font-black text-background">T</span>
            <div className="absolute inset-0 rounded-2xl ring-1 ring-primary/30 ring-offset-1 ring-offset-background" />
          </div>
          <div className="leading-tight">
            <p className="text-[11px] uppercase tracking-[0.32em] text-primary-700 dark:text-primary-200">
              Tempora
            </p>
            <p className="text-base font-semibold text-foreground">AI Calendar</p>
          </div>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-2 rounded-full border border-primary/10 bg-content1/70 px-1 py-1 shadow-inner shadow-primary/5 backdrop-blur md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all",
                isActive(link.href)
                  ? "bg-primary/20 text-foreground shadow-sm shadow-primary/20 ring-1 ring-primary/30"
                  : "text-default-600 hover:bg-primary/10 hover:text-foreground"
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary/60 shadow-[0_0_0_4px_rgba(102,204,138,0.18)]" />
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-content1/70 text-foreground shadow-sm shadow-primary/10 transition hover:border-primary/40 hover:bg-primary/10 md:hidden"
            aria-label="Toggle navigation menu"
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
              {isMenuOpen ? (
                <path stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" d="M6 6l12 12M6 18L18 6" />
              ) : (
                <path stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="mx-auto max-w-(--breakpoint-xl) space-y-2 px-4 pb-4 sm:px-6 md:hidden">
          <nav className="flex flex-col gap-2 rounded-2xl border border-primary/15 bg-content1/80 p-3 shadow-md shadow-primary/10 backdrop-blur">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  "flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                  isActive(link.href)
                    ? "bg-primary/20 text-foreground ring-1 ring-primary/30"
                    : "text-default-600 hover:bg-primary/10 hover:text-foreground"
                )}
              >
                {link.label}
                <span className="h-2 w-2 rounded-full bg-primary/50" />
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  )
}
