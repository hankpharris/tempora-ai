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

const fileContentPartSchema = z.object({
    type: z.literal("input_file"),
    filename: z.string(),
    file_data: z.string(),
    mime_type: z.string().optional(), // For internal use, not sent to API if redundant
})

const contentPartSchema = z.union([textContentPartSchema, imageContentPartSchema, fileContentPartSchema])

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

function buildSystemPrompt(userContext?: UserContext, userName?: string, userSchedule?: { id: string, name: string }) {
  const contextInfo = userContext
    ? `
User Context:
- Name: ${userName || "Not provided"}
- Timezone: ${userContext.timezone}
- Local time: ${userContext.localTime}
- Locale: ${userContext.locale || "not specified"}
${userSchedule ? `- Primary Schedule ID: ${userSchedule.id} (Name: "${userSchedule.name}")` : ""}

When the user mentions times like "tomorrow at 3pm" or "next Monday", interpret them in the user's timezone (${userContext.timezone}) and convert to UTC for storage.`
    : ""

  return `You are Tempora, a focused assistant that helps the currently authenticated user inspect and mutate their schedules and events, and coordinate with friends.
${contextInfo}
Rules:
- You have the user's Schedule ID in the context. Use it directly to list events or create/update events.
- Always call the provided tools when you need real data. Do not guess IDs or fabricate schedule contents.
- List the events in question before updating or deleting them.
- For new events, confirm the target schedule and ensure the end time is after the start time.
- When updating, explain what changed and mention the schedule name.
- If the user has not supplied enough info (schedule, time window, etc.) ask a follow-up question.
- Do not attempt to clarify facts already known with relative certainty. 
    - You know the user's schedule ID, so assume they mean this schedule unless specified otherwise.
- You can interact with friends' schedules if they are confirmed friends. Use 'list_friends' to find friends. The 'list_friends' tool now provides the friend's schedule ID directly.
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
    const userName = session.user.fname + " " + session.user.lname

    // Pre-fetch the user's primary schedule to optimize tool usage
    let userSchedule = await prisma.schedule.findFirst({
      where: { userId },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" }, // Assume the first created is the primary
    })

    // If no schedule exists, create one to ensure the user has a place for events
    // This aligns with the "one schedule per user" policy
    if (!userSchedule) {
      userSchedule = await prisma.schedule.create({
        data: {
          userId,
          name: "My Schedule",
        },
        select: { id: true, name: true },
      })
    }

    const systemPrompt = buildSystemPrompt(userContext, userName, userSchedule)

    const ensureFriendship = async (friendId: string) => {
      const friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { user_id1: userId, user_id2: friendId },
            { user_id1: friendId, user_id2: userId },
          ],
          status: "ACCEPTED",
        },
      })
      if (!friendship) {
        throw new Error("You are not friends with this user.")
      }
      return friendship
    }

    // Tool removed to optimize workflow - user schedule is in context
    // const listSchedulesTool = tool(...)

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

    const listFriendsTool = tool(
      async () => {
        const friendships = await prisma.friendship.findMany({
          where: {
            OR: [
              { user_id1: userId, status: "ACCEPTED" },
              { user_id2: userId, status: "ACCEPTED" },
            ],
          },
          include: {
            user1: { 
              select: { 
                id: true, 
                fname: true, 
                lname: true, 
                email: true,
                schedules: {
                  take: 1,
                  select: { id: true },
                  orderBy: { createdAt: "asc" }
                }
              } 
            },
            user2: { 
              select: { 
                id: true, 
                fname: true, 
                lname: true, 
                email: true,
                schedules: {
                    take: 1,
                    select: { id: true },
                    orderBy: { createdAt: "asc" }
                  }
              } 
            },
          },
        })

        const friends = friendships.map((f) => {
          const friend = f.user_id1 === userId ? f.user2 : f.user1
          const scheduleId = friend.schedules[0]?.id || null
          return {
            id: friend.id,
            name: `${friend.fname} ${friend.lname}`.trim() || friend.email,
            email: friend.email,
            scheduleId,
          }
        })

        return JSON.stringify(friends, null, 2)
      },
      {
        name: "list_friends",
        description: "List all confirmed friends of the current user. Returns friend ID, name, email, and their primary scheduleId.",
        schema: z.object({}),
      },
    )

    // Tool removed to optimize workflow - schedule ID is now provided by list_friends
    // const getFriendSchedulesTool = tool(...)

    const getFriendEventsTool = tool(
      async ({ friendId, scheduleId, from, to }: { friendId: string, scheduleId: string; from?: string; to?: string }) => {
        await ensureFriendship(friendId)
        
        // Verify schedule belongs to friend
        const schedule = await prisma.schedule.findFirst({
          where: { id: scheduleId, userId: friendId },
        })
        
        if (!schedule) {
          throw new Error("Schedule not found or does not belong to this friend.")
        }

        const fromDate = from ? parseIsoDate(from, "from") : undefined
        const toDate = to ? parseIsoDate(to, "to") : undefined

        const allEvents = await prisma.event.findMany({
          where: { scheduleId },
        })

        let events = allEvents
        if (fromDate || toDate) {
          events = allEvents.filter((event) => {
            return event.start.some((startTime, idx) => {
              const endTime = event.end[idx] ?? startTime
              const startsBeforeTo = !toDate || startTime <= toDate
              const endsAfterFrom = !fromDate || endTime >= fromDate
              return startsBeforeTo && endsAfterFrom
            })
          })
        }

        return JSON.stringify(events.map(serializeEvent), null, 2)
      },
      {
        name: "get_friend_events",
        description: "Fetch events from a friend's schedule. Useful for finding free time slots.",
        schema: z.object({
          friendId: z.string().min(1),
          scheduleId: z.string().min(1),
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

    const createSharedEventTool = tool(
        async ({ 
          friendId,
          friendScheduleId,
          userScheduleId,
          name, 
          description, 
          timeSlots, 
          repeated, 
          repeatUntil 
        }: { 
          friendId: string
          friendScheduleId: string
          userScheduleId: string
          name: string
          description?: string
          timeSlots: Array<{ start: string; end: string }>
          repeated?: string
          repeatUntil?: string
        }) => {
          await ensureFriendship(friendId)
          
          const friendSchedule = await prisma.schedule.findFirst({
            where: { id: friendScheduleId, userId: friendId },
          })
          
          if (!friendSchedule) {
            throw new Error("Friend's schedule not found or does not belong to them.")
          }

          const userSchedule = await ensureScheduleOwnership(userScheduleId, userId)

          // Get friend's name for the event description
          const friendUser = await prisma.user.findUnique({
            where: { id: friendId },
            select: { fname: true, lname: true, email: true },
          })
          const friendName = friendUser 
            ? ([friendUser.fname, friendUser.lname].filter(Boolean).join(" ") || friendUser.email)
            : "Friend"

          // Get current user's name for the friend's event description
          // session.user is available in the closure
          const currentUserName = [session.user.fname, session.user.lname].filter(Boolean).join(" ") || session.user.email || "Friend"

          const userEventDescription = description 
            ? `${description}\n\nWith ${friendName}` 
            : `With ${friendName}`
            
          const friendEventDescription = description 
            ? `${description}\n\nWith ${currentUserName}` 
            : `With ${currentUserName}`

          const repeatUntilDate = repeatUntil ? parseIsoDate(repeatUntil, "repeatUntil") : null
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

          // Create event for friend
          const friendEvent = await prisma.event.create({
            data: {
              scheduleId: friendSchedule.id,
              name,
              description: friendEventDescription,
              start: startDates,
              end: endDates,
              repeated: (repeated as "NEVER" | "DAILY" | "WEEKLY" | "MONTHLY") ?? "NEVER",
              repeatUntil: repeatUntilDate,
            },
          })

          // Create event for user
          const userEvent = await prisma.event.create({
            data: {
              scheduleId: userSchedule.id,
              name,
              description: userEventDescription,
              start: startDates,
              end: endDates,
              repeated: (repeated as "NEVER" | "DAILY" | "WEEKLY" | "MONTHLY") ?? "NEVER",
              repeatUntil: repeatUntilDate,
            },
          })
  
          return JSON.stringify(
            {
              message: "Shared event created on both schedules",
              friendId,
              friendEvent: serializeEvent(friendEvent),
              userEvent: serializeEvent(userEvent),
            },
            null,
            2,
          )
        },
        {
          name: "create_shared_event",
          description: "Create a shared event on both your schedule and a friend's schedule. This ensures you both have the event.",
          schema: z.object({
            friendId: z.string().min(1),
            friendScheduleId: z.string().min(1, "Friend's scheduleId is required"),
            userScheduleId: z.string().min(1, "Your scheduleId is required"),
            name: z.string().min(1, "Event name is required"),
            description: z.string().optional(),
            timeSlots: z.array(timeSlotSchema).min(1),
            repeated: repeatFrequencySchema.optional().default("NEVER"),
            repeatUntil: isoDateSchema.optional(),
          }),
        },
      )

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

    const tools = [
        // listSchedulesTool, // Removed for optimization
        listEventsTool, 
        createEventTool, 
        updateEventTool, 
        deleteEventTool,
        listFriendsTool,
        // getFriendSchedulesTool is removed as list_friends now provides the schedule ID
        getFriendEventsTool,
        createSharedEventTool
    ]

    const llm = new ChatOpenAI({
      model: "gpt-5-mini",
      maxTokens: 4096,
      apiKey: env.OPENAI_API_KEY,
    })

    const agent = createAgent({
      model: llm,
      tools,
      systemPrompt,
    })

    const langChainMessages = mapToLangChainMessages(messages)

    console.log("[chatbot] Invoking agent with", langChainMessages.length, "messages")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    langChainMessages.forEach((msg, idx) => {
      const msgType = msg._getType()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentParts = Array.isArray(msg.content) ? msg.content : []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasImages = contentParts.some((c: any) => c?.type === "image_url")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasPdf = contentParts.some((c: any) => c?.type === "image_url" && (c?.image_url?.url as string)?.includes("application/pdf"))
    
    console.log(`[chatbot] Input[${idx}] type=${msgType}, hasImages=${hasImages}, hasPdf=${hasPdf}`)
  })

    const result = await agent.invoke({
      messages: langChainMessages,
    })

    const allMessages = result.messages ?? []
    console.log("[chatbot] Agent returned", allMessages.length, "messages")

    // Log all messages for debugging
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    
    // Check for PDF data URLs and convert them to text (placeholder) or remove them
    // OpenAI's Chat Completion API doesn't support PDFs directly as base64 in "image_url"
    // They are supported via file uploads (Assistants API) or if using a model with specific capabilities that allows this structure.
    // However, the error "Invalid MIME type" confirms we cannot send application/pdf in image_url.
    
    // As a workaround, we will filter out PDF "image_url" parts and append a system note.
    // In a real implementation, you'd want to upload the PDF to OpenAI Files API or parse text locally.
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let processedContent: any = content
    if (Array.isArray(processedContent)) {
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
       processedContent = processedContent.map((part: any) => {
         // Convert standard image_url with PDF data URI to the input_file format expected by experimental models
         // or handle as raw text/placeholder if using older models that don't support it.
         
         if (part.type === "image_url" && part.image_url.url.startsWith("data:application/pdf")) {
           const matches = part.image_url.url.match(/^data:application\/pdf;base64,(.+)$/)
           if (matches && matches[1]) {
             // We're converting the incoming data URL into the OpenAI Chat Completions format
             // The user provided this specific format:
             // {
             //     "type": "file",
             //     "file": {
             //         "filename": "my-file.pdf",
             //         "file_data": "data:application/pdf;base64,..."
             //     }
             // }
             
             return {
                type: "file", 
                file: {
                    filename: "document.pdf",
                    file_data: part.image_url.url
                }
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             } as any
           }
         }
         return part
       })
    }

    switch (message.role) {
      case "system":
        return new SystemMessage(typeof processedContent === "string" ? processedContent : extractTextFromContent(processedContent))
      case "assistant":
        return new AIMessage(typeof processedContent === "string" ? processedContent : extractTextFromContent(processedContent))
      default:
        // We cast to 'any' to bypass LangChain's strict content type validation which might not know about 'input_file' yet
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return new HumanMessage({ content: processedContent as any })
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
