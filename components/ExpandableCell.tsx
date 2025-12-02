"use client"

import { useRef, useState, useEffect } from "react"

type ExpandableCellProps = {
  value: string
  columnName: string
}

export function ExpandableCell({ value, columnName }: ExpandableCellProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  
  const displayValue = value.trim() === "" ? "—" : value

  // Check if content is actually overflowing (more than 3 lines visually)
  useEffect(() => {
    const el = contentRef.current
    if (el && !isExpanded) {
      // Check if scrollHeight > clientHeight (content is being clipped)
      const isClipped = el.scrollHeight > el.clientHeight + 2 // +2 for rounding
      setIsOverflowing(isClipped)
    }
  }, [value, isExpanded])

  const handleClick = (e: React.MouseEvent) => {
    if (isOverflowing || isExpanded) {
      e.stopPropagation()
      setIsExpanded(!isExpanded)
    }
  }

  return (
    <div
      onClick={handleClick}
      className={`min-h-[1.75rem] rounded-xl px-1.5 py-1 text-sm text-foreground/90 transition-all ${
        isOverflowing || isExpanded ? "cursor-pointer hover:bg-default-100" : ""
      }`}
    >
      {isExpanded ? (
        <>
          <pre className="whitespace-pre-wrap text-sm text-foreground">
            {displayValue}
          </pre>
          <p className="text-[10px] text-default-500 mt-2">Click to collapse</p>
        </>
      ) : (
        <div 
          ref={contentRef}
          className="overflow-hidden"
          style={{ 
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical" as const,
          }}
        >
          <span className="whitespace-pre-wrap">{displayValue}</span>
        </div>
      )}
    </div>
  )
}
