import { ChatOpenAI } from "@langchain/openai"
import { AIMessage, createAgent, HumanMessage, SystemMessage, tool } from "langchain"
import { NextResponse } from "next/server"
import { z } from "zod"
import { env } from "@/env.mjs"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const imageContentPartSchema = z.object({
  type: z.literal("image_url"),
  image_url: z.object({
    url: z.string().min(1),
  }),
})

const textContentPartSchema = z.object({
  type: z.literal("text"),
  text: z.string().min(1),
})

const contentPartSchema = z.union([textContentPartSchema, imageContentPartSchema])

const messageContentSchema = z.union([
  z.string().min(1),
  z.array(contentPartSchema).min(1),
])

const userContextSchema = z.object({
  timezone: z.string().min(1),
  localTime: z.string().min(1),
  locale: z.string().optional(),
})

const requestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: messageContentSchema,
      }),
    )
    .min(1),
  userContext: userContextSchema.optional(),
})

const isoDateSchema = z
  .string()
  .datetime()
  .describe("ISO-8601 timestamp, for example 2024-11-18T13:30:00Z")

const timeSlotInputSchema = z.object({
  start: isoDateSchema.describe("When this time slot starts"),
  end: isoDateSchema.describe("When this time slot ends"),
})

const updateEventSchema = z
  .object({
    eventId: z.string().min(1, "eventId is required"),
    name: z.string().min(1).optional().describe("New event name/title"),
    description: z.string().optional().describe("New event description (pass empty string to clear)"),
    timeSlots: z.array(timeSlotInputSchema).min(1).optional().describe("Replace all time slots with new ones"),
    repeated: z.enum(["NEVER", "DAILY", "WEEKLY", "MONTHLY"]).optional().describe("New repeat frequency"),
    repeatUntil: isoDateSchema.nullable().optional().describe("New repeat end date (null to repeat forever)"),
    targetScheduleId: z.string().min(1).optional().describe("Move event to a different schedule"),
  })
  .superRefine((data, ctx) => {
    const hasUpdate = data.name !== undefined || 
                      data.description !== undefined || 
                      data.timeSlots !== undefined || 
                      data.repeated !== undefined || 
                      data.repeatUntil !== undefined || 
                      data.targetScheduleId !== undefined
    if (!hasUpdate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide at least one field to update (name, description, timeSlots, repeated, repeatUntil, or targetScheduleId).",
      })
    }
  })

type UserContext = z.infer<typeof userContextSchema>

function buildSystemPrompt(userContext?: UserContext) {
  const contextInfo = userContext
    ? `
User Context:
- Timezone: ${userContext.timezone}
- Local time: ${userContext.localTime}
- Locale: ${userContext.locale || "not specified"}

When the user mentions times like "tomorrow at 3pm" or "next Monday", interpret them in the user's timezone (${userContext.timezone}) and convert to UTC for storage.`
    : ""

  return `You are Tempora, a focused assistant that helps the currently authenticated user inspect and mutate their schedules and events.
${contextInfo}
Rules:
- Always call the provided tools when you need real data. Do not guess IDs or fabricate schedule contents.
- List schedules before referencing one, and list the events in question before updating or deleting them.
- For new events, confirm the target schedule and ensure the end time is after the start time.
- When updating, explain what changed and mention the schedule name.
- If the user has not supplied enough info (schedule, time window, etc.) ask a follow-up question.
- Do not attempt to clarify facts already known with relative certainty. 
    - For example if you check a users schedule list, and they only have one, you can assume this is what they are referring to when they ask about their schedule with reasonable certainty.
- Work in ISO-8601 timestamps (UTC) internally but present times to the user in their local timezone when possible.
- Keep explanations short. Finish with an actionable summary of what you did or still need.

You are configured on gpt-5-mini with tool access.`
}

type IncomingMessage = z.infer<typeof requestSchema>["messages"][number]
type ContentPart = z.infer<typeof contentPartSchema>

export async function POST(req: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { messages, userContext } = requestSchema.parse(body)

    const userId = session.user.id
    const systemPrompt = buildSystemPrompt(userContext)

    const listSchedulesTool = tool(
      async () => {
        const schedules = await prisma.schedule.findMany({
          where: { userId },
          include: {
            _count: { select: { events: true } },
            events: {
              take: 5,
            },
          },
          orderBy: { createdAt: "asc" },
        })

        return JSON.stringify(
          schedules.map((schedule) => ({
            id: schedule.id,
            name: schedule.name,
            createdAt: schedule.createdAt.toISOString(),
            eventCount: schedule._count.events,
            sampleEvents: schedule.events.map(serializeEvent),
          })),
          null,
          2,
        )
      },
      {
        name: "list_user_schedules",
        description: "List every schedule owned by the logged-in user along with a few example events.",
        schema: z.object({}),
      },
    )

    const listEventsTool = tool(
      async ({ scheduleId, from, to }: { scheduleId: string; from?: string; to?: string }) => {
        const schedule = await ensureScheduleOwnership(scheduleId, userId)
        const fromDate = from ? parseIsoDate(from, "from") : undefined
        const toDate = to ? parseIsoDate(to, "to") : undefined

        if (fromDate && toDate && fromDate > toDate) {
          throw new Error("The `from` time must be earlier than the `to` time.")
        }

        const allEvents = await prisma.event.findMany({
          where: {
            scheduleId: schedule.id,
          },
        })

        // Filter events by date range if provided
        // An event matches if any of its time slots overlaps with the date range
        let events = allEvents
        if (fromDate || toDate) {
          events = allEvents.filter((event) => {
            // Check if any time slot overlaps with the date range
            return event.start.some((startTime, idx) => {
              const endTime = event.end[idx] ?? startTime
              // Event overlaps if:
              // - It starts before the "to" date (or no "to" date)
              // - It ends after the "from" date (or no "from" date)
              const startsBeforeTo = !toDate || startTime <= toDate
              const endsAfterFrom = !fromDate || endTime >= fromDate
              return startsBeforeTo && endsAfterFrom
            })
          })
        }

        // Sort by earliest start time
        events.sort((a, b) => {
          const aMinStart = Math.min(...a.start.map(d => d.getTime()))
          const bMinStart = Math.min(...b.start.map(d => d.getTime()))
          return aMinStart - bMinStart
        })

        return JSON.stringify(
          {
            schedule,
            events: events.map(serializeEvent),
          },
          null,
          2,
        )
      },
      {
        name: "list_schedule_events",
        description: "Fetch the events for a specific schedule, optionally within a `from` to `to` range.",
        schema: z.object({
          scheduleId: z.string().min(1, "scheduleId is required"),
          from: isoDateSchema.optional(),
          to: isoDateSchema.optional(),
        }),
      },
    )

    const repeatFrequencySchema = z.enum(["NEVER", "DAILY", "WEEKLY", "MONTHLY"]).describe(
      "How often the event repeats. NEVER = one-time event, DAILY/WEEKLY/MONTHLY = recurring event"
    )

    const timeSlotSchema = z.object({
      start: isoDateSchema.describe("When this time slot starts"),
      end: isoDateSchema.describe("When this time slot ends"),
    })

    const createEventTool = tool(
      async ({ 
        scheduleId, 
        name, 
        description, 
        timeSlots, 
        repeated, 
        repeatUntil 
      }: { 
        scheduleId: string
        name: string
        description?: string
        timeSlots: Array<{ start: string; end: string }>
        repeated?: string
        repeatUntil?: string
      }) => {
        const schedule = await ensureScheduleOwnership(scheduleId, userId)
        const repeatUntilDate = repeatUntil ? parseIsoDate(repeatUntil, "repeatUntil") : null

        // Parse and validate all time slots
        const startDates: Date[] = []
        const endDates: Date[] = []

        for (let i = 0; i < timeSlots.length; i++) {
          const slot = timeSlots[i]
          if (!slot) continue
          const startDate = parseIsoDate(slot.start, `timeSlots[${i}].start`)
          const endDate = parseIsoDate(slot.end, `timeSlots[${i}].end`)

          if (endDate <= startDate) {
            throw new Error(`Time slot ${i + 1}: end time must be after start time.`)
          }

          startDates.push(startDate)
          endDates.push(endDate)
        }

        if (startDates.length === 0) {
          throw new Error("At least one time slot is required.")
        }

        if (repeatUntilDate && repeatUntilDate <= startDates[0]!) {
          throw new Error("repeatUntil must be after the first time slot.")
        }

        const event = await prisma.event.create({
          data: {
            scheduleId: schedule.id,
            name,
            description: description ?? null,
            start: startDates,
            end: endDates,
            repeated: (repeated as "NEVER" | "DAILY" | "WEEKLY" | "MONTHLY") ?? "NEVER",
            repeatUntil: repeatUntilDate,
          },
        })

        return JSON.stringify(
          {
            message: "Event created",
            schedule,
            event: serializeEvent(event),
          },
          null,
          2,
        )
      },
      {
        name: "create_calendar_event",
        description: `Create a new event inside one of the user's schedules.
- 'name' is the event title (e.g., "Team Meeting", "CS 101 Lecture")
- 'timeSlots' is an array of {start, end} pairs - use multiple slots for events that occur multiple times per repetition period
- 'repeated' controls recurrence: NEVER (default), DAILY, WEEKLY, or MONTHLY
- 'repeatUntil' is when the recurring event stops repeating (null = repeat forever)

Example 1: Simple weekly meeting (Mondays 2-3pm):
- timeSlots: [{start: "2024-12-02T14:00:00Z", end: "2024-12-02T15:00:00Z"}]
- repeated: "WEEKLY"

Example 2: Class that meets twice per week (Tue/Thu 10am-11:30am), repeating weekly:
- timeSlots: [
    {start: "2024-12-03T10:00:00Z", end: "2024-12-03T11:30:00Z"},  // Tuesday
    {start: "2024-12-05T10:00:00Z", end: "2024-12-05T11:30:00Z"}   // Thursday
  ]
- repeated: "WEEKLY"
- repeatUntil: "2024-05-15T23:59:59Z"`,
        schema: z.object({
          scheduleId: z.string().min(1, "scheduleId is required"),
          name: z.string().min(1, "Event name is required").describe("The title/name of the event"),
          description: z.string().optional().describe("Optional description or notes for the event"),
          timeSlots: z.array(timeSlotSchema).min(1, "At least one time slot is required").describe("Array of time slots - each has start and end timestamps"),
          repeated: repeatFrequencySchema.optional().default("NEVER"),
          repeatUntil: isoDateSchema.optional().describe("When to stop repeating (null = forever). Only relevant if repeated != NEVER"),
        }),
      },
    )

    const updateEventTool = tool(
      async ({ eventId, name, description, timeSlots, repeated, repeatUntil, targetScheduleId }: z.infer<typeof updateEventSchema>) => {
        const existing = await ensureEventOwnership(eventId, userId)

        const data: {
          name?: string
          description?: string | null
          start?: Date[]
          end?: Date[]
          repeated?: "NEVER" | "DAILY" | "WEEKLY" | "MONTHLY"
          repeatUntil?: Date | null
          scheduleId?: string
        } = {}

        if (name !== undefined) {
          data.name = name
        }
        if (description !== undefined) {
          data.description = description || null
        }
        if (timeSlots !== undefined) {
          const startDates: Date[] = []
          const endDates: Date[] = []

          for (let i = 0; i < timeSlots.length; i++) {
            const slot = timeSlots[i]
            if (!slot) continue
            const startDate = parseIsoDate(slot.start, `timeSlots[${i}].start`)
            const endDate = parseIsoDate(slot.end, `timeSlots[${i}].end`)

            if (endDate <= startDate) {
              throw new Error(`Time slot ${i + 1}: end time must be after start time.`)
            }

            startDates.push(startDate)
            endDates.push(endDate)
          }

          data.start = startDates
          data.end = endDates
        }
        if (repeated !== undefined) {
          data.repeated = repeated
        }
        if (repeatUntil !== undefined) {
          data.repeatUntil = repeatUntil ? parseIsoDate(repeatUntil, "repeatUntil") : null
        }

        let targetSchedule = existing.schedule

        if (targetScheduleId && targetScheduleId !== existing.scheduleId) {
          targetSchedule = await ensureScheduleOwnership(targetScheduleId, userId)
          data.scheduleId = targetSchedule.id
        }

        const updateData: {
          name?: string
          description?: string | null
          start?: Date[]
          end?: Date[]
          repeated?: "NEVER" | "DAILY" | "WEEKLY" | "MONTHLY"
          repeatUntil?: Date | null
          scheduleId?: string
        } = {}
        
        if (data.name !== undefined) updateData.name = data.name
        if (data.description !== undefined) updateData.description = data.description
        if (data.start !== undefined) updateData.start = data.start
        if (data.end !== undefined) updateData.end = data.end
        if (data.repeated !== undefined) updateData.repeated = data.repeated
        if (data.repeatUntil !== undefined) updateData.repeatUntil = data.repeatUntil
        if (data.scheduleId !== undefined) updateData.scheduleId = data.scheduleId

        const updated = await prisma.event.update({
          where: { id: eventId },
          data: updateData,
        })

        return JSON.stringify(
          {
            message: "Event updated",
            schedule: targetSchedule,
            before: serializeEvent(existing as unknown as Parameters<typeof serializeEvent>[0]),
            after: serializeEvent(updated),
          },
          null,
          2,
        )
      },
      {
        name: "update_calendar_event",
        description: "Update an event's details: name, description, time slots, recurrence settings, or move it to another schedule. Use timeSlots to replace all existing time slots.",
        schema: updateEventSchema,
      },
    )

    const deleteEventTool = tool(
      async ({ eventId }: { eventId: string }) => {
        const event = await ensureEventOwnership(eventId, userId)
        await prisma.event.delete({
          where: { id: eventId },
        })

        return JSON.stringify(
          {
            message: "Event deleted",
            schedule: event.schedule,
            event: serializeEvent(event as unknown as Parameters<typeof serializeEvent>[0]),
          },
          null,
          2,
        )
      },
      {
        name: "delete_calendar_event",
        description: "Delete a specific event that belongs to the current user.",
        schema: z.object({
          eventId: z.string().min(1, "eventId is required"),
        }),
      },
    )

    const tools = [listSchedulesTool, listEventsTool, createEventTool, updateEventTool, deleteEventTool]

    const llm = new ChatOpenAI({
      model: "gpt-5-mini",
      maxCompletionTokens: 4096,
      apiKey: env.OPENAI_API_KEY,
    })

    const agent = createAgent({
      model: llm,
      tools,
      systemPrompt,
    })

    const langChainMessages = mapToLangChainMessages(messages)

    console.log("[chatbot] Invoking agent with", langChainMessages.length, "messages")
    langChainMessages.forEach((msg, idx) => {
      const msgType = msg._getType()
      const hasImages = Array.isArray(msg.content) && 
        msg.content.some((c: unknown) => typeof c === "object" && c !== null && "type" in c && (c as { type: string }).type === "image_url")
      console.log(`[chatbot] Input[${idx}] type=${msgType}, hasImages=${hasImages}`)
    })

    const result = await agent.invoke({
      messages: langChainMessages,
    })

    const allMessages = result.messages ?? []
    console.log("[chatbot] Agent returned", allMessages.length, "messages")

    // Log all messages for debugging
    allMessages.forEach((msg: { _getType: () => string; content: unknown; tool_calls?: unknown[] }, idx: number) => {
      const msgType = msg._getType()
      const hasToolCalls = "tool_calls" in msg && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0
      const contentType = typeof msg.content
      const contentPreview = typeof msg.content === "string" 
        ? msg.content.slice(0, 150) 
        : Array.isArray(msg.content) 
          ? `[array of ${msg.content.length} parts]`
          : String(msg.content)
      console.log(`[chatbot] Result[${idx}] type=${msgType}, hasToolCalls=${hasToolCalls}, contentType=${contentType}, content=${contentPreview}`)
    })

    // Find the last AI message that has actual text content (not just tool calls)
    const aiMessagesWithContent = [...allMessages]
      .reverse()
      .filter((msg): msg is AIMessage => msg._getType() === "ai")
      .filter((msg) => {
        const content = normalizeContent(msg.content)
        return content.length > 0
      })

    const aiMessage = aiMessagesWithContent[0]

    if (!aiMessage) {
      // Fallback: get any AI message and check for tool_calls
      const anyAiMessage = [...allMessages].reverse().find((msg) => msg._getType() === "ai") as AIMessage | undefined
      
      if (anyAiMessage) {
        console.error("[chatbot] AI message found but has no text content")
        console.error("[chatbot] AI message content:", JSON.stringify(anyAiMessage.content, null, 2))
        console.error("[chatbot] AI message tool_calls:", JSON.stringify(anyAiMessage.tool_calls, null, 2))
        console.error("[chatbot] AI message additional_kwargs:", JSON.stringify(anyAiMessage.additional_kwargs, null, 2))
      } else {
        console.error("[chatbot] No AI message found at all. Message types:", allMessages.map((m: { _getType: () => string }) => m._getType()))
      }
      
      throw new Error("The assistant was unable to craft a response.")
    }

    const responseContent = normalizeContent(aiMessage.content)
    console.log("[chatbot] Final response length:", responseContent.length)

    if (!responseContent) {
      console.error("[chatbot] normalizeContent returned empty for AI message:", JSON.stringify(aiMessage.content, null, 2))
      return NextResponse.json({
        message: {
          role: "assistant",
          content: "I processed your request but couldn't formulate a text response. Please try again.",
        },
      })
    }

    return NextResponse.json({
      message: {
        role: "assistant",
        content: responseContent,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((issue) => issue.message).join(", ") },
        { status: 400 },
      )
    }
    console.error("[chatbot] request failed", error)
    return NextResponse.json(
      { error: "Something went wrong while contacting the assistant." },
      { status: 500 },
    )
  }
}

async function ensureScheduleOwnership(scheduleId: string, userId: string) {
  const schedule = await prisma.schedule.findFirst({
    where: { id: scheduleId, userId },
    select: { id: true, name: true },
  })

  if (!schedule) {
    throw new Error("No schedule with that ID belongs to this user.")
  }

  return schedule
}

async function ensureEventOwnership(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      schedule: {
        select: { id: true, name: true, userId: true },
      },
    },
  })

  if (!event || event.schedule.userId !== userId) {
    throw new Error("No event with that ID belongs to this user.")
  }

  return {
    ...event,
    schedule: {
      id: event.schedule.id,
      name: event.schedule.name,
    },
  }
}

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
  // Create time slots from parallel start/end arrays
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
    timeSlots, // Array of {start, end, durationMinutes}
    repeated: event.repeated,
    repeatUntil: event.repeatUntil?.toISOString() ?? null,
  }
}

function mapToLangChainMessages(messages: IncomingMessage[]) {
  return messages.map((message) => {
    const content = normalizeMessageContent(message.content)
    switch (message.role) {
      case "system":
        return new SystemMessage(typeof content === "string" ? content : extractTextFromContent(content))
      case "assistant":
        return new AIMessage(typeof content === "string" ? content : extractTextFromContent(content))
      default:
        return new HumanMessage({ content })
    }
  })
}

function normalizeMessageContent(content: IncomingMessage["content"]): string | ContentPart[] {
  if (typeof content === "string") {
    return content
  }
  return content as ContentPart[]
}

function extractTextFromContent(parts: ContentPart[]): string {
  return parts
    .filter((part): part is z.infer<typeof textContentPartSchema> => part.type === "text")
    .map((part) => part.text)
    .join("\n")
}

type TextContentBlock = {
  type: "text"
  text: string
}

function normalizeContent(content: AIMessage["content"]) {
  if (typeof content === "string") {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "string") {
          return block
        }
        if (isTextContentBlock(block)) {
          return block.text
        }
        return ""
      })
      .filter(Boolean)
      .join("\n")
  }

  return ""
}

function isTextContentBlock(block: unknown): block is TextContentBlock {
  return (
    typeof block === "object" &&
    block !== null &&
    "type" in block &&
    (block as { type?: unknown }).type === "text" &&
    "text" in block &&
    typeof (block as { text?: unknown }).text === "string"
  )
}


