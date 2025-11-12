import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      type: string
    } & DefaultSession["user"]
  }

  interface User {
    type: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    type: string
  }
}

