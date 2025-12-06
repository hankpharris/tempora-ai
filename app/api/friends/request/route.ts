import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { targetUserId } = (await request.json()) as { targetUserId: string }

  if (!targetUserId) {
    return NextResponse.json({ error: "Missing targetUserId" }, { status: 400 })
  }

  if (targetUserId === session.user.id) {
     return NextResponse.json({ error: "Cannot friend yourself" }, { status: 400 })
  }

  // Check if friendship already exists
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { user_id1: session.user.id, user_id2: targetUserId },
        { user_id1: targetUserId, user_id2: session.user.id },
      ],
    },
  })

  if (existing) {
    return NextResponse.json({ error: "Friendship already exists or is pending" }, { status: 409 })
  }

  const friendship = await prisma.friendship.create({
    data: {
      user_id1: session.user.id,
      user_id2: targetUserId,
      status: "PENDING",
    },
  })

  return NextResponse.json(friendship)
}

