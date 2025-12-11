"use client"

import { cn } from "@heroui/react"
import Link from "next/link"
import { signOut, useSession } from "next-auth/react"
import { usePathname } from "next/navigation"
import { useState } from "react"

import { ThemeToggle } from "@/components/ThemeToggle"

const baseLinks = [
  { href: "/", label: "Overview" },
  { href: "/calendar", label: "Calendar" },
]

export function GlobalNavbar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const isAuthenticated = Boolean(session?.user)
  const isLoginPage = pathname === "/login"

  const isAdmin = session?.user?.type === "ADMIN"
  const links = isAdmin ? [...baseLinks, { href: "/admin", label: "Admin" }] : baseLinks
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href))
  const handleLogout = () => signOut({ callbackUrl: "/login" })

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
          {isAuthenticated ? (
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-sm font-semibold text-danger-600 shadow-sm shadow-danger/10 transition hover:border-danger/40 hover:bg-danger/10"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.6"
                  d="M15 17l5-5-5-5M4 12h16M4 5h5M4 19h5"
                />
              </svg>
              <span>Log out</span>
            </button>
          ) : (
            !isLoginPage && (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-foreground shadow-sm shadow-primary/10 transition hover:border-primary/50 hover:bg-primary/20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <path
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.6"
                    d="M9 7l-5 5 5 5M20 12H4M20 5h-5M20 19h-5"
                  />
                </svg>
                <span>Log in</span>
              </Link>
            )
          )}
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
            <div className="pt-1">
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false)
                    handleLogout()
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-sm font-semibold text-danger-600 shadow-sm shadow-danger/10 transition hover:border-danger/40 hover:bg-danger/10"
                >
                  <span>Log out</span>
                </button>
              ) : (
                !isLoginPage && (
                  <Link
                    href="/login"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-foreground shadow-sm shadow-primary/10 transition hover:border-primary/50 hover:bg-primary/20"
                  >
                    <span>Log in</span>
                  </Link>
                )
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
