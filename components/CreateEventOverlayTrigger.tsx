"use client"

import { useState } from "react"

type RepeatOption = "NEVER" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"

type CreateEventOverlayTriggerProps = {
  triggerClassName?: string
}

function toLocalInputValue(date: Date) {
  const offsetMinutes = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offsetMinutes * 60_000)
  return local.toISOString().slice(0, 16)
}

function splitLocalInputValue(dtLocal: string) {
  // dtLocal is like 2025-12-05T14:00
  const [date, time] = dtLocal.split("T")
  return { date, time: time ?? "00:00" }
}

function getDefaultDateTimes() {
  const now = new Date()
  const start = new Date(now.getTime() + 30 * 60_000)
  const end = new Date(start.getTime() + 60 * 60_000)
  return { start: toLocalInputValue(start), end: toLocalInputValue(end) }
}

export function CreateEventOverlayTrigger({ triggerClassName }: CreateEventOverlayTriggerProps) {
  const defaults = getDefaultDateTimes()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  // Split start/end into date + time inputs for cleaner UI
  const startSplit = splitLocalInputValue(defaults.start)
  const endSplit = splitLocalInputValue(defaults.end)
  const [startDate, setStartDate] = useState(startSplit.date)
  const [startTime, setStartTime] = useState(startSplit.time)
  const [endDate, setEndDate] = useState(endSplit.date)
  const [endTime, setEndTime] = useState(endSplit.time)

  const [repeat, setRepeat] = useState<RepeatOption>("NEVER")
  const [repeatInterval, setRepeatInterval] = useState<number>(1)
  const [weeklyDays, setWeeklyDays] = useState<Record<string, boolean>>({
    MO: false,
    TU: false,
    WE: false,
    TH: false,
    FR: true,
    SA: false,
    SU: false,
  })

  const [monthlyDay, setMonthlyDay] = useState<number | "">(new Date().getDate())
  const [repeatEndMode, setRepeatEndMode] = useState<"NEVER" | "UNTIL" | "AFTER">("NEVER")
  const [repeatUntil, setRepeatUntil] = useState("")
  const [repeatAfterCount, setRepeatAfterCount] = useState<number | "">(3)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // Hook up your API call here; closing for now to mimic completion.
    setOpen(false)
  }

  const handleOpen = () => {
    const reset = getDefaultDateTimes()
    setName("")
    setDescription("")
    const s = splitLocalInputValue(reset.start)
    const e = splitLocalInputValue(reset.end)
    setStartDate(s.date)
    setStartTime(s.time)
    setEndDate(e.date)
    setEndTime(e.time)
    setRepeat("NEVER")
    setRepeatInterval(1)
    setWeeklyDays({ MO: false, TU: false, WE: false, TH: false, FR: true, SA: false, SU: false })
    setMonthlyDay(new Date().getDate())
    setRepeatEndMode("NEVER")
    setRepeatUntil("")
    setRepeatAfterCount(3)
    setOpen(true)
  }

  const handleClose = () => setOpen(false)

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={triggerClassName}
      >
        Create event
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-xl overflow-auto">
          <div className="absolute left-0 top-0 p-4">
            <button
              type="button"
              aria-label="Close overlay"
              onClick={handleClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-default/30 bg-content1/70 text-sm font-semibold text-foreground shadow-md transition hover:scale-105 hover:border-default/50 hover:bg-content1/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              X
            </button>
          </div>

          <div className="flex min-h-screen w-full items-start md:items-center justify-center px-6 py-10">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-2xl rounded-3xl border border-primary/20 bg-content1/85 p-6 shadow-2xl backdrop-blur-2xl max-h-[calc(100vh-4rem)] overflow-auto"
            >
              <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-[0.3em] text-primary/70">New entry</p>
                <h3 className="text-2xl font-semibold text-foreground">Create event</h3>
                <p className="text-sm text-default-600">
                  Capture the essentials so we can place your event across month, week, and day
                  views.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                <div className="grid gap-6 md:grid-cols-[1.6fr,1fr]">
                  <div className="space-y-4 rounded-2xl border border-default/15 bg-background/70 p-5 shadow-inner">
                    <div className="space-y-2">
                      <label
                        htmlFor="event-name"
                        className="text-xs uppercase tracking-[0.25em] text-default-500"
                      >
                        Event name
                      </label>
                      <input
                        id="event-name"
                        name="name"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Team sync"
                        className="w-full rounded-xl border border-default/25 bg-content1/80 px-4 py-3 text-base font-semibold text-foreground shadow-inner shadow-primary/5 placeholder:text-default-400 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="event-description"
                        className="text-xs uppercase tracking-[0.25em] text-default-500"
                      >
                        Details
                      </label>
                      <textarea
                        id="event-description"
                        name="description"
                        rows={5}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What is the focus of this session?"
                        className="w-full rounded-xl border border-default/25 bg-content1/80 px-4 py-3 text-sm text-foreground shadow-inner shadow-primary/5 placeholder:text-default-400 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 rounded-2xl border border-primary/15 bg-content1/70 p-5 shadow-inner">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-primary/70">
                      <span>Schedule</span>
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary/90">
                        Busy
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="event-start-date" className="text-[11px] uppercase tracking-[0.25em] text-default-500">Date</label>
                          <input
                            id="event-start-date"
                            type="date"
                            required
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full rounded-xl border border-default/25 bg-background/70 px-3 py-2.5 text-sm text-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>

                        <div>
                          <label htmlFor="event-start-time" className="text-[11px] uppercase tracking-[0.25em] text-default-500">Time</label>
                          <input
                            id="event-start-time"
                            type="time"
                            required
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            className="w-full rounded-xl border border-default/25 bg-background/70 px-3 py-2.5 text-sm text-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="event-end-date" className="text-[11px] uppercase tracking-[0.25em] text-default-500">Date</label>
                          <input
                            id="event-end-date"
                            type="date"
                            required
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full rounded-xl border border-default/25 bg-background/70 px-3 py-2.5 text-sm text-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>

                        <div>
                          <label htmlFor="event-end-time" className="text-[11px] uppercase tracking-[0.25em] text-default-500">Time</label>
                          <input
                            id="event-end-time"
                            type="time"
                            required
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="w-full rounded-xl border border-default/25 bg-background/70 px-3 py-2.5 text-sm text-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label htmlFor="event-repeat" className="text-[11px] uppercase tracking-[0.25em] text-default-500">Repeat</label>
                          <span className="text-xs text-default-400">Preview</span>
                        </div>

                        <div className="flex gap-3">
                          <select
                            id="event-repeat"
                            name="repeat"
                            value={repeat}
                            onChange={(e) => setRepeat(e.target.value as RepeatOption)}
                            className="w-2/4 rounded-xl border border-default/25 bg-background/70 px-3 py-2.5 text-sm font-semibold text-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                          >
                            <option value="NEVER">Does not repeat</option>
                            <option value="DAILY">Daily</option>
                            <option value="WEEKLY">Weekly</option>
                            <option value="MONTHLY">Monthly</option>
                            <option value="YEARLY">Yearly</option>
                          </select>

                          <input
                            type="number"
                            min={1}
                            value={repeatInterval}
                            onChange={(e) => setRepeatInterval(Math.max(1, Number(e.target.value) || 1))}
                            className="w-1/4 rounded-xl border border-default/25 bg-background/70 px-3 py-2.5 text-sm text-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                            aria-label="Repeat every N"
                          />

                          <div className="flex-1 text-sm text-default-500 flex items-center">
                            {repeat === "NEVER" ? (
                              <span className="text-default-400">No recurrence</span>
                            ) : repeat === "DAILY" ? (
                              <span>Every {repeatInterval} day(s)</span>
                            ) : repeat === "WEEKLY" ? (
                              <span>Every {repeatInterval} week(s)</span>
                            ) : repeat === "MONTHLY" ? (
                              <span>Every {repeatInterval} month(s)</span>
                            ) : (
                              <span>Every {repeatInterval} year(s)</span>
                            )}
                          </div>
                        </div>

                        {/* Weekly weekday selectors */}
                        {repeat === "WEEKLY" && (
                          <div className="flex flex-wrap gap-2">
                            {[
                              ["MO", "Mon"],
                              ["TU", "Tue"],
                              ["WE", "Wed"],
                              ["TH", "Thu"],
                              ["FR", "Fri"],
                              ["SA", "Sat"],
                              ["SU", "Sun"],
                            ].map(([code, label]) => (
                              <button
                                key={code}
                                type="button"
                                onClick={() =>
                                  setWeeklyDays((prev) => ({ ...prev, [code as string]: !prev[code as string] }))
                                }
                                className={`rounded-full px-3 py-1 text-sm font-semibold transition ${weeklyDays[code as string] ? 'bg-primary/90 text-white' : 'bg-background/70 text-default-700 border border-default/15'}`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Monthly option: day of month */}
                        {repeat === "MONTHLY" && (
                          <div className="flex items-center gap-3">
                            <label className="text-sm text-default-500">Day</label>
                            <input
                              type="number"
                              min={1}
                              max={31}
                              value={monthlyDay}
                              onChange={(e) => setMonthlyDay(Number(e.target.value) || 1)}
                              className="w-24 rounded-xl border border-default/25 bg-background/70 px-3 py-2 text-sm text-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                            <span className="text-sm text-default-400">of each month</span>
                          </div>
                        )}

                        {/* Repeat end modes */}
                        {repeat !== "NEVER" && (
                          <div className="space-y-2 pt-2">
                            <div className="flex items-center gap-3">
                              <label className="inline-flex items-center gap-2 text-sm">
                                <input
                                  type="radio"
                                  name="repeat-end"
                                  checked={repeatEndMode === "NEVER"}
                                  onChange={() => setRepeatEndMode("NEVER")}
                                />
                                <span className="text-sm">Never</span>
                              </label>

                              <label className="inline-flex items-center gap-2 text-sm">
                                <input
                                  type="radio"
                                  name="repeat-end"
                                  checked={repeatEndMode === "UNTIL"}
                                  onChange={() => setRepeatEndMode("UNTIL")}
                                />
                                <span className="text-sm">Until</span>
                              </label>

                              <label className="inline-flex items-center gap-2 text-sm">
                                <input
                                  type="radio"
                                  name="repeat-end"
                                  checked={repeatEndMode === "AFTER"}
                                  onChange={() => setRepeatEndMode("AFTER")}
                                />
                                <span className="text-sm">After</span>
                              </label>
                            </div>

                            {repeatEndMode === "UNTIL" && (
                              <input
                                type="date"
                                value={repeatUntil}
                                onChange={(e) => setRepeatUntil(e.target.value)}
                                className="w-48 rounded-xl border border-default/25 bg-background/70 px-3 py-2 text-sm text-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                              />
                            )}

                            {repeatEndMode === "AFTER" && (
                              <div className="flex items-center gap-3">
                                <input
                                  type="number"
                                  min={1}
                                  value={repeatAfterCount}
                                  onChange={(e) => setRepeatAfterCount(Number(e.target.value) || 1)}
                                  className="w-28 rounded-xl border border-default/25 bg-background/70 px-3 py-2 text-sm text-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                                <span className="text-sm text-default-400">occurrence(s)</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="inline-flex items-center rounded-xl border border-default/20 bg-content1/60 px-4 py-2 text-sm font-semibold text-default-700 shadow-sm transition hover:border-default/40 hover:bg-content1/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center rounded-xl border border-primary/30 bg-primary/90 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition hover:-translate-y-[1px] hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    Save event
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
