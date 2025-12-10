"use client"

import { useMemo } from "react"

type LocalTimeRangeProps = {
  start?: Date | string
  end?: Date | string
  className?: string
}

export function LocalTimeRange({ start, end, className }: LocalTimeRangeProps) {
  const value = useMemo(() => {
    if (!start || !end) return null
    const startDate = new Date(start)
    const endDate = new Date(end)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null
    const formatter = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" })
    return `${formatter.format(startDate)} – ${formatter.format(endDate)}`
  }, [start, end])

  if (!value) return null
  return <span className={className}>{value}</span>
}
