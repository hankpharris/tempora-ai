"use client"

import { Button, Card, CardBody, CardHeader, Input } from "@heroui/react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { useState } from "react"

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("Invalid email or password")
        setIsLoading(false)
        return
      }

      if (result?.ok) {
        router.push("/admin")
        router.refresh()
      }
    } catch {
      setError("An error occurred. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-br from-primary-50/60 via-default-100/60 to-background p-6 transition-colors">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute bottom-10 left-10 h-56 w-56 rounded-full bg-secondary/20 blur-3xl" />
      </div>

      <Card className="relative z-10 w-full max-w-xl rounded-3xl border border-primary/20 bg-content1/90 shadow-2xl backdrop-blur-xl dark:border-primary/30 dark:bg-content1/80">
        <CardHeader className="flex flex-col gap-2 px-8 pt-8 pb-4 sm:px-10 sm:pt-10">
          <span className="text-sm font-medium uppercase tracking-[0.2em] text-primary/80">
            Welcome back
          </span>
          <h1 className="text-3xl font-semibold text-foreground">Admin Console</h1>
          <p className="text-sm text-default-600">
            Enter your credentials to review schedules, events, and user activity.
          </p>
        </CardHeader>
        <CardBody className="gap-6 px-8 pb-8 pt-4 sm:px-10 sm:pb-10">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="email"
                className="text-sm font-semibold tracking-wide text-default-600"
              >
                Email address
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                variant="bordered"
                radius="lg"
                color="primary"
                isRequired
                autoComplete="email"
                placeholder="you@tempora.ai"
                classNames={{
                  inputWrapper:
                    "bg-content1/80 border border-primary/30 hover:border-primary/50 focus-within:border-primary shadow-sm",
                  input: "text-base text-foreground",
                }}
                startContent={
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4 text-primary-500"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    viewBox="0 0 24 24"
                  >
                    <path d="M3 7a2 2 0 012-2h14a2 2 0 012 2v.35l-9 5.4-9-5.4V7z" />
                    <path d="M21 8.65l-9 5.4-9-5.4V17a2 2 0 002 2h14a2 2 0 002-2z" />
                  </svg>
                }
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-sm font-semibold tracking-wide text-default-600"
                >
                  Password
                </label>
                <span className="text-xs uppercase tracking-[0.2em] text-default-400">
                  Required
                </span>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                variant="bordered"
                radius="lg"
                color="primary"
                isRequired
                autoComplete="current-password"
                placeholder="Enter your secure key"
                classNames={{
                  inputWrapper:
                    "bg-content1/80 border border-primary/30 hover:border-primary/50 focus-within:border-primary shadow-sm",
                  input: "text-base text-foreground",
                }}
                startContent={
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4 text-primary-500"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    viewBox="0 0 24 24"
                  >
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                    <rect height="9" rx="2" width="14" x="5" y="11" />
                    <path d="M12 15v2" />
                  </svg>
                }
              />
            </div>
            {error && (
              <div className="rounded-xl border border-danger/20 bg-danger-50/60 px-4 py-3 text-sm text-danger shadow-sm">
                {error}
              </div>
            )}
            <Button
              type="submit"
              color="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full font-semibold shadow-lg shadow-primary/30"
            >
              Sign In
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}

