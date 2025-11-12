import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

export const env = createEnv({
  server: {
    ANALYZE: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
    DATABASE_URL: z.string().url(),
    // Use STACK_SECRET_SERVER_KEY from NeonDB Stack Auth, fallback to AUTH_SECRET
    AUTH_SECRET: z.string().min(1),
    AUTH_URL: z.string().url().optional(),
    // NeonDB Stack Auth variables
    STACK_SECRET_SERVER_KEY: z.string().optional(),
    NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY: z.string().optional(),
  },
  runtimeEnv: {
    ANALYZE: process.env.ANALYZE,
    DATABASE_URL: process.env.DATABASE_URL,
    // Use STACK_SECRET_SERVER_KEY if available, otherwise use AUTH_SECRET
    // This ensures NextAuth has a secret key from NeonDB Stack Auth
    AUTH_SECRET:
      process.env.STACK_SECRET_SERVER_KEY ||
      process.env.AUTH_SECRET ||
      (() => {
        throw new Error(
          "AUTH_SECRET or STACK_SECRET_SERVER_KEY must be set. Please check your .env.local file.",
        )
      })(),
    AUTH_URL: process.env.AUTH_URL,
    STACK_SECRET_SERVER_KEY: process.env.STACK_SECRET_SERVER_KEY,
    NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY: process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY,
  },
})
