import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const currentUserId = session.user.id

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { user_id1: currentUserId, user_id2: { not: currentUserId } },
        { user_id2: currentUserId, user_id1: { not: currentUserId } },
      ],
      status: "ACCEPTED",
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
      user2: {
        select: {
          id: true,
          fname: true,
          lname: true,
          email: true,
          image: true,
        },
      },
    },
  })

  // Normalize the list to just return the "other" user
  const friends = friendships.map((f) => {
    return f.user_id1 === currentUserId ? f.user2 : f.user1
  })

  return NextResponse.json(friends)
}

