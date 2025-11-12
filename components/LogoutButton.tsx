"use client"

import { Button } from "@heroui/react"
import { signOut } from "next-auth/react"

export function LogoutButton() {
  return (
    <Button
      color="danger"
      variant="light"
      onPress={() => signOut({ callbackUrl: "/login" })}
    >
      Logout
    </Button>
  )
}

