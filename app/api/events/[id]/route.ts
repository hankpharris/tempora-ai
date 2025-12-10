import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const isoDateSchema = z.string().datetime().describe("ISO-8601 timestamp, e.g. 2024-11-18T13:30:00Z")

const timeSlotSchema = z.object({
  start: isoDateSchema,
  end: isoDateSchema,
})

const updateEventSchema = z.object({
  name: z.string().min(1, "Event name is required").optional(),
  description: z.string().nullable().optional(),
  timeSlots: z.array(timeSlotSchema).min(1).optional(),
  slotIndex: z.number().int().nonnegative().optional(),
  repeated: z.enum(["NEVER", "DAILY", "WEEKLY", "MONTHLY"]).optional(),
  repeatUntil: z
    .union([
      z.string().datetime(),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use format YYYY-MM-DD"),
    ])
    .nullable()
    .optional(),
})

function parseIsoDate(value: string, label: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${label}. Use an ISO-8601 timestamp.`)
  }
  return parsed
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!eventId) {
    return NextResponse.json({ error: "Event id is required" }, { status: 400 })
  }

  const body = await req.json()
  const parsed = updateEventSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors.map((e) => e.message).join(", ") }, { status: 400 })
  }

  try {
    const current = await prisma.event.findFirst({
      where: { id: eventId, schedule: { userId: session.user.id } },
      select: {
        id: true,
        name: true,
        description: true,
        start: true,
        end: true,
        repeated: true,
        repeatUntil: true,
      },
    })

    if (!current) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const data = parsed.data
    let updatedStart = [...current.start]
    let updatedEnd = [...current.end]

    if (data.timeSlots) {
      // Update a specific slot if slotIndex is provided and exactly one slot was sent.
      if (typeof data.slotIndex === "number" && data.timeSlots.length === 1) {
        const idx = data.slotIndex
        if (idx < 0 || idx >= updatedStart.length) {
          return NextResponse.json({ error: "Invalid slot index" }, { status: 400 })
        }
        const slot = data.timeSlots[0]
        if (!slot) {
          return NextResponse.json({ error: "Missing time slot data" }, { status: 400 })
        }
        const startDate = parseIsoDate(slot.start, "timeSlots[0].start")
        const endDate = parseIsoDate(slot.end, "timeSlots[0].end")
        if (endDate <= startDate) {
          return NextResponse.json({ error: "End time must be after start time." }, { status: 400 })
        }
        updatedStart[idx] = startDate
        updatedEnd[idx] = endDate
      } else {
        // Replace all time slots
        const starts: Date[] = []
        const ends: Date[] = []
        for (let i = 0; i < data.timeSlots.length; i++) {
          const slot = data.timeSlots[i]
          if (!slot) {
            return NextResponse.json({ error: `Time slot ${i + 1} is missing` }, { status: 400 })
          }
          const startDate = parseIsoDate(slot.start, `timeSlots[${i}].start`)
          const endDate = parseIsoDate(slot.end, `timeSlots[${i}].end`)
          if (endDate <= startDate) {
            return NextResponse.json({ error: `Time slot ${i + 1}: end time must be after start time.` }, { status: 400 })
          }
          starts.push(startDate)
          ends.push(endDate)
        }
        updatedStart = starts
        updatedEnd = ends
      }
    }

    const nextRepeatUntil = data.repeatUntil === undefined
      ? current.repeatUntil
      : data.repeatUntil === null
        ? null
        : parseIsoDate(
            data.repeatUntil.length === 10 ? `${data.repeatUntil}T00:00` : data.repeatUntil,
            "repeatUntil",
          )

    if (nextRepeatUntil && updatedStart[0] && nextRepeatUntil <= updatedStart[0]) {
      return NextResponse.json({ error: "repeatUntil must be after the first time slot." }, { status: 400 })
    }

    await prisma.event.update({
      where: { id: eventId },
      data: {
        name: data.name ?? current.name,
        description: data.description ?? current.description,
        start: updatedStart,
        end: updatedEnd,
        repeated: (data.repeated as typeof current.repeated | undefined) ?? current.repeated,
        repeatUntil: nextRepeatUntil,
      },
    })

    return NextResponse.json({ message: "Event updated" }, { status: 200 })
  } catch (error) {
    console.error("PATCH /api/events/[id] error", error)
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 })
  }
}
