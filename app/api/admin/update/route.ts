import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type UpdateRequestBody = {
  table: "users" | "friendships" | "schedules" | "events"
  id: string
  field: string
  value: string
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session || session.user.type !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as UpdateRequestBody
    const { table, id, field, value } = body

    // Validate required fields
    if (!table || !id || !field || value === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Convert value based on field type
    let processedValue: string | Date = value
    if (field.includes("At") || field === "start" || field === "end" || field === "emailVerified") {
      processedValue = new Date(value)
    }

    let result

    switch (table) {
      case "users": {
        result = await prisma.user.update({
          where: { id },
          data: { [field]: processedValue },
        })
        break
      }
      case "friendships": {
        // For composite key, we need to handle differently
        const parts = id.split("-")
        if (parts.length !== 2 || !parts[0] || !parts[1]) {
          return NextResponse.json({ error: "Invalid friendship ID format" }, { status: 400 })
        }
        const [user_id1, user_id2] = parts as [string, string]
        result = await prisma.friendship.update({
          where: {
            user_id1_user_id2: {
              user_id1,
              user_id2,
            },
          },
          data: { [field]: processedValue },
        })
        break
      }
      case "schedules": {
        result = await prisma.schedule.update({
          where: { id },
          data: { [field]: processedValue },
        })
        break
      }
      case "events": {
        result = await prisma.event.update({
          where: { id },
          data: { [field]: processedValue },
        })
        break
      }
      default: {
        return NextResponse.json({ error: "Invalid table" }, { status: 400 })
      }
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error("Error updating data:", error)
    return NextResponse.json({ error: "Failed to update data" }, { status: 500 })
  }
}

