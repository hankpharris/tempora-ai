"use client"

import { useState } from "react"
import { ExpandableEventCard } from "./ExpandableEventCard"

type StyledEvent = {
  id: string
  baseEventId: string
  slotIndex: number
  start: Date
  end: Date
  repeated: string
  repeatUntil: Date | null
  name: string
  description: string | null
  timeRange: string
  styles: { border: string; surface: string; text: string; chip: string; dot: string }
}

type MonthDayCellProps = {
  events: StyledEvent[]
}

export function MonthDayCell({ events }: MonthDayCellProps) {
  const [expanded, setExpanded] = useState(false)

  const visible = expanded ? events : events.slice(0, 3)

  return (
    <div className="mt-3 space-y-2">
      {events.length === 0 ? (
        <p className="text-xs text-default-500">No events</p>
      ) : (
        <>
          {visible.map((event) => (
            <ExpandableEventCard
              key={`${event.id}-${event.slotIndex}`}
              eventId={event.baseEventId}
              slotIndex={event.slotIndex}
              eventStart={event.start}
              eventEnd={event.end}
              repeated={event.repeated}
              repeatUntil={event.repeatUntil}
              name={event.name}
              description={event.description}
              timeRange={event.timeRange}
              styles={event.styles}
              variant="compact"
            />
          ))}
          {events.length > 3 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="w-full text-left text-[11px] font-semibold text-primary hover:text-primary-600"
            >
              {expanded
                ? "Collapse"
                : `Show +${events.length - 3} event${events.length - 3 === 1 ? "" : "s"}`}
            </button>
          )}
        </>
      )}
    </div>
  )
}
