"use client"

import { Button } from "@heroui/react"

type PageNavigationProps = {
  currentPage: number
  totalPages: number
  total: number
  onPageChange: (direction: "prev" | "next") => void
}

export function PageNavigation({
  currentPage,
  totalPages,
  total,
  onPageChange,
}: PageNavigationProps) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-3">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
        Page <span className="font-semibold text-gray-900 dark:text-white">{currentPage}</span> of{" "}
        <span className="font-semibold text-gray-900 dark:text-white">{totalPages}</span> ({total} total)
      </span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="flat"
          color="primary"
          isDisabled={currentPage <= 1}
          onPress={() => onPageChange("prev")}
          aria-label="Previous page"
          className="min-w-0 px-3"
        >
          ←
        </Button>
        <Button
          size="sm"
          variant="flat"
          color="primary"
          isDisabled={currentPage >= totalPages}
          onPress={() => onPageChange("next")}
          aria-label="Next page"
          className="min-w-0 px-3"
        >
          →
        </Button>
      </div>
    </div>
  )
}

