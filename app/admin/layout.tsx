import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function AdminPageWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session || session.user.type !== "ADMIN") {
    redirect("/login")
  }

  return <>{children}</>
}
