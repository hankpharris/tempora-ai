import type { Metadata } from "next"
import { redirect } from "next/navigation"
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
const SECTION_SNAP_CLASS =
  "snap-start h-[92vh] px-6 py-8 md:px-10 lg:px-16 flex items-stretch"

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" })
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

export default async function CalendarPage() {
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

  const today = new Date()

  // Expand repeating events into individual occurrences (one per time slot per repetition)
  const normalizedEvents = expandRepeatingEvents(baseEvents, today).sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  )
  const monthLabel = MONTH_FORMATTER.format(today)
  const eventsByDate = groupEventsByDate(normalizedEvents)
  const monthMatrix = buildMonthMatrix(today, eventsByDate)
  const weekDays = buildWeekDays(today, eventsByDate)
  const weekRangeLabel = formatWeekRangeLabel(weekDays)
  const focusedDay = resolveFocusedDay(weekDays)
  const dayEvents = focusedDay?.events ?? []

  const totalSchedules = schedules.length
  const totalEvents = normalizedEvents.length
  const eventsThisMonth = normalizedEvents.filter(
    (event) =>
      event.start.getFullYear() === today.getFullYear() &&
      event.start.getMonth() === today.getMonth(),
  ).length
  const activeDaysThisMonth = monthMatrix
    .flat()
    .filter((day) => day.isCurrentMonth && day.events.length > 0).length
  const weekEventCount = weekDays.reduce((sum, day) => sum + day.events.length, 0)

  const upcomingEvents = normalizedEvents.filter((event) => event.end.getTime() >= today.getTime())
  const highlightedEvent = upcomingEvents[0] ?? normalizedEvents[0] ?? null
  const prioritizedUpcoming =
    upcomingEvents.length > 0 ? upcomingEvents.slice(0, 4) : normalizedEvents.slice(0, 4)

  const greetingName =
    session.user.name ??
    session.user.email?.split("@")[0] ??
    (session.user.email ?? "there")

  return (
    <div className="relative h-screen overflow-hidden bg-gradient-to-br from-background via-default-50 to-default-100/40 text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <MovingBlob
          size={420}
          speed={50}
          colorClass="bg-primary/18"
          blurClass="blur-[120px]"
          className="animate-blob-slow"
        />
        <MovingBlob
          size={300}
          speed={64}
          delay={1500}
          colorClass="bg-secondary/16"
          blurClass="blur-[110px]"
          className="animate-blob-medium"
        />
        <MovingBlob
          size={520}
          speed={42}
          delay={2600}
          overshoot={260}
          colorClass="bg-primary/12"
          blurClass="blur-[140px]"
          className="animate-blob-reverse"
        />
      </div>

      <main className="relative z-10 h-full snap-y snap-mandatory overflow-y-auto">
        <section className={SECTION_SNAP_CLASS}>
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col min-h-0">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[32px] border border-primary/15 bg-content1/70 p-8 shadow-2xl backdrop-blur-xl dark:bg-content1/60">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-primary/70">
                    Hello, {greetingName}
                  </p>
                  <h1 className="mt-2 text-4xl font-semibold text-foreground">Tempora calendar</h1>
                  <p className="mt-2 max-w-2xl text-sm text-default-600">
                    Glide through your schedule with stacked perspectives. Scroll to morph from a
                    month bird&apos;s-eye to weekly focus and down to a precise daily timeline.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-left text-sm">
                  <StatCard label="Schedules" value={totalSchedules} emphasis />
                  <StatCard label="Events tracked" value={totalEvents} />
                  <StatCard label="This month" value={eventsThisMonth} helper="entries" />
                  <StatCard label="Active days" value={activeDaysThisMonth} helper={monthLabel} />
                </div>
              </div>
              <div className="mt-6 flex flex-1 min-h-0 flex-col rounded-3xl border border-default/20 bg-background/70 p-6 shadow-inner">
                <div className="flex flex-col gap-3 rounded-2xl border border-default/20 bg-content1/60 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-default-500">Month view</p>
                    <h2 className="text-2xl font-semibold text-foreground">{monthLabel}</h2>
                  </div>
                  <div className="flex flex-col gap-1 text-sm text-default-600">
                    {highlightedEvent ? (
                      <>
                        <span className="text-xs uppercase tracking-[0.3em] text-default-500">
                          Next event
                        </span>
                        <p className="text-base font-semibold text-foreground">
                          {highlightedEvent.name}
                        </p>
                        <p>{formatTimeRange(highlightedEvent)}</p>
                      </>
                    ) : (
                      <p>No upcoming events logged.</p>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex-1 min-h-0 overflow-hidden rounded-2xl border border-default/10 bg-background/70">
                  <div className="flex h-full flex-col overflow-auto pr-2">
                    <div className="grid grid-cols-7 gap-2 border-b border-default/20 bg-background/95 px-4 pb-3 pt-3 text-xs uppercase tracking-[0.35em] text-default-400 sticky top-0 z-10">
                      {WEEKDAY_HEADER.map((label) => (
                        <span key={label} className="text-center">
                          {label}
                        </span>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-3 px-4 pb-4 pt-4 auto-rows-[minmax(7rem,_auto)]">
                      {monthMatrix.flat().map((day) => (
                        <div
                          key={day.key}
                          className={`rounded-2xl border p-3 transition-colors ${
                            day.isCurrentMonth
                              ? "border-default/30 bg-content1/80"
                              : "border-default/10 bg-default-100/40 opacity-60"
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
                          <div className="mt-3 space-y-2">
                            {day.events.length === 0 ? (
                              <p className="text-xs text-default-500">No events</p>
                            ) : (
                              <>
                                {day.events.slice(0, 2).map((event) => {
                                  const styles = COLOR_STYLES[event.colorToken]
                                  return (
                                    <div
                                      key={`${day.key}-${event.id}`}
                                      className={`rounded-xl border px-2 py-1 text-xs font-medium ${styles.border} ${styles.surface} ${styles.text}`}
                                    >
                                      <p>{event.name}</p>
                                      <p className="text-[11px] text-default-600">
                                        {formatTimeRange(event)}
                                      </p>
                                    </div>
                                  )
                                })}
                                {day.events.length > 2 && (
                                  <p className="text-[11px] text-default-600">
                                    +{day.events.length - 2} more
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-6 text-xs uppercase tracking-[0.4em] text-default-500">
                Scroll ↓ for weekly focus
              </p>
            </div>
          </div>
        </section>

        <section className={SECTION_SNAP_CLASS}>
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col">
            <div className="flex h-full flex-col overflow-hidden rounded-[32px] border border-secondary/20 bg-content1/70 p-8 shadow-2xl backdrop-blur-xl dark:bg-content1/60">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-secondary/70">
                    Weekly focus
                  </p>
                  <h2 className="text-3xl font-semibold text-foreground">{weekRangeLabel}</h2>
                  <p className="mt-2 max-w-xl text-sm text-default-600">
                    The same data, zoomed into seven day pockets. Use this slice to balance load and
                    spot clusters.
                  </p>
                </div>
                <div className="rounded-2xl border border-secondary/30 bg-secondary/10 px-5 py-4 text-sm font-semibold text-foreground">
                  {weekEventCount} event{weekEventCount === 1 ? "" : "s"} scheduled this week
                </div>
              </div>

              <div className="mt-8 flex-1 overflow-hidden">
                <div className="grid h-full grid-cols-1 gap-4 overflow-auto pr-1 md:grid-cols-7">
                  {weekDays.map((day) => (
                    <div
                      key={day.key}
                      className={`flex h-full flex-col rounded-3xl border bg-background/70 p-4 shadow-sm transition-colors ${
                        day.isToday ? "border-secondary/50 shadow-secondary/30" : "border-default/20"
                      }`}
                    >
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-[0.3em] text-default-500">
                          {day.weekdayLabel}
                        </p>
                        <p className="text-lg font-semibold text-foreground">{day.monthDayLabel}</p>
                      </div>
                      <div className="mt-3 flex flex-1 flex-col gap-3">
                        {day.events.length === 0 ? (
                          <p className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-default/30 bg-content1/40 px-3 py-4 text-xs text-default-500">
                            Quiet day
                          </p>
                        ) : (
                          <div className="flex flex-1 flex-col gap-3 overflow-auto pr-1">
                            {day.events.map((event) => {
                              const styles = COLOR_STYLES[event.colorToken]
                              return (
                                <div
                                  key={`${day.key}-${event.id}`}
                                  className={`rounded-2xl border px-3 py-2 text-xs font-medium ${styles.border} ${styles.surface} ${styles.text}`}
                                >
                                  <p className="text-sm font-semibold">{event.name}</p>
                                  <p className="text-default-600">{formatTimeRange(event)}</p>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-6 text-xs uppercase tracking-[0.4em] text-default-500">
                Scroll ↓ for the daily stream
              </p>
            </div>
          </div>
        </section>

        <section className={SECTION_SNAP_CLASS}>
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col">
            <div className="flex h-full flex-col overflow-hidden rounded-[32px] border border-primary/20 bg-content1/70 p-8 shadow-2xl backdrop-blur-xl dark:bg-content1/60">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-primary/70">Day stream</p>
                  {focusedDay ? (
                    <>
                      <h2 className="text-3xl font-semibold text-foreground">
                        {DAY_DETAIL_FORMATTER.format(focusedDay.date)}
                      </h2>
                      <p className="text-sm text-default-600">
                        {getRelativeLabel(focusedDay.date, today)}
                      </p>
                    </>
                  ) : (
                    <h2 className="text-3xl font-semibold text-foreground">Daily detail</h2>
                  )}
                </div>
                <div className="rounded-2xl border border-primary/30 bg-primary/10 px-5 py-4 text-sm font-semibold text-foreground">
                  {dayEvents.length} event{dayEvents.length === 1 ? "" : "s"} in focus
                </div>
              </div>

              <div className="mt-8 flex flex-1 flex-col gap-6 overflow-hidden lg:flex-row">
                <div className="flex-1 rounded-3xl border border-default/20 bg-background/70 p-6 shadow-inner">
                  <p className="text-xs uppercase tracking-[0.3em] text-default-500">Timeline</p>
                  <div className="relative mt-4 h-56 rounded-2xl border border-default/20 bg-content1/50 p-4">
                    <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 border-t border-dashed border-default/40" />
                    {focusedDay &&
                      dayEvents.map((event, index) => {
                        const placement = getTimelinePlacement(event, focusedDay.date)
                        const styles = COLOR_STYLES[event.colorToken]
                        const laneOffset = 20 + (index % 2) * 48
                        return (
                          <div
                            key={event.id}
                            className={`absolute rounded-2xl border px-3 py-2 text-xs font-semibold shadow-sm ${styles.border} ${styles.surface} ${styles.text}`}
                            style={{
                              left: `${placement.left}%`,
                              width: `${placement.width}%`,
                              top: `${laneOffset}px`,
                            }}
                          >
                            <p>{event.name}</p>
                            <p className="text-[11px] font-normal text-default-600">
                              {formatTimeRange(event)}
                            </p>
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
                    <p className="mt-4 rounded-2xl border border-dashed border-default/30 bg-content1/50 px-4 py-3 text-sm text-default-600">
                      No events are locked to this day. Add an event and it will stretch across this
                      horizontal timeline.
                    </p>
                  )}
                </div>

                <div className="w-full rounded-3xl border border-default/20 bg-background/80 p-6 shadow-inner lg:w-80">
                  <p className="text-xs uppercase tracking-[0.3em] text-default-500">Upcoming</p>
                  <div className="mt-4 space-y-3">
                    {prioritizedUpcoming.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-default/30 bg-content1/40 px-4 py-4 text-sm text-default-600">
                        Nothing scheduled yet — once events exist you&apos;ll see them here.
                      </p>
                    ) : (
                      prioritizedUpcoming.map((event) => {
                        const styles = COLOR_STYLES[event.colorToken]
                        return (
                          <div
                            key={`upcoming-${event.id}`}
                            className={`rounded-2xl border px-4 py-3 text-sm ${styles.border} ${styles.surface}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
                              <p className={`font-semibold ${styles.text}`}>{event.name}</p>
                            </div>
                            <p className="text-xs text-default-600">
                              {formatTimeRange(event)} · {getRelativeLabel(event.start, today)}
                            </p>
                          </div>
                        )
                      })
                    )}
                  </div>
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

function buildMonthMatrix(anchor: Date, eventsByDate: Map<string, NormalizedEvent[]>) {
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
        isToday: isSameDay(current, anchor),
      })
    }
    weeks.push(week)
  }

  return weeks
}

function buildWeekDays(anchor: Date, eventsByDate: Map<string, NormalizedEvent[]>) {
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
      isToday: isSameDay(date, anchor),
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

function getRelativeLabel(target: Date, today: Date) {
  const diff =
    Math.round((startOfDay(target).getTime() - startOfDay(today).getTime()) / DAY_MS) || 0
  if (diff === 0) return "Today"
  if (diff === 1) return "Tomorrow"
  if (diff === -1) return "Yesterday"
  const distance = `${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"}`
  return diff > 0 ? `In ${distance}` : `${distance} ago`
}

function getTimelinePlacement(event: NormalizedEvent, referenceDay: Date) {
  const dayStart = startOfDay(referenceDay)
  const minutesSinceStart = (date: Date) => (date.getTime() - dayStart.getTime()) / 60_000
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

  const startMinutes = clamp(minutesSinceStart(event.start), 0, MINUTES_IN_DAY)
  const rawEndMinutes = clamp(minutesSinceStart(event.end), 0, MINUTES_IN_DAY)
  const ensuredEnd = Math.min(
    Math.max(rawEndMinutes, startMinutes + MIN_TIMELINE_BLOCK_MINUTES),
    MINUTES_IN_DAY,
  )

  const widthMinutes = ensuredEnd - startMinutes

  return {
    left: (startMinutes / MINUTES_IN_DAY) * 100,
    width: (widthMinutes / MINUTES_IN_DAY) * 100,
  }
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

type StatCardProps = {
  label: string
  value: number
  helper?: string
  emphasis?: boolean
}

function StatCard({ label, value, helper, emphasis }: StatCardProps) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-left ${
        emphasis ? "border-primary/40 bg-primary/10" : "border-default/25 bg-background/60"
      }`}
    >
      <p className="text-[11px] uppercase tracking-[0.3em] text-default-500">{label}</p>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      {helper ? <p className="text-xs text-default-500">{helper}</p> : null}
    </div>
  )
}


