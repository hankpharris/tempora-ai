"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

type ColorStyles = {
  border: string
  surface: string
  text: string
}

type ExpandableEventCardProps = {
  eventId?: string
  name: string
  description: string | null
  timeRange: string
  styles: ColorStyles
  variant?: "compact" | "default"
}

export function ExpandableEventCard({
  name,
  description,
  timeRange,
  styles,
  eventId,
  variant = "default",
}: ExpandableEventCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const router = useRouter()
  
  const hasDescription = description && description.length > 0
  const hasLongName = name.length > 20
  const isExpandable = hasDescription || hasLongName

  const handleClick = (e: React.MouseEvent) => {
    if (isExpandable) {
      e.stopPropagation()
      setIsExpanded(!isExpanded)
    }
  }

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!eventId || isDeleting) return
    setDeleteError(null)
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" })
      if (!res.ok) {
        let message = "Failed to delete event"
        try {
          const data = await res.json()
          message = data?.error || message
        } catch {
          // ignore JSON parse errors
        }
        throw new Error(message)
      }
      router.refresh()
    } catch (err: any) {
      setDeleteError(err?.message || "Failed to delete event")
    } finally {
      setIsDeleting(false)
    }
  }

  if (variant === "compact") {
    return (
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
              onClick={handleDeleteClick}
              disabled={isDeleting}
              aria-busy={isDeleting}
              className={`text-[11px] font-semibold text-danger transition ${isDeleting ? "opacity-50" : "hover:underline"}`}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
          )}
        </div>
        <p className="text-[11px] text-default-600">{timeRange}</p>
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
    )
  }

  // Default variant (for weekly/daily views)
  return (
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
            onClick={handleDeleteClick}
            disabled={isDeleting}
            aria-busy={isDeleting}
            className={`rounded-md border px-2 py-1 text-[11px] font-semibold text-danger transition ${
              isDeleting
                ? "border-danger/30 bg-danger/5 opacity-60"
                : "border-danger/30 bg-danger/10 hover:border-danger/50 hover:bg-danger/20"
            }`}
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        )}
      </div>
      <p className="text-default-600">{timeRange}</p>
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
}
