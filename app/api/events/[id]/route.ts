import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: { id: string }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const eventId = params.id
  if (!eventId) {
    return NextResponse.json({ error: "Event id is required" }, { status: 400 })
  }

  try {
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        schedule: { userId: session.user.id },
      },
      select: { id: true },
    })

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    await prisma.event.delete({ where: { id: eventId } })
    return NextResponse.json({ message: "Event deleted" }, { status: 200 })
  } catch (error) {
    console.error("DELETE /api/events/[id] error", error)
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 })
  }
}
