"use client"

import { Button, Card, CardBody, CardHeader, Input } from "@heroui/react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import Link from "next/link"
import { MovingBlob } from "./MovingBlob"

export function SignupForm() {
  const router = useRouter()
  const [fname, setFname] = useState("")
  const [lname, setLname] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fname,
          lname,
          email,
          password,
        }),
      })

      if (res.ok) {
        router.push("/login")
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || "Registration failed")
        setIsLoading(false)
      }
    } catch {
      setError("An error occurred. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-br from-primary-50/60 via-default-100/60 to-background p-6 transition-colors">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <MovingBlob
          size={360}
          speed={52}
          overshoot={180}
          colorClass="bg-primary/28"
          blurClass="blur-3xl"
          className="mix-blend-screen"
        />
        <MovingBlob
          size={280}
          speed={64}
          delay={1500}
          overshoot={140}
          colorClass="bg-secondary/20"
          blurClass="blur-3xl"
          className="mix-blend-screen"
        />
        <MovingBlob
          size={420}
          speed={48}
          delay={2600}
          overshoot={220}
          colorClass="bg-primary/18"
          blurClass="blur-[120px]"
          className="hidden sm:block mix-blend-screen"
        />
      </div>

      <Card className="relative z-10 w-full max-w-xl rounded-3xl border border-primary/20 bg-content1/90 shadow-2xl backdrop-blur-xl dark:border-primary/30 dark:bg-content1/80">
        <CardHeader className="flex flex-col gap-2 px-8 pt-8 pb-4 sm:px-10 sm:pt-10">
          <span className="text-sm font-medium uppercase tracking-[0.2em] text-primary/80">
            Get Started
          </span>
          <h1 className="text-3xl font-semibold text-foreground">Create Account</h1>
          <p className="text-sm text-default-600">
            Enter your details to create a new account.
          </p>
        </CardHeader>
        <CardBody className="gap-6 px-8 pb-8 pt-4 sm:px-10 sm:pb-10">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex gap-4">
              <div className="flex flex-1 flex-col gap-2">
                <label
                  htmlFor="fname"
                  className="text-sm font-semibold tracking-wide text-default-600"
                >
                  First Name
                </label>
                <Input
                  id="fname"
                  type="text"
                  value={fname}
                  onChange={(e) => setFname(e.target.value)}
                  variant="bordered"
                  radius="lg"
                  color="primary"
                  isRequired
                  placeholder="John"
                  classNames={{
                    inputWrapper:
                      "bg-content1/80 border border-primary/30 hover:border-primary/50 focus-within:border-primary shadow-sm ps-3",
                    innerWrapper: "gap-3",
                    input: "text-base text-foreground pr-2",
                  }}
                />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <label
                  htmlFor="lname"
                  className="text-sm font-semibold tracking-wide text-default-600"
                >
                  Last Name
                </label>
                <Input
                  id="lname"
                  type="text"
                  value={lname}
                  onChange={(e) => setLname(e.target.value)}
                  variant="bordered"
                  radius="lg"
                  color="primary"
                  isRequired
                  placeholder="Doe"
                  classNames={{
                    inputWrapper:
                      "bg-content1/80 border border-primary/30 hover:border-primary/50 focus-within:border-primary shadow-sm ps-3",
                    innerWrapper: "gap-3",
                    input: "text-base text-foreground pr-2",
                  }}
                />
              </div>
            </div>

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
                    "bg-content1/80 border border-primary/30 hover:border-primary/50 focus-within:border-primary shadow-sm ps-1",
                  innerWrapper: "gap-3",
                  input: "text-base text-foreground pl-1.5 pr-2",
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
                autoComplete="new-password"
                placeholder="Create a password"
                classNames={{
                  inputWrapper:
                    "bg-content1/80 border border-primary/30 hover:border-primary/50 focus-within:border-primary shadow-sm ps-1",
                  innerWrapper: "gap-3",
                  input: "text-base text-foreground pl-1.5 pr-2",
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
              radius="lg"
              className="w-full rounded-2xl font-semibold shadow-lg shadow-primary/30"
            >
              Create Account
            </Button>

            <p className="text-center text-sm text-default-500">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}

