"use client"

import React, { useEffect, useState } from "react"
import { createPortal } from "react-dom"

type RepeatOption = "NEVER" | "DAILY" | "WEEKLY" | "MONTHLY"

export type TimeSlot = { start: string; end: string }

export type CreateEventPayload = {
  name: string
  description?: string
  timeSlots: TimeSlot[]
  repeated?: "NEVER" | "DAILY" | "WEEKLY" | "MONTHLY"
  repeatUntil?: string | null
  scheduleId?: string
}

type CreateEventOverlayTriggerProps = {
  triggerClassName?: string
  triggerLabel?: string
  initialStart?: string
  initialEnd?: string
  onCreateEvent?: (payload: CreateEventPayload) => Promise<unknown>
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

function getDefaultDateTimes() {
  const now = new Date()
  const start = new Date(now.getTime() + 30 * 60_000)
  const end = new Date(start.getTime() + 60 * 60_000)
  return { start: toLocalInputValue(start), end: toLocalInputValue(end) }
}

function combineLocalDateTimeToISO(dateStr?: string, timeStr?: string) {
  const d = dateStr ?? new Date().toISOString().slice(0, 10)
  const t = timeStr ?? "00:00"
  return new Date(`${d}T${t}`).toISOString()
}

export function CreateEventOverlayTrigger({
  triggerClassName,
  triggerLabel,
  initialStart,
  initialEnd,
  onCreateEvent,
}: CreateEventOverlayTriggerProps) {
  const defaults = getDefaultDateTimes()
  const startInit = initialStart ? toLocalInputValue(new Date(initialStart)) : defaults.start
  const endInit = initialEnd ? toLocalInputValue(new Date(initialEnd)) : defaults.end

  const startSplit = splitLocalInputValue(startInit)
  const endSplit = splitLocalInputValue(endInit)

  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  const [date, setDate] = useState(startSplit.date)
  const [startTime, setStartTime] = useState(startSplit.time)
  const [endTime, setEndTime] = useState(endSplit.time)

  const [repeat, setRepeat] = useState<RepeatOption>("NEVER")
  const [repeatUntil, setRepeatUntil] = useState("")
  const [color, setColor] = useState<string>("primary")
  const [location, setLocation] = useState("")
  const [reminder, setReminder] = useState(false)

  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  useEffect(() => {
    const el = document.createElement("div")
    el.setAttribute("data-create-event-portal", "")
    document.body.appendChild(el)
    setPortalEl(el)
    return () => {
      if (document.body.contains(el)) document.body.removeChild(el)
      setPortalEl(null)
    }
  }, [])

  const openModal = () => {
    setName("")
    setDescription("")
    setDate(startSplit.date)
    setStartTime(startSplit.time)
    setEndTime(endSplit.time)
    setRepeat("NEVER")
    setRepeatUntil("")
    setColor("primary")
    setLocation("")
    setReminder(false)
    setOpen(true)
  }

  const closeModal = () => setOpen(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!name || name.trim().length === 0) {
      setFormError("Event title is required")
      return
    }

    const startISO = combineLocalDateTimeToISO(date, startTime)
    const endISO = combineLocalDateTimeToISO(date, endTime)

    const startDate = new Date(startISO)
    const endDate = new Date(endISO)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      setFormError("Invalid start or end time")
      return
    }

    if (endDate <= startDate) {
      setFormError("End time must be after start time")
      return
    }

    const repeatUntilISO = repeatUntil ? new Date(repeatUntil).toISOString() : null
    if (repeat !== "NEVER" && repeatUntilISO) {
      const repeatUntilDate = new Date(repeatUntilISO)
      if (repeatUntilDate <= startDate) {
        setFormError("Repeat-until must be after the first time slot")
        return
      }
    }

    const payload: CreateEventPayload = {
      name: name.trim(),
      description: description?.trim() || undefined,
      timeSlots: [{ start: startISO, end: endISO }],
      repeated: repeat ?? "NEVER",
      repeatUntil: repeat === "NEVER" ? undefined : repeatUntilISO,
    }

    if (!onCreateEvent) {
      // No handler provided — fail fast but don't perform DB work here
      setFormError("No handler provided to create events")
      return
    }

    try {
      setIsSubmitting(true)
      await onCreateEvent(payload)
      setOpen(false)
    } catch (err: any) {
      setFormError(err?.message || "Failed to create event")
    } finally {
      setIsSubmitting(false)
    }
  }

  const dialog = (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="relative w-full max-w-4xl bg-content1/95 rounded-2xl border border-primary/15 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-primary/15 bg-content1/95">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-primary/70">New event</p>
            <h3 className="text-lg font-semibold text-foreground">Create event</h3>
          </div>

          <div className="flex items-center gap-3">
            <div />
            <button
              type="button"
              aria-label="Close overlay"
              onClick={closeModal}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-default/30 bg-content1/95 text-sm text-foreground shadow-sm"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
          {/* Main form */}
          <div className="md:col-span-2">
            <form id="create-event-form" onSubmit={handleSubmit} className="space-y-6">
              {/* Event name */}
              <div>
                <label htmlFor="event-name" className="block text-xs uppercase tracking-[0.22em] text-default-500 mb-2">Event name</label>
                <input
                  id="event-name"
                  name="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Add a title"
                  className="w-full h-11 rounded-lg border border-default/30 bg-content1/95 px-4 py-2 text-sm placeholder:text-default-400 focus:outline-none focus:ring-0 focus:border-primary/40"
                />
              </div>

              {/* Schedule card */}
              <div className="rounded-xl border border-primary/15 bg-content1/95 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs uppercase tracking-[0.22em] text-primary/70">Schedule</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-default-500 mb-2">Date</label>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full h-10 rounded-lg border border-default/30 bg-content1/95 px-3 text-sm placeholder:text-default-400 focus:outline-none focus:ring-0 focus:border-primary/40" />
                  </div>

                  <div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <div className="text-xs text-default-500 mb-1">Start time</div>
                        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full h-10 rounded-lg border border-default/30 bg-content1/95 px-3 text-sm placeholder:text-default-400 focus:outline-none focus:ring-0 focus:border-primary/40" />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-default-500 mb-1">End time</div>
                        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full h-10 rounded-lg border border-default/30 bg-content1/95 px-3 text-sm placeholder:text-default-400 focus:outline-none focus:ring-0 focus:border-primary/40" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-3">
                  <select value={repeat} onChange={(e) => setRepeat(e.target.value as RepeatOption)} className="rounded-lg border border-default/30 bg-content1/95 px-3 py-2 text-sm w-44 focus:outline-none focus:ring-0 focus:border-primary/40">
                    <option value="NEVER">Does not repeat</option>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>

                  {repeat !== "NEVER" && (
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-xs text-default-500">Until:</span>
                      <input 
                        type="date" 
                        value={repeatUntil} 
                        onChange={(e) => setRepeatUntil(e.target.value)} 
                        min={date}
                        className="flex-1 h-10 rounded-lg border border-default/30 bg-content1/95 px-3 text-sm focus:outline-none focus:ring-0 focus:border-primary/40" 
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="event-description" className="block text-xs uppercase tracking-[0.22em] text-default-500 mb-2">Details</label>
                <textarea id="event-description" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add notes or agenda" className="w-full rounded-lg border border-default/30 bg-content1/95 px-3 py-3 text-sm placeholder:text-default-400 focus:outline-none focus:ring-0 focus:border-primary/40" />
              </div>

              {/* Bottom actions: Save placed bottom-left */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  {formError && (
                    <div className="text-sm text-danger mb-2">{formError}</div>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    aria-busy={isSubmitting}
                    className={`inline-flex items-center rounded-md border px-4 py-2 text-sm font-semibold text-white ${isSubmitting ? "bg-primary/60" : "bg-primary/90"}`}
                  >
                    {isSubmitting ? "Saving…" : "Save"}
                  </button>
                </div>
                <div />
              </div>
            </form>
          </div>

          {/* Right preview / summary */}
          <aside className="md:col-span-1">
            <div className="rounded-xl border border-primary/12 bg-content1/95 p-4 h-full flex flex-col gap-4">
              {/* Preview Section */}
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-primary/70 mb-2">Preview</p>
                <div className="text-sm text-foreground">
                  <div className="font-semibold">{name || 'Untitled event'}</div>
                  <div className="text-default-500 mt-2">{date} {startTime} — {endTime}</div>
                  {location && (
                    <div className="text-default-500 mt-1">📍 {location}</div>
                  )}
                </div>
              </div>

              <div className="border-t border-default/20"></div>

              {/* Color Selection */}
              <div>
                <label className="block text-xs uppercase tracking-[0.22em] text-default-500 mb-2">Event Color</label>
                <div className="grid grid-cols-5 gap-2">
                  <button
                    type="button"
                    onClick={() => setColor("primary")}
                    className={`h-10 rounded-lg border-2 transition-all ${color === "primary" ? "border-primary bg-primary/20" : "border-primary/30 bg-primary/10 hover:border-primary/50"}`}
                    title="Primary"
                  />
                  <button
                    type="button"
                    onClick={() => setColor("secondary")}
                    className={`h-10 rounded-lg border-2 transition-all ${color === "secondary" ? "border-secondary bg-secondary/20" : "border-secondary/30 bg-secondary/10 hover:border-secondary/50"}`}
                    title="Secondary"
                  />
                  <button
                    type="button"
                    onClick={() => setColor("success")}
                    className={`h-10 rounded-lg border-2 transition-all ${color === "success" ? "border-success bg-success/20" : "border-success/30 bg-success/10 hover:border-success/50"}`}
                    title="Success"
                  />
                  <button
                    type="button"
                    onClick={() => setColor("warning")}
                    className={`h-10 rounded-lg border-2 transition-all ${color === "warning" ? "border-warning bg-warning/20" : "border-warning/30 bg-warning/10 hover:border-warning/50"}`}
                    title="Warning"
                  />
                  <button
                    type="button"
                    onClick={() => setColor("danger")}
                    className={`h-10 rounded-lg border-2 transition-all ${color === "danger" ? "border-danger bg-danger/20" : "border-danger/30 bg-danger/10 hover:border-danger/50"}`}
                    title="Danger"
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label htmlFor="event-location" className="block text-xs uppercase tracking-[0.22em] text-default-500 mb-2">Location</label>
                <input
                  id="event-location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Add location"
                  className="w-full h-10 rounded-lg border border-default/30 bg-content1/95 px-3 text-sm placeholder:text-default-400 focus:outline-none focus:ring-0 focus:border-primary/40"
                />
              </div>

              {/* Reminder Toggle */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reminder}
                    onChange={(e) => setReminder(e.target.checked)}
                    className="rounded border-default/30 text-primary focus:ring-2 focus:ring-primary/40"
                  />
                  <span className="text-xs uppercase tracking-[0.22em] text-default-500">Set Reminder</span>
                </label>
                {reminder && (
                  <p className="text-xs text-default-500 mt-2">You'll be notified 15 minutes before</p>
                )}
              </div>

              <div className="mt-auto text-xs text-default-500">
                {repeat === 'NEVER' ? 'No recurrence' : `Repeats ${repeat.toLowerCase()}${repeatUntil ? ` until ${new Date(repeatUntil).toLocaleDateString()}` : ''}`}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <button type="button" onClick={openModal} className={triggerClassName}>{triggerLabel ?? "Create event"}</button>
      {open && portalEl ? createPortal(dialog, portalEl) : null}
    </>
  )
}