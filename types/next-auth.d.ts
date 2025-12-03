import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      type: string
      fname?: string | null
      lname?: string | null
    } & DefaultSession["user"]
  }

  interface User {
    type: string
    fname?: string | null
    lname?: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    type: string
    fname?: string | null
    lname?: string | null
  }
}
