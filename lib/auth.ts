import bcrypt from "bcryptjs"
import NextAuth, { type DefaultSession } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { env } from "@/env.mjs"
import { prisma } from "@/lib/prisma"

type UserWithPassword = {
  id: string
  email: string
  name: string | null
  type: string
  password: string | null
}

type AuthorizedUser = {
  id: string
  email: string
  name: string | null
  type: string
}

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials): Promise<AuthorizedUser | null> {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        const userWithPassword = user as UserWithPassword | null

        if (!userWithPassword || !userWithPassword.password) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          userWithPassword.password,
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: userWithPassword.id,
          email: userWithPassword.email,
          name: userWithPassword.name,
          type: userWithPassword.type,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({
      token,
      user,
    }: {
      token: { id?: string; type?: string }
      user?: AuthorizedUser
    }) {
      if (user) {
        token.id = user.id
        token.type = user.type
      }
      return token
    },
    async session({
      session,
      token,
    }: {
      session: DefaultSession
      token: { id?: string; type?: string }
    }): Promise<DefaultSession> {
      if (session.user && token.id && token.type) {
        session.user.id = token.id
        session.user.type = token.type
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt" as const,
  },
  secret: env.AUTH_SECRET,
}

// Create and export auth instance for server-side usage
export const { auth, handlers } = NextAuth(authOptions as Parameters<typeof NextAuth>[0])

