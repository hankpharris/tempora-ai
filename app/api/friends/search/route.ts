import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get("query")

  if (!query || query.length < 2) {
    return NextResponse.json([])
  }

  const currentUserId = session.user.id

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: query, mode: "insensitive" } },
        { fname: { contains: query, mode: "insensitive" } },
        { lname: { contains: query, mode: "insensitive" } },
      ],
      NOT: {
        id: currentUserId,
      },
      // type: "USER", // Removed to allow searching for admins too
    },
    take: 10,
    select: {
      id: true,
      fname: true,
      lname: true,
      email: true,
      image: true,
    },
  })

  // Check friendship status for each user
  const results = await Promise.all(
    users.map(async (user) => {
      // Check both directions
      const friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { user_id1: currentUserId, user_id2: user.id },
            { user_id1: user.id, user_id2: currentUserId },
          ],
        },
      })

      let status: string = "NONE"
      if (friendship) {
        status = friendship.status
        // If pending, we might want to know who sent it
        if (friendship.status === "PENDING") {
           // If I am user1, I sent it. If I am user2, I received it.
           // We can encode this or just return the status.
           // For simple UI: "Pending (Sent)" vs "Pending (Received)" could be useful but "Pending" is okay for now.
           // Actually, the UI might want to show "Accept" button if received.
        }
      }

      return {
        ...user,
        friendshipStatus: status,
        friendshipSenderId: friendship?.user_id1,
      }
    })
  )

  return NextResponse.json(results)
}

