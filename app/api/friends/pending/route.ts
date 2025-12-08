import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const pendingRequests = await prisma.friendship.findMany({
    where: {
      user_id2: session.user.id,
      status: "PENDING",
    },
    include: {
      user1: {
        select: {
          id: true,
          fname: true,
          lname: true,
          email: true,
          image: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  return NextResponse.json(pendingRequests)
}

