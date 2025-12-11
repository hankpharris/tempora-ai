import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { CreateEventOverlayTriggerClient } from "@/components/CreateEventOverlayTriggerClient"
import { ExpandableEventCard } from "@/components/ExpandableEventCard"
import { LocalTimeRange } from "@/components/LocalTimeRange"
import { MonthDayCell } from "@/components/MonthDayCell"
import { MovingBlob } from "@/components/MovingBlob"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = {
  title: "Calendar",
  description: "Review your Tempora schedule across month, week, and day scopes.",
}

export const dynamic = "force-dynamic"

const WEEKDAY_HEADER = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const COLOR_TOKENS = ["primary", "secondary", "success", "warning", "danger"] as const
const DAY_MS = 86_400_000
const MINUTES_IN_DAY = 1_440
const MIN_TIMELINE_BLOCK_MINUTES = 45
const HOUR_HEIGHT = 48
const WEEK_HEADER_HEIGHT = 40
const TOTAL_DAY_HEIGHT = WEEK_HEADER_HEIGHT + HOUR_HEIGHT * 24
const SECTION_SNAP_CLASS =
  "snap-start min-h-screen px-4 py-10 md:px-8 lg:px-12 flex items-stretch"
const HOURS = Array.from({ length: 24 }, (_, i) => i)

const MONTH_NAME_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "long" })
const DAY_NUMBER_FORMATTER = new Intl.DateTimeFormat("en-US", { day: "numeric" })
const DAY_DETAIL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
})
const MONTH_DAY_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" })
const WEEKDAY_LONG_FORMATTER = new Intl.DateTimeFormat("en-US", { weekday: "long" })
const WEEKDAY_SHORT_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
})
const TIME_FORMATTER = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" })

type ColorToken = (typeof COLOR_TOKENS)[number]

// Base event from database (has arrays of start/end)
type BaseEvent = {
  id: string
  scheduleId: string
  scheduleName: string
  name: string
  description: string | null
  repeated: string
  repeatUntil: Date | null
  colorToken: ColorToken
  startTimes: Date[]  // Array of start times
  endTimes: Date[]    // Array of end times (parallel to startTimes)
}

// Individual occurrence for display (has single start/end)
type NormalizedEvent = {
  id: string
  baseEventId: string
  scheduleId: string
  scheduleName: string
  name: string
  description: string | null
  repeated: string
  repeatUntil: Date | null
  colorToken: ColorToken
  start: Date
  end: Date
  slotIndex: number  // Which time slot this occurrence is from
}

type CalendarDay = {
  date: Date
  key: string
  events: NormalizedEvent[]
  isCurrentMonth: boolean
  isToday: boolean
}

type WeekDayColumn = CalendarDay & {
  weekdayLabel: string
  monthDayLabel: string
}

const COLOR_STYLES: Record<
  ColorToken,
  { border: string; surface: string; chip: string; text: string; dot: string }
> = {
  primary: {
    border: "border-primary/30",
    surface: "bg-primary/10",
    chip: "bg-primary/20 text-primary/90",
    text: "text-primary/90",
    dot: "bg-primary/80",
  },
  secondary: {
    border: "border-secondary/40",
    surface: "bg-secondary/10",
    chip: "bg-secondary/20 text-secondary/90",
    text: "text-secondary/90",
    dot: "bg-secondary/80",
  },
  success: {
    border: "border-success/30",
    surface: "bg-success/10",
    chip: "bg-success/20 text-success/90",
    text: "text-success/90",
    dot: "bg-success/80",
  },
  warning: {
    border: "border-warning/30",
    surface: "bg-warning/10",
    chip: "bg-warning/20 text-warning/90",
    text: "text-warning/90",
    dot: "bg-warning/80",
  },
  danger: {
    border: "border-danger/30",
    surface: "bg-danger/10",
    chip: "bg-danger/20 text-danger/90",
    text: "text-danger/90",
    dot: "bg-danger/80",
  },
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string }>
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const schedules = await prisma.schedule.findMany({
    where: { userId: session.user.id },
    include: {
      events: {
        orderBy: { start: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  const assignColor = createScheduleColorAssigner()

  // First, create base events from database (with arrays of start/end times)
  const baseEvents: BaseEvent[] = schedules.flatMap((schedule) => {
    const colorToken = assignColor(schedule.id)
    return schedule.events.map((event) => ({
      id: event.id,
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      name: event.name,
      description: event.description,
      repeated: event.repeated,
      repeatUntil: event.repeatUntil ? new Date(event.repeatUntil) : null,
      colorToken,
      startTimes: event.start.map((s) => new Date(s)),
      endTimes: event.end.map((e) => new Date(e)),
    }))
  })

  const resolvedSearchParams = (await searchParams) ?? {}
  const today = new Date()
  const viewMonth = parseMonthParam(resolvedSearchParams.month) ?? new Date(today.getFullYear(), today.getMonth(), 1)
  const prevMonth = addMonths(viewMonth, -1)
  const nextMonth = addMonths(viewMonth, 1)

  // Expand repeating events into individual occurrences (one per time slot per repetition)
const normalizedEvents = expandRepeatingEvents(baseEvents, today).sort(
  (a, b) => a.start.getTime() - b.start.getTime()
)
const monthLabel = MONTH_NAME_FORMATTER.format(viewMonth)
const viewYear = viewMonth.getFullYear()
const eventsByDate = groupEventsByDate(normalizedEvents)
const monthMatrix = buildMonthMatrix(viewMonth, eventsByDate, today)
const weekAnchor = today
const weekDays = buildWeekDays(weekAnchor, eventsByDate, today)
const weekRangeLabel = formatWeekRangeLabel(weekDays)
const focusedDay = resolveFocusedDay(weekDays)
const dayEvents = focusedDay?.events ?? []
const weekEventCount = weekDays.reduce((sum, day) => sum + day.events.length, 0)

  const upcomingEvents = normalizedEvents.filter((event) => event.end.getTime() >= today.getTime())
  const highlightedEvent = upcomingEvents[0] ?? normalizedEvents[0] ?? null
  const prioritizedUpcoming =
    upcomingEvents.length > 0 ? upcomingEvents.slice(0, 4) : normalizedEvents.slice(0, 4)

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-background via-default-100/15 to-default-200/20 text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <MovingBlob
          size={420}
          speed={50}
          colorClass="bg-primary/16"
          blurClass="blur-[120px]"
          className="animate-blob-slow mix-blend-screen"
        />
        <MovingBlob
          size={340}
          speed={64}
          delay={1500}
          colorClass="bg-secondary/18"
          blurClass="blur-[110px]"
          className="animate-blob-medium mix-blend-screen"
        />
      </div>

      <main className="relative z-10 h-screen snap-y snap-mandatory overflow-y-auto">
        <section className={SECTION_SNAP_CLASS}>
          <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col min-h-0 gap-6">
            <div className="grid flex-1 min-h-0 grid-cols-1 gap-6 px-2 lg:grid-cols-[3fr,1.1fr] lg:px-0">
              <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-default/20 bg-content1/80 shadow-2xl px-3 lg:px-4 dark:border-default/25 dark:bg-content1/60">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-default/15 px-6 py-4">
                  <div className="flex items-center gap-3 text-default-500">
                    <div className="flex w-8 shrink-0 flex-col items-center gap-1">
                      <Link
                        href={`/calendar?month=${formatMonthParam(prevMonth)}`}
                        className="inline-flex h-7 w-7 items-center justify-center text-sm font-semibold text-default-600 hover:text-primary"
                        aria-label="Previous month"
                      >
                        ↑
                      </Link>
                      <Link
                        href={`/calendar?month=${formatMonthParam(nextMonth)}`}
                        className="inline-flex h-7 w-7 items-center justify-center text-sm font-semibold text-default-600 hover:text-primary"
                        aria-label="Next month"
                      >
                        ↓
                      </Link>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold text-default-600">{viewYear}</span>
                      <h2 className="text-2xl font-semibold text-foreground">{monthLabel}</h2>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-default-500">
                    <span className="hidden rounded-full border border-default/20 bg-default-100/60 px-3 py-1 dark:border-default/30 dark:bg-default-100/10 sm:inline-flex">
                      {highlightedEvent ? `Next: ${highlightedEvent.name}` : "No upcoming events"}
                    </span>
                    <CreateEventOverlayTriggerClient
                      triggerClassName="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary/90 hover:border-primary/60 hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      triggerLabel="Create event"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-hidden">
                  <div className="flex h-full flex-col overflow-auto">
                    <div className="grid grid-cols-7 border-b border-default/15 bg-content1 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-default-500">
                      {WEEKDAY_HEADER.map((label) => (
                        <span key={label} className="text-center">
                          {label}
                        </span>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-3 px-4 pb-6 pt-4 auto-rows-[minmax(9rem,_auto)]">
                      {monthMatrix.flat().map((day) => {
                        const styledEvents = day.events.map((event) => ({
                          ...event,
                          timeRange: formatTimeRange(event),
                          styles: COLOR_STYLES[event.colorToken],
                        }))
                        return (
                        <div
                          key={day.key}
                          className={`rounded-xl border p-3 transition-colors ${
                            day.isCurrentMonth
                              ? "border-default/20 bg-content1"
                              : "border-default/10 bg-default-100/60 opacity-90"
                          } ${day.isToday ? "ring-2 ring-primary/60" : ""}`}
                        >
                          <div className="flex items-center justify-between text-sm font-semibold">
                            <span>{DAY_NUMBER_FORMATTER.format(day.date)}</span>
                            {day.events.length > 0 && (
                              <span className="text-[11px] uppercase tracking-[0.3em] text-primary/70">
                                {day.events.length}
                              </span>
                            )}
                          </div>
                          <MonthDayCell events={styledEvents} />
                        </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

            
            </div>
            <div className="text-xs uppercase tracking-[0.35em] text-default-500">Scroll ↓ for weekly focus</div>
          </div>
        </section>

        <section className={SECTION_SNAP_CLASS}>
          <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col gap-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-default-500">Weekly focus</p>
                <h2 className="text-2xl font-semibold text-foreground">{weekRangeLabel}</h2>
                <p className="text-sm text-default-500">Hour-by-hour view across the next seven days.</p>
              </div>
              <div className="rounded-lg border border-default/25 bg-default-100/60 px-4 py-2 text-sm font-semibold text-default-700 dark:border-default/30 dark:bg-default-100/10 dark:text-default-200">
                {weekEventCount} event{weekEventCount === 1 ? "" : "s"} this week
              </div>
            </div>

            <div className="flex min-h-[960px] flex-1 overflow-hidden rounded-2xl border border-default/20 bg-content1/80 shadow-2xl p-3 dark:border-default/25 dark:bg-content1/60">
              <div
                className="w-16 border-r border-default/15 pr-3 pt-[40px] dark:border-default/25"
                style={{ height: TOTAL_DAY_HEIGHT }}
              >
                {HOURS.map((hour) => (
                  <div key={hour} className="h-[48px] text-[11px] uppercase tracking-[0.2em] text-default-500">
                    {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
                  </div>
                ))}
              </div>
              <div className="grid flex-1 grid-cols-7 gap-3">
                {weekDays.map((day) => (
                  <div
                    key={day.key}
                    className="relative overflow-hidden rounded-xl border border-default/15 bg-default-100/40 dark:border-default/20 dark:bg-default-100/5"
                    style={{ height: TOTAL_DAY_HEIGHT }}
                  >
                    <div className="flex h-[40px] items-center justify-between border-b border-default/15 bg-content1/70 px-3 text-xs font-semibold text-foreground">
                      <span className="text-[10px] uppercase tracking-[0.3em] text-default-500">{day.weekdayLabel}</span>
                      <span className="text-sm">{DAY_NUMBER_FORMATTER.format(day.date)}</span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 top-[40px]">
                      {HOURS.map((hour) => (
                        <div
                          key={hour}
                          className={`h-[48px] border-t border-default/10 dark:border-default/20 ${
                            day.isToday ? "bg-primary/5" : ""
                          }`}
                        />
                      ))}
                    </div>
                    <div className="absolute left-0 right-0 top-[40px] h-[calc(100%-40px)] px-2 pb-4">
                      {day.events.map((event, idx) => {
                        const styles = COLOR_STYLES[event.colorToken]
                        const dayStart = startOfDay(day.date)
                        const rawStart = (event.start.getTime() - dayStart.getTime()) / 60000
                        const rawEnd = (event.end.getTime() - dayStart.getTime()) / 60000
                        const startMinutes = Math.max(0, Math.min(MINUTES_IN_DAY, rawStart))
                        const durationMinutes = Math.max(rawEnd - rawStart, MIN_TIMELINE_BLOCK_MINUTES)
                        const endMinutes = Math.min(MINUTES_IN_DAY, startMinutes + durationMinutes)
                        const topPx = (startMinutes / 60) * HOUR_HEIGHT
                        const heightPx = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT
                        return (
                          <div
                            key={`${event.id}-${idx}`}
                            className={`absolute left-1 right-1 overflow-hidden rounded-lg border px-3 py-2 text-xs font-semibold shadow ${styles.border} ${styles.surface} ${styles.text}`}
                            style={{ top: topPx, height: heightPx }}
                          >
                            <p className="text-sm font-semibold leading-tight truncate">{event.name}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-xs uppercase tracking-[0.35em] text-default-500">Scroll ↓ for daily focus</div>
          </div>
        </section>

        <section className={SECTION_SNAP_CLASS}>
          <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col gap-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-primary/70">Day stream</p>
                {focusedDay ? (
                  <>
                    <h2 className="text-2xl font-semibold text-foreground">{DAY_DETAIL_FORMATTER.format(focusedDay.date)}</h2>
                    <p className="text-sm text-default-500">{getRelativeLabel(focusedDay.date, today)}</p>
                  </>
                ) : (
                  <h2 className="text-2xl font-semibold text-foreground">Daily detail</h2>
                )}
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-foreground dark:border-primary/40 dark:bg-primary/20">
                {dayEvents.length} event{dayEvents.length === 1 ? "" : "s"} in focus
              </div>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-4 rounded-2xl border border-default/20 bg-content1/80 p-4 shadow-2xl dark:border-default/25 dark:bg-content1/60 lg:grid-cols-[1.3fr,0.7fr]">
              <div className="flex flex-col rounded-xl border border-default/15 bg-content1 p-4 shadow-inner dark:border-default/25 dark:bg-content1/60">
                <p className="text-[11px] uppercase tracking-[0.3em] text-default-500">Timeline</p>
                <div className="relative mt-4 h-64 rounded-xl border border-default/15 bg-default-100/60 p-4 dark:border-default/25 dark:bg-default-100/10">
                  <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 border-t border-dashed border-default/20" />
                  {focusedDay &&
                    buildTimelineLanes(dayEvents, focusedDay.date).map((item) => {
                      const styles = COLOR_STYLES[item.event.colorToken]
                      const laneOffset = 16 + item.lane * 60
                      return (
                        <div
                          key={`${item.event.id}-${item.lane}-${item.event.slotIndex}`}
                          tabIndex={0}
                          className={`group absolute rounded-xl border px-3 py-2 text-xs font-semibold shadow-sm ${styles.border} ${styles.surface} ${styles.text} focus-visible:outline-none`}
                          style={{
                            left: `${item.left}%`,
                            width: `${item.width}%`,
                            top: `${laneOffset}px`,
                          }}
                        >
                          <div className="overflow-hidden">
                            <p className="text-sm font-semibold leading-tight truncate">{item.event.name}</p>
                            <LocalTimeRange
                              start={item.event.start}
                              end={item.event.end}
                              className="text-[11px] font-normal text-default-600 leading-snug truncate"
                            />
                          </div>
                          <div className="pointer-events-none absolute inset-0 rounded-xl ring-primary/0 transition group-hover:ring-2 group-focus-visible:ring-2" />
                          <div className="absolute left-1/2 top-full z-30 mt-2 hidden w-max max-w-[420px] -translate-x-1/2 rounded-xl border border-default/20 bg-content1/95 px-4 py-3 text-xs text-foreground shadow-lg backdrop-blur-md group-hover:flex group-focus-visible:flex">
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-semibold leading-snug">{item.event.name}</span>
                              <LocalTimeRange
                                start={item.event.start}
                                end={item.event.end}
                                className="text-[11px] font-normal text-default-600 leading-tight"
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  <div className="absolute bottom-3 left-4 right-4 flex justify-between text-[10px] uppercase tracking-[0.3em] text-default-500">
                    <span>12a</span>
                    <span>6a</span>
                    <span>Noon</span>
                    <span>6p</span>
                    <span>12a</span>
                  </div>
                </div>
                {dayEvents.length === 0 && (
                  <p className="mt-4 rounded-lg border border-dashed border-default/20 bg-default-100/60 px-4 py-3 text-sm text-default-600 dark:border-default/25 dark:bg-default-100/10 dark:text-default-300">
                    No events are locked to this day. Add an event and it will stretch across this timeline.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-default/15 bg-content1 p-4 shadow-inner dark:border-default/25 dark:bg-content1/60">
                <p className="text-[11px] uppercase tracking-[0.3em] text-default-500">Upcoming</p>
                <div className="mt-4 space-y-3">
                  {prioritizedUpcoming.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-default/20 bg-default-100/60 px-4 py-4 text-sm text-default-600 dark:border-default/25 dark:bg-default-100/10 dark:text-default-300">
                      Nothing scheduled yet — once events exist you&apos;ll see them here.
                    </p>
                  ) : (
                    prioritizedUpcoming.map((event) => {
                      const styles = COLOR_STYLES[event.colorToken]
                      return (
                        <ExpandableEventCard
                          key={`upcoming-${event.id}`}
                          eventId={event.baseEventId}
                          slotIndex={event.slotIndex}
                          eventStart={event.start}
                          eventEnd={event.end}
                          repeated={event.repeated}
                          repeatUntil={event.repeatUntil}
                          name={event.name}
                          description={event.description}
                          timeRange={`${formatTimeRange(event)} · ${getRelativeLabel(event.start, today)}`}
                          styles={styles}
                          variant="default"
                        />
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function createScheduleColorAssigner() {
  const palette: ColorToken[] = [...COLOR_TOKENS]
  const lookup = new Map<string, ColorToken>()
  let index = 0
  return (scheduleId: string): ColorToken => {
    if (!lookup.has(scheduleId)) {
      const color = palette[index % palette.length] ?? "primary"
      lookup.set(scheduleId, color)
      index += 1
    }
    return lookup.get(scheduleId) ?? "primary"
  }
}

function getDateKey(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, amount: number) {
  const clone = new Date(date)
  clone.setDate(clone.getDate() + amount)
  return clone
}

function addMonths(date: Date, amount: number) {
  const clone = new Date(date)
  clone.setMonth(clone.getMonth() + amount)
  return clone
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function groupEventsByDate(events: NormalizedEvent[]) {
  const map = new Map<string, NormalizedEvent[]>()
  for (const event of events) {
    const startDay = startOfDay(event.start)
    const endDay = startOfDay(event.end)
    const spanDays = Math.max(
      0,
      Math.floor((endDay.getTime() - startDay.getTime()) / DAY_MS),
    )
    for (let offset = 0; offset <= spanDays; offset++) {
      const day = addDays(startDay, offset)
      const key = getDateKey(day)
      const bucket = map.get(key)
      if (bucket) {
        bucket.push(event)
      } else {
        map.set(key, [event])
      }
    }
  }

  map.forEach((bucket) => {
    bucket.sort((a, b) => a.start.getTime() - b.start.getTime())
  })

  return map
}

function buildMonthMatrix(anchor: Date, eventsByDate: Map<string, NormalizedEvent[]>, today: Date) {
  const startOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const endOfMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  const leading = startOfMonth.getDay()
  const trailing = 6 - endOfMonth.getDay()
  const gridStart = addDays(startOfMonth, -leading)
  const gridEnd = addDays(endOfMonth, trailing)
  const totalDays = Math.round((gridEnd.getTime() - gridStart.getTime()) / DAY_MS) + 1

  const weeks: CalendarDay[][] = []

  for (let offset = 0; offset < totalDays; offset += 7) {
    const week: CalendarDay[] = []
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const current = addDays(gridStart, offset + dayIndex)
      const key = getDateKey(current)
      week.push({
        date: current,
        key,
        events: eventsByDate.get(key) ?? [],
        isCurrentMonth: current.getMonth() === anchor.getMonth(),
        isToday: isSameDay(current, today),
      })
    }
    weeks.push(week)
  }

  return weeks
}

function buildWeekDays(anchor: Date, eventsByDate: Map<string, NormalizedEvent[]>, today: Date) {
  const weekStart = addDays(startOfDay(anchor), -anchor.getDay())
  const columns: WeekDayColumn[] = []
  for (let index = 0; index < 7; index++) {
    const date = addDays(weekStart, index)
    const key = getDateKey(date)
    columns.push({
      date,
      key,
      events: eventsByDate.get(key) ?? [],
      isCurrentMonth: date.getMonth() === anchor.getMonth(),
      isToday: isSameDay(date, today),
      weekdayLabel: WEEKDAY_LONG_FORMATTER.format(date),
      monthDayLabel: WEEKDAY_SHORT_FORMATTER.format(date),
    })
  }
  return columns
}

function formatWeekRangeLabel(week: WeekDayColumn[]) {
  if (week.length === 0) return ""
  const first = week.at(0)?.date ?? new Date()
  const last = week.at(-1)?.date ?? first
  return `${MONTH_DAY_FORMATTER.format(first)} – ${MONTH_DAY_FORMATTER.format(last)}`
}

function resolveFocusedDay(weekDays: WeekDayColumn[]) {
  return (
    weekDays.find((day) => day.isToday) ??
    weekDays.find((day) => day.events.length > 0) ??
    weekDays[0]
  )
}

function formatTimeRange(event: NormalizedEvent) {
  return `${TIME_FORMATTER.format(event.start)} – ${TIME_FORMATTER.format(event.end)}`
}

function parseMonthParam(value?: string) {
  if (!value) return null
  const [yearStr, monthStr] = value.split("-")
  const year = Number(yearStr)
  const month = Number(monthStr)
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null
  return new Date(year, month - 1, 1)
}

function formatMonthParam(date: Date) {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, "0")
  return `${y}-${m}`
}

function getRelativeLabel(target: Date, today: Date) {
  const diff =
    Math.round((startOfDay(target).getTime() - startOfDay(today).getTime()) / DAY_MS) || 0
  if (diff === 0) return "Today"
  if (diff === 1) return "Tomorrow"
  if (diff === -1) return "Yesterday"
  const distance = `${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"}`
  return diff > 0 ? `In ${distance}` : `${distance} ago`
}

function buildTimelineLanes(events: NormalizedEvent[], referenceDay: Date) {
  const dayStart = startOfDay(referenceDay)
  const toMinutes = (date: Date) => (date.getTime() - dayStart.getTime()) / 60_000
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

  const normalized = events
    .map((event) => {
      const start = clamp(toMinutes(event.start), 0, MINUTES_IN_DAY)
      const rawEnd = clamp(toMinutes(event.end), 0, MINUTES_IN_DAY)
      const ensuredEnd = Math.min(
        Math.max(rawEnd, start + MIN_TIMELINE_BLOCK_MINUTES),
        MINUTES_IN_DAY,
      )
      return {
        event,
        start,
        end: ensuredEnd,
        left: (start / MINUTES_IN_DAY) * 100,
        width: ((ensuredEnd - start) / MINUTES_IN_DAY) * 100,
      }
    })
    .sort((a, b) => a.start - b.start || a.end - b.end)

  const lanes: number[] = []

  return normalized.map((item) => {
    let lane = 0
    for (; lane < lanes.length; lane++) {
      const laneEnd = lanes[lane] ?? -Infinity
      if (item.start >= laneEnd - 0.5) break
    }
    if (lane === lanes.length) {
      lanes.push(item.end)
    } else {
      lanes[lane] = item.end
    }

    return { ...item, lane }
  })
}

/**
 * Expands repeating events into individual occurrences.
 * Each BaseEvent can have multiple time slots (start/end arrays).
 * For repeating events, generates occurrences for each time slot in each repetition period.
 */
function expandRepeatingEvents(events: BaseEvent[], today: Date): NormalizedEvent[] {
  const expanded: NormalizedEvent[] = []
  const maxFutureDate = addDays(today, 365) // Limit to 1 year ahead for performance
  const minPastDate = addDays(today, -90) // Show 90 days in the past

  for (const event of events) {
    // Process each time slot in the event
    for (let slotIndex = 0; slotIndex < event.startTimes.length; slotIndex++) {
      const slotStart = event.startTimes[slotIndex]
      const slotEnd = event.endTimes[slotIndex]
      if (!slotStart || !slotEnd) continue

      const slotDuration = slotEnd.getTime() - slotStart.getTime()

      if (event.repeated === "NEVER") {
        // Non-repeating events: add each time slot as a single occurrence
        if (slotStart >= minPastDate && slotStart <= maxFutureDate) {
          expanded.push({
            id: event.startTimes.length === 1 ? event.id : `${event.id}-slot-${slotIndex}`,
            baseEventId: event.id,
            scheduleId: event.scheduleId,
            scheduleName: event.scheduleName,
            name: event.name,
            description: event.description,
            repeated: event.repeated,
            repeatUntil: event.repeatUntil,
            colorToken: event.colorToken,
            start: slotStart,
            end: slotEnd,
            slotIndex,
          })
        }
        continue
      }

      // Repeating events: generate occurrences for this time slot
      const repeatEndDate = event.repeatUntil 
        ? new Date(Math.min(event.repeatUntil.getTime(), maxFutureDate.getTime()))
        : maxFutureDate

      let currentSlotStart = new Date(slotStart)
      let occurrenceIndex = 0

      while (currentSlotStart <= repeatEndDate) {
        // Only include occurrences within our display window
        if (currentSlotStart >= minPastDate) {
          const currentSlotEnd = new Date(currentSlotStart.getTime() + slotDuration)
          
          expanded.push({
            id: `${event.id}-slot-${slotIndex}-occ-${occurrenceIndex}`,
            baseEventId: event.id,
            scheduleId: event.scheduleId,
            scheduleName: event.scheduleName,
            name: event.name,
            description: event.description,
            repeated: event.repeated,
            repeatUntil: event.repeatUntil,
            colorToken: event.colorToken,
            start: currentSlotStart,
            end: currentSlotEnd,
            slotIndex,
          })
        }

        // Calculate next occurrence based on repeat frequency
        currentSlotStart = getNextOccurrence(currentSlotStart, event.repeated)
        occurrenceIndex++

        // Safety limit to prevent infinite loops
        if (occurrenceIndex > 500) break
      }
    }
  }

  return expanded
}

/**
 * Calculates the next occurrence date based on repeat frequency.
 */
function getNextOccurrence(current: Date, frequency: string): Date {
  const next = new Date(current)
  
  switch (frequency) {
    case "DAILY":
      next.setDate(next.getDate() + 1)
      break
    case "WEEKLY":
      next.setDate(next.getDate() + 7)
      break
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1)
      break
    default:
      // For "NEVER" or unknown, just return far future to stop iteration
      next.setFullYear(next.getFullYear() + 100)
  }
  
  return next
}
