"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

const POPOVER_BROADCAST_EVENT = "tempora-event-card-edit-open"
type RepeatOption = "NEVER" | "DAILY" | "WEEKLY" | "MONTHLY"

type ColorStyles = {
  border: string
  surface: string
  text: string
}

type ExpandableEventCardProps = {
  eventId?: string
  slotIndex?: number
  eventStart?: Date | string
  eventEnd?: Date | string
  repeated?: string
  repeatUntil?: Date | null
  name: string
  description: string | null
  timeRange?: string
  styles: ColorStyles
  variant?: "compact" | "default"
}

function toLocalInputValue(date: Date) {
  const offsetMinutes = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offsetMinutes * 60_000)
  return local.toISOString().slice(0, 16)
}

function splitLocalInputValue(dtLocal: string) {
  const [date, time] = dtLocal.split("T")
  const shortTime = time ? time.slice(0, 5) : "00:00"
  return { date, time: shortTime }
}

function combineLocalDateTimeToISO(dateStr?: string, timeStr?: string) {
  const d = dateStr ?? new Date().toISOString().slice(0, 10)
  const t = timeStr ?? "00:00"
  return new Date(`${d}T${t}`).toISOString()
}

const WEEKDAY_LABELS: { value: number; label: string }[] = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
]

function generateRepeatingTimeSlots(
  repeat: RepeatOption,
  dateStr: string,
  startTime: string,
  endTime: string,
  weeklyDays: Set<number>,
) {
  const baseSlot = { start: combineLocalDateTimeToISO(dateStr, startTime), end: combineLocalDateTimeToISO(dateStr, endTime) }
  if (repeat !== "WEEKLY") return [baseSlot]

  const [year, month, day] = dateStr.split("-").map(Number)
  const baseDate = new Date(year, (month || 1) - 1, day || 1)
  const baseDay = baseDate.getDay()
  const days = Array.from(weeklyDays.values()).sort((a, b) => a - b)
  if (days.length === 0) return [baseSlot]

  return days.map((dow) => {
    const offset = dow - baseDay >= 0 ? dow - baseDay : dow - baseDay + 7
    const d = new Date(baseDate.getTime() + offset * 86_400_000)
    const dStr = d.toISOString().slice(0, 10)
    return {
      start: combineLocalDateTimeToISO(dStr, startTime),
      end: combineLocalDateTimeToISO(dStr, endTime),
    }
  })
}

export function ExpandableEventCard({
  name,
  description,
  timeRange,
  styles,
  slotIndex,
  eventStart,
  eventEnd,
  repeated,
  repeatUntil,
  eventId,
  variant = "default",
}: ExpandableEventCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editName, setEditName] = useState(name)
  const [editDescription, setEditDescription] = useState(description ?? "")
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; arrowLeft: number } | null>(null)
  const router = useRouter()
  const editButtonRef = useRef<HTMLButtonElement | null>(null)
  const instanceIdRef = useRef<string>(Math.random().toString(36).slice(2))
  const [editRepeat, setEditRepeat] = useState<RepeatOption>(
    (repeated as RepeatOption | undefined) ?? "NEVER",
  )
  const startValue = eventStart ? new Date(eventStart) : undefined
  const endValue = eventEnd ? new Date(eventEnd) : undefined
  const defaultDateTimes = useMemo(() => {
    const start = startValue ?? new Date()
    const end = endValue ?? new Date(start.getTime() + 60 * 60_000)
    return {
      start: splitLocalInputValue(toLocalInputValue(start)),
      end: splitLocalInputValue(toLocalInputValue(end)),
      startDate: start,
      endDate: end,
    }
  }, [startValue, endValue])
  const [editWeeklyDays, setEditWeeklyDays] = useState<Set<number>>(
    new Set([defaultDateTimes.startDate.getDay()]),
  )
  const [editDate, setEditDate] = useState(defaultDateTimes.start.date)
  const [editStartTime, setEditStartTime] = useState(defaultDateTimes.start.time)
  const [editEndTime, setEditEndTime] = useState(defaultDateTimes.end.time)
  const [editRepeatUntil, setEditRepeatUntil] = useState(
    repeatUntil ? repeatUntil.toISOString().slice(0, 10) : "",
  )

  const hasDescription = description && description.length > 0
  const hasLongName = name.length > 20
  const isExpandable = hasDescription || hasLongName
  const displayTimeRange = useMemo(() => {
    if (startValue && !Number.isNaN(startValue.getTime()) && endValue && !Number.isNaN(endValue.getTime())) {
      const formatter = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" })
      return `${formatter.format(startValue)} – ${formatter.format(endValue)}`
    }
    return timeRange
  }, [endValue, startValue, timeRange])

  const handleClick = (e: React.MouseEvent) => {
    if (isExpandable) {
      e.stopPropagation()
      setIsExpanded(!isExpanded)
    }
  }

  const updatePopoverPosition = () => {
    const btn = editButtonRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const width = 360
    const arrowSize = 10
    const padding = 12
    const left = Math.max(
      padding,
      Math.min(window.innerWidth - width - padding, rect.left + rect.width / 2 - width / 2),
    )
    const arrowLeft = Math.min(
      width - arrowSize * 2,
      Math.max(arrowSize * 2, rect.left + rect.width / 2 - left),
    )
    const top = rect.bottom + 6
    setPopoverPos({ top, left, arrowLeft })
  }

  const openEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditError(null)
    setEditName(name)
    setEditDescription(description ?? "")
    setEditDate(defaultDateTimes.start.date)
    setEditStartTime(defaultDateTimes.start.time)
    setEditEndTime(defaultDateTimes.end.time)
    setEditWeeklyDays(new Set([defaultDateTimes.startDate.getDay()]))
    setEditRepeatUntil(repeatUntil ? repeatUntil.toISOString().slice(0, 10) : "")
    setEditRepeat((repeated as RepeatOption | undefined) ?? "NEVER")
    updatePopoverPosition()
    window.dispatchEvent(new CustomEvent(POPOVER_BROADCAST_EVENT, { detail: { origin: instanceIdRef.current } }))
    setIsEditOpen(true)
  }

  const closeEdit = () => {
    setIsEditOpen(false)
    setIsSaving(false)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventId) return

    setEditError(null)

    if (!editName || editName.trim().length === 0) {
      setEditError("Event title is required")
      return
    }

    const startISO = combineLocalDateTimeToISO(editDate, editStartTime)
    const endISO = combineLocalDateTimeToISO(editDate, editEndTime)
    const startDate = new Date(startISO)
    const endDate = new Date(endISO)

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setEditError("Add a valid start and end time.")
      return
    }

    if (endDate <= startDate) {
      setEditError("End time should be after the start time.")
      return
    }

    try {
      setIsSaving(true)
      const timeSlots = generateRepeatingTimeSlots(editRepeat, editDate, editStartTime, editEndTime, editWeeklyDays)
      const repeatUntilISO =
        editRepeat !== "NEVER" && editRepeatUntil ? new Date(`${editRepeatUntil}T00:00`).toISOString() : null
      if (repeatUntilISO) {
        const repeatUntilDate = new Date(repeatUntilISO)
        const earliestSlot = timeSlots.reduce((min, slot) => {
          const dt = new Date(slot.start)
          return dt < min ? dt : min
        }, startDate)
        if (repeatUntilDate <= earliestSlot) {
          setEditError("Repeat-until must be after the first time slot")
          setIsSaving(false)
          return
        }
      }
      const payload: {
        name: string
        description: string | null
        timeSlots: { start: string; end: string }[]
        slotIndex: number
        repeated: typeof editRepeat
        repeatUntil: string | null
      } = {
        name: editName.trim(),
        description: editDescription.trim() || null,
        timeSlots,
        slotIndex: slotIndex ?? 0,
        repeated: editRepeat,
        repeatUntil:
          editRepeat === "NEVER"
            ? null
            : repeatUntilISO,
      }

      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        let message = "Failed to update event"

        try {
          const data = (await res.json()) as unknown
          if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
            message = String((data as { error?: string }).error || message)
          } else {
            message = JSON.stringify(data) || message
          }
        } catch {
          try {
            const text = await res.text()
            if (text) message = text
          } catch {
            // ignore parse errors
          }
        }

        throw new Error(message)
      }

      setIsEditOpen(false)
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update event"
      setEditError(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!eventId || isDeleting) return
    const confirmed = window.confirm("Delete this event? This cannot be undone.")
    if (!confirmed) return
    setDeleteError(null)
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" })
      if (!res.ok) {
        let message = "Failed to delete event"

        try {
          const data = (await res.json()) as unknown
          if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
            message = String((data as { error?: string }).error || message)
          } else {
            message = JSON.stringify(data) || message
          }
        } catch {
          try {
            const text = await res.text()
            if (text) message = text
          } catch {
            // ignore parse errors
          }
        }

        throw new Error(message)
      }
      setIsEditOpen(false)
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete event"
      setDeleteError(message)
    } finally {
      setIsDeleting(false)
    }
  }

  useEffect(() => {
    if (!isEditOpen) return
    const handler = () => updatePopoverPosition()
    window.addEventListener("resize", handler)
    window.addEventListener("scroll", handler, true)
    handler()
    return () => {
      window.removeEventListener("resize", handler)
      window.removeEventListener("scroll", handler, true)
    }
  }, [isEditOpen])

  useEffect(() => {
    const listener = (event: Event) => {
      const custom = event as CustomEvent
      const origin = (custom.detail as { origin?: string } | undefined)?.origin
      if (origin && origin !== instanceIdRef.current) {
        setIsEditOpen(false)
      }
    }
    window.addEventListener(POPOVER_BROADCAST_EVENT, listener)
    return () => window.removeEventListener(POPOVER_BROADCAST_EVENT, listener)
  }, [])

  const card =
    variant === "compact" ? (
      <div
        onClick={handleClick}
        className={`rounded-xl border px-2 py-1 text-xs font-medium transition-all ${styles.border} ${styles.surface} ${styles.text} ${
          isExpandable ? "cursor-pointer hover:shadow-md" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <p className={`leading-tight ${!isExpanded && hasLongName ? "truncate" : ""}`}>{name}</p>
          {eventId && (
            <button
              type="button"
              ref={editButtonRef}
              onClick={openEdit}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-success/40 bg-success/10 text-[11px] font-semibold text-success transition hover:border-success/60 hover:bg-success/20"
              aria-label="Edit event"
            >
              ✎
            </button>
          )}
        </div>
        <p className="text-[11px] text-default-600">{displayTimeRange}</p>
        {isExpanded && hasDescription && (
          <p className="text-xs text-default-700 mt-2 whitespace-pre-wrap">
            {description}
          </p>
        )}
        {deleteError && (
          <p className="mt-1 text-[11px] text-danger">{deleteError}</p>
        )}
        {isExpanded && (
          <p className="text-[10px] text-default-500 mt-2">Click to collapse</p>
        )}
      </div>
    ) : (
      <div
        onClick={handleClick}
        className={`rounded-2xl border px-3 py-2 text-xs font-medium transition-all ${styles.border} ${styles.surface} ${styles.text} ${
          isExpandable ? "cursor-pointer hover:shadow-md" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <p className={`text-sm font-semibold ${!isExpanded && hasLongName ? "truncate" : ""}`}>{name}</p>
          {eventId && (
            <button
              type="button"
              ref={editButtonRef}
              onClick={openEdit}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-success/40 bg-success/10 text-[11px] font-semibold text-success transition hover:border-success/60 hover:bg-success/20"
              aria-label="Edit event"
            >
              ✎
            </button>
          )}
        </div>
        <p className="text-default-600">{displayTimeRange}</p>
        {!isExpanded && hasDescription && (
          <p className="text-[10px] text-default-500 mt-1">+ details</p>
        )}
        {isExpanded && hasDescription && (
          <p className="text-sm text-default-700 mt-3 whitespace-pre-wrap">
            {description}
          </p>
        )}
        {deleteError && (
          <p className="mt-2 text-xs text-danger">{deleteError}</p>
        )}
        {isExpanded && (
          <p className="text-xs text-default-500 mt-2">Click to collapse</p>
        )}
      </div>
    )

  return (
    <>
      {card}

      {isEditOpen && popoverPos && createPortal(
        <div
          className="fixed z-[75]"
          style={{ top: popoverPos.top, left: popoverPos.left, width: 360 }}
        >
          <div className="absolute -top-2 left-0 right-0 h-4 pointer-events-none" aria-hidden>
            <span
              className="absolute top-0 h-4 w-4 -translate-x-1/2 rotate-45 rounded-sm bg-background border border-default/30 shadow-md"
              style={{ left: popoverPos.arrowLeft }}
            />
          </div>
          <div className="rounded-2xl border border-default/30 bg-background/95 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-success/70">Edit event</p>
                <p className="text-lg font-semibold text-foreground">{name}</p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                className="h-8 w-8 rounded-full border border-default/30 text-default-500 hover:text-foreground"
                aria-label="Close edit dialog"
              >
                ×
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleEditSubmit}>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.22em] text-default-500">Event name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-10 rounded-lg border border-default/30 bg-content1/95 px-3 text-sm focus:outline-none focus:ring-0 focus:border-success/50"
                  placeholder="Event title"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-[0.22em] text-default-500">Date</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full h-10 rounded-lg border border-default/30 bg-content1/95 px-3 text-sm focus:outline-none focus:ring-0 focus:border-success/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-[0.22em] text-default-500">Start</label>
                    <input
                      type="time"
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                      className="w-full h-10 rounded-lg border border-default/30 bg-content1/95 px-3 text-sm focus:outline-none focus:ring-0 focus:border-success/50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-[0.22em] text-default-500">End</label>
                    <input
                      type="time"
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                      className="w-full h-10 rounded-lg border border-default/30 bg-content1/95 px-3 text-sm focus:outline-none focus:ring-0 focus:border-success/50"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.22em] text-default-500">Details</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-default/30 bg-content1/95 px-3 py-2 text-sm focus:outline-none focus:ring-0 focus:border-success/50"
                  placeholder="Notes"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.22em] text-default-500">Repeats</label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[auto,1fr] md:items-end md:gap-3">
                  <select
                    value={editRepeat}
                    onChange={(e) => setEditRepeat(e.target.value as RepeatOption)}
                    className="h-10 min-w-[10rem] rounded-lg border border-default/30 bg-content1/95 px-3 text-sm focus:outline-none focus:ring-0 focus:border-success/50"
                  >
                    <option value="NEVER">Does not repeat</option>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>

                  {editRepeat !== "NEVER" && (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs uppercase tracking-[0.22em] text-default-500">Until</label>
                      <input
                        type="date"
                        value={editRepeatUntil}
                        min={editDate}
                        onChange={(e) => setEditRepeatUntil(e.target.value)}
                        className="h-10 rounded-lg border border-default/30 bg-content1/95 px-3 text-sm focus:outline-none focus:ring-0 focus:border-success/50"
                      />
                    </div>
                  )}
                </div>
                {editRepeat === "WEEKLY" && (
                  <div className="mt-3 flex flex-wrap gap-2" aria-label="Select days of week">
                    {WEEKDAY_LABELS.map((day) => {
                      const isSelected = editWeeklyDays.has(day.value)
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => {
                            const next = new Set(editWeeklyDays)
                            if (next.has(day.value)) {
                              next.delete(day.value)
                            } else {
                              next.add(day.value)
                            }
                            setEditWeeklyDays(next)
                          }}
                          className={`h-9 min-w-[48px] rounded-full border px-3 text-xs font-semibold transition ${
                            isSelected
                              ? "border-success/50 bg-success/10 text-success-600"
                              : "border-default/30 bg-content1/95 text-default-600 hover:border-success/30"
                          }`}
                        >
                          {day.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {editError && (
                <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {editError}
                </div>
              )}

              {deleteError && !editError && (
                <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {deleteError}
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  disabled={isDeleting}
                  aria-busy={isDeleting}
                  className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger hover:border-danger/50 hover:bg-danger/20 disabled:opacity-60"
                >
                  {isDeleting ? "Deleting…" : "Delete"}
                </button>
                <button
                  type="button"
                  onClick={closeEdit}
                  className="rounded-md border border-default/30 bg-content1 px-3 py-2 text-sm font-semibold text-default-700 hover:border-default/50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  aria-busy={isSaving}
                  className="rounded-md border border-success/40 bg-success/80 px-4 py-2 text-sm font-semibold text-white hover:bg-success/90 disabled:opacity-70"
                >
                  {isSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
