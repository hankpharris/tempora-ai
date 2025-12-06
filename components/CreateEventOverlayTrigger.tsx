"use client"

import React, { useEffect, useState } from "react"
import { createPortal } from "react-dom"

type RepeatOption = "NEVER" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"

type CreateEventOverlayTriggerProps = {
  triggerClassName?: string
  triggerLabel?: string
  initialStart?: string
  initialEnd?: string
  onSubmit?: (eventData: any) => void
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
  onSubmit,
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
  const [repeatInterval, setRepeatInterval] = useState<number>(1)

  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null)
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
    setRepeatInterval(1)
    setOpen(true)
  }

  const closeModal = () => setOpen(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const startISO = combineLocalDateTimeToISO(date, startTime)
    const endISO = combineLocalDateTimeToISO(date, endTime)
    const eventObj = {
      title: name,
      description,
      start: startISO,
      end: endISO,
      recurrence: repeat === "NEVER" ? null : { freq: repeat, interval: repeatInterval },
    }
    if (onSubmit) onSubmit(eventObj)
    setOpen(false)
  }

  const dialog = (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="relative w-full max-w-4xl bg-content1/90 rounded-2xl border border-primary/12 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-primary/10 bg-content1/95">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-primary/70">New event</p>
            <h3 className="text-lg font-semibold text-foreground">Create event</h3>
          </div>

          <div className="flex items-center gap-3">
            <button type="button" onClick={(e) => { /* also submit via form */ const form = document.getElementById('create-event-form') as HTMLFormElement | null; form?.requestSubmit() }} className="inline-flex h-9 items-center gap-2 rounded-md border bg-primary/90 px-4 text-sm font-semibold text-white">Save</button>
            <button
              type="button"
              aria-label="Close overlay"
              onClick={closeModal}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-content1/70 text-sm text-foreground shadow-sm"
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
                  className="w-full h-11 rounded-lg border border-default/20 bg-content1/80 px-4 py-2 text-sm placeholder:text-default-400 focus:outline-none focus:ring-0 focus:border-primary/40"
                />
              </div>

              {/* Schedule card */}
              <div className="rounded-xl border border-primary/10 bg-background/60 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs uppercase tracking-[0.22em] text-primary/70">Schedule</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-default-500 mb-2">Date</label>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full h-10 rounded-lg border border-default/20 bg-background/70 px-3 text-sm placeholder:text-default-400 focus:outline-none focus:ring-0 focus:border-primary/40" />
                  </div>

                  <div>
                    <label className="block text-xs text-default-500 mb-2">Time</label>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <div className="text-xs text-default-500 mb-1">Start time</div>
                        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full h-10 rounded-lg border border-default/20 bg-background/70 px-3 text-sm placeholder:text-default-400 focus:outline-none focus:ring-0 focus:border-primary/40" />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-default-500 mb-1">End time</div>
                        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full h-10 rounded-lg border border-default/20 bg-background/70 px-3 text-sm placeholder:text-default-400 focus:outline-none focus:ring-0 focus:border-primary/40" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-3">
                  <select value={repeat} onChange={(e) => setRepeat(e.target.value as RepeatOption)} className="rounded-lg border border-default/20 px-3 py-2 text-sm w-44 bg-content1/80 focus:outline-none focus:ring-0 focus:border-primary/40">
                    <option value="NEVER">Does not repeat</option>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>

                  <input type="number" min={1} value={repeatInterval} onChange={(e) => setRepeatInterval(Math.max(1, Number(e.target.value) || 1))} className="w-20 h-10 rounded-lg border border-default/20 bg-background/70 px-3 text-sm focus:outline-none focus:ring-0 focus:border-primary/40" />

                  <div className="ml-auto text-sm text-default-500">{repeat === "NEVER" ? 'No recurrence' : `Every ${repeatInterval} ${repeat.toLowerCase()}`}</div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="event-description" className="block text-xs uppercase tracking-[0.22em] text-default-500 mb-2">Details</label>
                <textarea id="event-description" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add notes or agenda" className="w-full rounded-lg border border-default/20 bg-content1/80 px-3 py-3 text-sm placeholder:text-default-400 focus:outline-none focus:ring-0 focus:border-primary/40" />
              </div>

              {/* Bottom actions (keep only Cancel since Save exists in header) */}
              <div className="flex items-center justify-end gap-3">
                {/* Intentionally only one Cancel/Close control (header ×) to avoid duplicate actions */}
                <div />
              </div>
            </form>
          </div>

          {/* Right preview / summary */}
          <aside className="md:col-span-1">
            <div className="rounded-xl border border-primary/8 bg-background/60 p-4 h-full flex flex-col gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-primary/70 mb-2">When</p>
                <div className="text-sm text-foreground">
                  <div className="font-semibold">{name || 'Untitled event'}</div>
                  <div className="text-default-500 mt-2">{date} {startTime} — {date} {endTime}</div>
                </div>
              </div>

              <div className="mt-auto text-xs text-default-500">Recurrence: {repeat === 'NEVER' ? 'None' : `${repeatInterval}× ${repeat}`}</div>
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

