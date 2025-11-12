"use client"

import { HeroUIProvider } from "@heroui/react"
import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "next-themes"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        value={{
          light: "light",
          dark: "dark",
        }}
      >
        <HeroUIProvider className="min-h-screen bg-background text-foreground">
          {children}
        </HeroUIProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}

