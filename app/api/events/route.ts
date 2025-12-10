import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const isoDateSchema = z.string().datetime().describe("ISO-8601 timestamp, e.g. 2024-11-18T13:30:00Z")

const timeSlotSchema = z.object({
  start: isoDateSchema.describe("When this time slot starts"),
  end: isoDateSchema.describe("When this time slot ends"),
})

const createEventSchema = z.object({
  scheduleId: z.string().min(1, "scheduleId is required").optional(),
  name: z.string().min(1, "Event name is required"),
  description: z.string().optional(),
  timeSlots: z.array(timeSlotSchema).min(1, "At least one time slot is required"),
  repeated: z.enum(["NEVER", "DAILY", "WEEKLY", "MONTHLY"]).optional().default("NEVER"),
  repeatUntil: isoDateSchema.optional().nullable(),
})

function parseIsoDate(value: string, label: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${label}. Use an ISO-8601 timestamp.`)
  }
  return parsed
}

function serializeEvent(event: {
  id: string
  scheduleId: string
  name: string
  description: string | null
  start: Date[]
  end: Date[]
  repeated: string
  repeatUntil: Date | null
}) {
  const timeSlots = event.start.map((startTime, idx) => {
    const endTime = event.end[idx] ?? startTime
    return {
      start: startTime.toISOString(),
      end: endTime.toISOString(),
      durationMinutes: Math.round((endTime.getTime() - startTime.getTime()) / 60000),
    }
  })

  return {
    id: event.id,
    scheduleId: event.scheduleId,
    name: event.name,
    description: event.description,
    timeSlots,
    repeated: event.repeated,
    repeatUntil: event.repeatUntil?.toISOString() ?? null,
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const data = createEventSchema.parse(body)

    // Validate and parse time slots
    const startDates: Date[] = []
    const endDates: Date[] = []
    for (let i = 0; i < data.timeSlots.length; i++) {
      const slot = data.timeSlots[i]
      if (!slot) continue
      const startDate = parseIsoDate(slot.start, `timeSlots[${i}].start`)
      const endDate = parseIsoDate(slot.end, `timeSlots[${i}].end`)

      if (endDate <= startDate) {
        return NextResponse.json({ error: `Time slot ${i + 1}: end time must be after start time.` }, { status: 400 })
      }

      startDates.push(startDate)
      endDates.push(endDate)
    }

    if (startDates.length === 0) {
      return NextResponse.json({ error: "At least one time slot is required." }, { status: 400 })
    }

    const repeatUntilDate = data.repeatUntil ? parseIsoDate(data.repeatUntil, "repeatUntil") : null
    if (repeatUntilDate && repeatUntilDate <= startDates[0]!) {
      return NextResponse.json({ error: "repeatUntil must be after the first time slot." }, { status: 400 })
    }

    // Ensure schedule belongs to user. If scheduleId not provided, pick the user's first schedule.
    let schedule
    if (data.scheduleId) {
      schedule = await prisma.schedule.findFirst({ where: { id: data.scheduleId, userId: session.user.id }, select: { id: true, name: true } })
      if (!schedule) return NextResponse.json({ error: "No schedule with that ID belongs to this user." }, { status: 403 })
    } else {
      schedule = await prisma.schedule.findFirst({ where: { userId: session.user.id }, select: { id: true, name: true } })
      if (!schedule) return NextResponse.json({ error: "No schedules found for this user. Provide a scheduleId." }, { status: 400 })
    }

    const event = await prisma.event.create({
      data: {
        scheduleId: schedule.id,
        name: data.name,
        description: data.description ?? null,
        start: startDates,
        end: endDates,
        repeated: (data.repeated as "NEVER" | "DAILY" | "WEEKLY" | "MONTHLY") ?? "NEVER",
        repeatUntil: repeatUntilDate,
      },
    })

    return NextResponse.json({ message: "Event created", event: serializeEvent(event) }, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues.map((i) => i.message).join(", ") }, { status: 400 })
    }
    console.error("/api/events error", error)
    const message = error instanceof Error ? error.message : "Something went wrong"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
