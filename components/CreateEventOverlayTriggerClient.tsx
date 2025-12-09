"use client"

import { useRouter } from "next/navigation"
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
  const router = useRouter()

  const handleCreateEvent = async (payload: CreateEventPayload) => {
    // Attach scheduleId from wrapper if provided
    const body = { ...payload, ...(scheduleId ? { scheduleId } : {}) }

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      let message = "Failed to create event"

      try {
        const json = (await res.json()) as unknown
        if (json && typeof json === "object" && "error" in (json as Record<string, unknown>)) {
          message = String((json as { error?: string }).error || message)
        } else {
          message = JSON.stringify(json) || message
        }
      } catch {
        try {
          const text = await res.text()
          if (text) message = text
        } catch {
          // ignore
        }
      }

      throw new Error(message)
    }

    const data = await res.json()
    router.refresh()
    return data
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
