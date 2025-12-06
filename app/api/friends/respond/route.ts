import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { requesterId, action } = (await request.json()) as { requesterId: string; action: string }

  if (!requesterId) {
    return NextResponse.json({ error: "Missing requesterId" }, { status: 400 })
  }

  if (!action || !["ACCEPT", "DECLINE"].includes(action)) {
     return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  // Verify the friendship exists and is pending for this user
  const friendship = await prisma.friendship.findUnique({
    where: {
      user_id1_user_id2: {
        user_id1: requesterId,
        user_id2: session.user.id,
      },
    },
  })

  if (!friendship || friendship.status !== "PENDING") {
    return NextResponse.json({ error: "Friend request not found or not pending" }, { status: 404 })
  }

  const newStatus = action === "ACCEPT" ? "ACCEPTED" : "DECLINED"

  const updatedFriendship = await prisma.friendship.update({
    where: {
      user_id1_user_id2: {
        user_id1: requesterId,
        user_id2: session.user.id,
      },
    },
    data: {
      status: newStatus,
    },
  })

  return NextResponse.json(updatedFriendship)
}

