"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react"
import { ReactNode } from "react"

type Column<T> = {
  key: keyof T | string
  label: string
  render?: (value: unknown, row: T) => ReactNode
}

type DataTableProps<T extends Record<string, unknown>> = {
  columns: Column<T>[]
  data: T[]
  getRowId: (row: T) => string
  onCellClick?: (row: T, columnKey: string, value: unknown) => void
  isEditMode?: boolean
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  getRowId,
  onCellClick,
  isEditMode = false,
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-xl border-2 border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
      <div className="overflow-x-auto">
        <Table
          aria-label="Data table"
          removeWrapper
          classNames={{
            base: "min-w-full",
            th: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-white font-semibold text-xs uppercase tracking-wider px-4 py-3 border-b-2 border-gray-300 dark:border-gray-600",
            td: "px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-white bg-white dark:bg-gray-900",
            tr: "hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",
          }}
        >
          <TableHeader columns={columns}>
            {(column) => (
              <TableColumn key={column.key} className="whitespace-nowrap">
                {column.label}
              </TableColumn>
            )}
          </TableHeader>
          <TableBody items={data} emptyContent="No data available">
            {(row) => (
              <TableRow key={getRowId(row)}>
                {(columnKey) => {
                  const column = columns.find((col) => col.key === columnKey)
                  const value = row[columnKey as keyof T]
                  const cellContent = column?.render ? column.render(value, row) : String(value ?? "")

                  return (
                    <TableCell
                      key={columnKey}
                      className={`${isEditMode && onCellClick ? "cursor-pointer" : ""}`}
                      onClick={() => {
                        if (isEditMode && onCellClick) {
                          onCellClick(row, String(columnKey), value)
                        }
                      }}
                    >
                      {cellContent}
                    </TableCell>
                  )
                }}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

