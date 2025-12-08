"use client"

import React from "react"
import { CreateEventOverlayTrigger, CreateEventPayload } from "./CreateEventOverlayTrigger"

type Props = {
  scheduleId?: string
  triggerClassName?: string
  triggerLabel?: string
  initialStart?: string
  initialEnd?: string
}

export function CreateEventOverlayTriggerClient({
  scheduleId,
  triggerClassName,
  triggerLabel,
  initialStart,
  initialEnd,
}: Props) {
  const handleCreateEvent = async (payload: CreateEventPayload) => {
    // Attach scheduleId from wrapper if provided
    const body = { ...payload, ...(scheduleId ? { scheduleId } : {}) }

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      // Try JSON error first, fallback to text
      try {
        const json = await res.json()
        throw new Error(json?.error || JSON.stringify(json) || "Failed to create event")
      } catch (e) {
        const text = await res.text()
        throw new Error(text || "Failed to create event")
      }
    }

    return res.json()
  }

  return (
    <CreateEventOverlayTrigger
      triggerClassName={triggerClassName}
      triggerLabel={triggerLabel}
      initialStart={initialStart}
      initialEnd={initialEnd}
      onCreateEvent={handleCreateEvent}
    />
  )
}

export default CreateEventOverlayTriggerClient
