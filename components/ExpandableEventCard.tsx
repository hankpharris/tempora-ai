"use client"

import { useState } from "react"

type ColorStyles = {
  border: string
  surface: string
  text: string
}

type ExpandableEventCardProps = {
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
  variant = "default",
}: ExpandableEventCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const hasDescription = description && description.length > 0
  const hasLongName = name.length > 20
  const isExpandable = hasDescription || hasLongName

  const handleClick = (e: React.MouseEvent) => {
    if (isExpandable) {
      e.stopPropagation()
      setIsExpanded(!isExpanded)
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
        <p className={!isExpanded && hasLongName ? "truncate" : ""}>{name}</p>
        <p className="text-[11px] text-default-600">{timeRange}</p>
        {isExpanded && hasDescription && (
          <p className="text-xs text-default-700 mt-2 whitespace-pre-wrap">
            {description}
          </p>
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
      <p className={`text-sm font-semibold ${!isExpanded && hasLongName ? "truncate" : ""}`}>{name}</p>
      <p className="text-default-600">{timeRange}</p>
      {!isExpanded && hasDescription && (
        <p className="text-[10px] text-default-500 mt-1">+ details</p>
      )}
      {isExpanded && hasDescription && (
        <p className="text-sm text-default-700 mt-3 whitespace-pre-wrap">
          {description}
        </p>
      )}
      {isExpanded && (
        <p className="text-xs text-default-500 mt-2">Click to collapse</p>
      )}
    </div>
  )
}

