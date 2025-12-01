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

const requestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: messageContentSchema,
      }),
    )
    .min(1),
})

const isoDateSchema = z
  .string()
  .datetime()
  .describe("ISO-8601 timestamp, for example 2024-11-18T13:30:00Z")

const updateEventSchema = z
  .object({
    eventId: z.string().min(1, "eventId is required"),
    start: isoDateSchema.optional(),
    end: isoDateSchema.optional(),
    targetScheduleId: z.string().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.start && !data.end && !data.targetScheduleId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide a new start/end time or a targetScheduleId to update the event.",
      })
    }
  })

const SYSTEM_PROMPT = `You are Tempora, a focused assistant that helps the currently authenticated user inspect and mutate their schedules and events.

Rules:
- Always call the provided tools when you need real data. Do not guess IDs or fabricate schedule contents.
- List schedules before referencing one, and list the events in question before updating or deleting them.
- For new events, confirm the target schedule and ensure the end time is after the start time.
- When updating, explain what changed and mention the schedule name.
- If the user has not supplied enough info (schedule, time window, etc.) ask a follow-up question.
- Work in ISO-8601 timestamps (UTC) and keep explanations short. Finish with an actionable summary of what you did or still need.

You are configured on gpt-5-mini in low reasoning mode with tool access.`

type IncomingMessage = z.infer<typeof requestSchema>["messages"][number]
type ContentPart = z.infer<typeof contentPartSchema>

export async function POST(req: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { messages } = requestSchema.parse(body)

    const userId = session.user.id

    const listSchedulesTool = tool(
      async () => {
        const schedules = await prisma.schedule.findMany({
          where: { userId },
          include: {
            _count: { select: { events: true } },
            events: {
              orderBy: { start: "asc" },
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

        const events = await prisma.event.findMany({
          where: {
            scheduleId: schedule.id,
            ...(fromDate ? { start: { gte: fromDate } } : {}),
            ...(toDate ? { end: { lte: toDate } } : {}),
          },
          orderBy: { start: "asc" },
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

    const createEventTool = tool(
      async ({ scheduleId, start, end }: { scheduleId: string; start: string; end: string }) => {
        const schedule = await ensureScheduleOwnership(scheduleId, userId)
        const startDate = parseIsoDate(start, "start")
        const endDate = parseIsoDate(end, "end")

        if (endDate <= startDate) {
          throw new Error("Event end time must be after the start time.")
        }

        const event = await prisma.event.create({
          data: {
            scheduleId: schedule.id,
            start: startDate,
            end: endDate,
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
        description: "Create a new event inside one of the user's schedules.",
        schema: z.object({
          scheduleId: z.string().min(1, "scheduleId is required"),
          start: isoDateSchema,
          end: isoDateSchema,
        }),
      },
    )

    const updateEventTool = tool(
      async ({ eventId, start, end, targetScheduleId }: z.infer<typeof updateEventSchema>) => {
        const existing = await ensureEventOwnership(eventId, userId)
        const newStart = start ? parseIsoDate(start, "start") : existing.start
        const newEnd = end ? parseIsoDate(end, "end") : existing.end

        if (newEnd <= newStart) {
          throw new Error("Updated end time must be after the start time.")
        }

        const data: {
          start?: Date
          end?: Date
          scheduleId?: string
        } = {}

        if (start) {
          data.start = newStart
        }
        if (end) {
          data.end = newEnd
        }

        let targetSchedule = existing.schedule

        if (targetScheduleId && targetScheduleId !== existing.scheduleId) {
          targetSchedule = await ensureScheduleOwnership(targetScheduleId, userId)
          data.scheduleId = targetSchedule.id
        }

        const updated = await prisma.event.update({
          where: { id: eventId },
          data,
        })

        return JSON.stringify(
          {
            message: "Event updated",
            schedule: targetSchedule,
            before: serializeEvent(existing),
            after: serializeEvent(updated),
          },
          null,
          2,
        )
      },
      {
        name: "update_calendar_event",
        description: "Adjust an event's timing and optionally move it to another schedule.",
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
            event: serializeEvent(event),
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
      systemPrompt: SYSTEM_PROMPT,
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

function serializeEvent(event: { id: string; scheduleId: string; start: Date; end: Date }) {
  return {
    id: event.id,
    scheduleId: event.scheduleId,
    start: event.start.toISOString(),
    end: event.end.toISOString(),
    durationMinutes: Math.round((event.end.getTime() - event.start.getTime()) / 60000),
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


