import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type AdminDataResponse = {
  users: Array<{
    id: string
    email: string
    fname: string | null
    lname: string | null
    type: string
    createdAt: Date
  }>
  friendships: Array<{
    user_id1: string
    user_id2: string
    status: string
    createdAt: Date
  }>
  schedules: Array<{
    id: string
    userId: string
    name: string
    createdAt: Date
  }>
  events: Array<{
    id: string
    scheduleId: string
    name: string
    description: string | null
    start: Date[]
    end: Date[]
    repeated: string
    repeatUntil: Date | null
    createdAt: Date
  }>
}

export async function GET() {
  const session = await auth()

  if (!session || session.user.type !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const [users, friendships, schedules, events] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          fname: true,
          lname: true,
          type: true,
          createdAt: true,
        },
      }),
      prisma.friendship.findMany(),
      prisma.schedule.findMany(),
      prisma.event.findMany(),
    ])

    const response: AdminDataResponse = {
      users,
      friendships,
      schedules,
      // Prisma types may be out of sync - start and end are arrays in the schema
      events: events as AdminDataResponse["events"],
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Error fetching data:", error)
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 })
  }
}

