"use client"

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Input,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useCallback, useEffect, useState } from "react"
import { EditModeToggle } from "../../components/EditModeToggle"
import { LogoutButton } from "../../components/LogoutButton"

type DatabaseRecord = Record<string, unknown>

type TableData = {
  users: DatabaseRecord[]
  friendships: DatabaseRecord[]
  schedules: DatabaseRecord[]
  events: DatabaseRecord[]
}

type EditingCell = {
  table: keyof TableData
  rowId: string
  field: string
} | null

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isEditMode, setIsEditMode] = useState(false)
  const [activeTable, setActiveTable] = useState<keyof TableData>("users")
  const [data, setData] = useState<TableData>({
    users: [],
    friendships: [],
    schedules: [],
    events: [],
  })
  const [loading, setLoading] = useState(true)
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [editValue, setEditValue] = useState("")

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/admin/data")
      
      if (response.ok) {
        const result = (await response.json()) as TableData
        setData(result)
      } else {
        const errorText = await response.text()
        console.error("Failed to fetch data:", response.status, response.statusText, errorText)
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }

    if (status === "authenticated") {
      if (session?.user?.type !== "ADMIN") {
        router.push("/login")
        return
      }
      void fetchData()
    }
  }, [status, session?.user?.type, router, fetchData])

  const handleCellClick = (table: keyof TableData, rowId: string, field: string, value: unknown) => {
    if (!isEditMode) return
    setEditingCell({ table, rowId, field })
    // Format date values for input
    if (value instanceof Date || (field.includes("At") || field === "start" || field === "end" || field === "emailVerified")) {
      const dateValue = value instanceof Date ? value : new Date(value as string)
      setEditValue(dateValue.toISOString().slice(0, 16)) // Format for datetime-local input
    } else {
      setEditValue(String(value || ""))
    }
  }

  const handleSave = async () => {
    if (!editingCell) return

    try {
      const response = await fetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: editingCell.table,
          id: editingCell.rowId,
          field: editingCell.field,
          value: editValue,
        }),
      })

      if (response.ok) {
        await fetchData()
        setEditingCell(null)
      }
    } catch (error) {
      console.error("Failed to update:", error)
    }
  }

  const renderCell = (item: DatabaseRecord, columnKey: string, table: keyof TableData) => {
    const cellValue = item[columnKey]
    const rowId =
      table === "friendships"
        ? `${item.user_id1 as string}-${item.user_id2 as string}`
        : (item.id as string) || `${item.user_id1 as string}-${item.user_id2 as string}`
    const isEditing =
      editingCell?.table === table &&
      editingCell?.rowId === rowId &&
      editingCell?.field === columnKey

    const isDateField = columnKey.includes("At") || columnKey === "start" || columnKey === "end" || columnKey === "emailVerified"

    if (isEditing) {
      return (
        <div className="flex items-center gap-2">
          <Input
            size="sm"
            type={isDateField ? "datetime-local" : "text"}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave()
              if (e.key === "Escape") setEditingCell(null)
            }}
            autoFocus
            classNames={{
              inputWrapper: "ps-2 pe-2",
              input: "pl-1.5 pr-1.5 text-sm text-foreground",
            }}
          />
          <Button
            size="sm"
            color="primary"
            radius="md"
            className="rounded-xl px-4"
            onPress={handleSave}
          >
            Save
          </Button>
        </div>
      )
    }

    // Format date values for display
    let displayValue: string
    if (isDateField && cellValue) {
      try {
        const date = typeof cellValue === "string" ? new Date(cellValue) : cellValue
        displayValue =
          date instanceof Date && !isNaN(date.getTime())
            ? date.toLocaleString()
            : String(cellValue || "")
      } catch {
        displayValue = String(cellValue || "")
      }
    } else {
      displayValue = String(cellValue ?? "")
    }

    const formattedValue = displayValue.trim() === "" ? "—" : displayValue

    return (
      <span
        onClick={() => {
          if (isEditMode) {
            handleCellClick(table, rowId, columnKey, cellValue)
          }
        }}
        className={`block min-h-[1.75rem] rounded-xl px-1.5 py-1 text-sm text-foreground/90 transition-colors ${
          isEditMode
            ? "cursor-pointer hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            : ""
        }`}
      >
        {formattedValue}
      </span>
    )
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Spinner size="lg" color="primary" />
          <p className="mt-4 text-sm text-default-500">Loading session...</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Spinner size="lg" color="primary" />
          <p className="mt-4 text-sm text-default-500">Loading data...</p>
        </div>
      </div>
    )
  }

  const tableColumns: Record<keyof TableData, string[]> = {
    users: ["id", "email", "name", "type", "createdAt"],
    friendships: ["user_id1", "user_id2", "status", "createdAt"],
    schedules: ["id", "userId", "name", "createdAt"],
    events: ["id", "scheduleId", "start", "end", "createdAt"],
  }

  const currentData = data[activeTable] || []
  const columns = tableColumns[activeTable] || []

  const tableOptions: { key: keyof TableData; label: string; description: string }[] = [
    { key: "users", label: "Users", description: "Accounts & roles" },
    { key: "friendships", label: "Friendships", description: "Social graph" },
    { key: "schedules", label: "Schedules", description: "Planning scenes" },
    { key: "events", label: "Events", description: "Timeline entries" },
  ]

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-background via-default-100/15 to-default-200/20 px-6 py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-20 h-96 w-96">
          <div className="h-full w-full rounded-full bg-primary/15 blur-3xl animate-blob-slow" />
        </div>
        <div className="absolute right-10 top-1/3 h-72 w-72">
          <div className="h-full w-full rounded-full bg-secondary/12 blur-3xl animate-blob-reverse animation-delay-2000" />
        </div>
        <div className="absolute bottom-10 left-1/2 h-80 w-80 -translate-x-1/2">
          <div className="h-full w-full rounded-full bg-primary/12 blur-3xl animate-blob-medium animation-delay-4000" />
        </div>
        <div className="absolute -bottom-24 right-1/4 h-64 w-64">
          <div className="h-full w-full rounded-full bg-secondary/14 blur-[120px] animate-blob-reverse animation-delay-2000" />
        </div>
      </div>

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-primary/80">Operations</p>
            <h1 className="mt-1 text-4xl font-semibold text-foreground">Admin Control Center</h1>
            <p className="mt-2 max-w-2xl text-sm text-default-500">
              Monitor and fine-tune Tempora datasets with inline editing, responsive insights, and a
              spreadsheet-inspired layout that keeps relational context clear.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <EditModeToggle isEditMode={isEditMode} onToggle={setIsEditMode} />
            <LogoutButton />
          </div>
        </div>

        <Card className="rounded-3xl border border-primary/15 bg-content1/80 shadow-2xl backdrop-blur-xl dark:border-primary/25 dark:bg-content1/60">
          <CardHeader className="flex flex-col gap-2 px-5 py-5 md:flex-row md:items-end md:justify-between md:px-7 md:py-7">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-primary/70">Data overview</p>
              <h2 className="text-2xl font-semibold capitalize text-foreground">{activeTable}</h2>
            </div>
            <p className="text-sm text-default-500">
              {currentData.length} record{currentData.length === 1 ? "" : "s"} loaded
            </p>
          </CardHeader>
          <Divider />
          <CardBody className="flex flex-col gap-6 px-5 pb-7 pt-2 md:px-7">
            <div className="flex flex-wrap gap-3">
              {tableOptions.map((tab) => {
                const isSelected = activeTable === tab.key
                return (
                  <Button
                    key={tab.key}
                    variant={isSelected ? "solid" : "light"}
                    color="primary"
                    radius="md"
                    className={`h-auto rounded-lg border border-transparent px-4 py-3 text-left transition-all duration-200 ${
                      isSelected
                        ? "border-primary/50 bg-primary/20"
                        : "border-primary/15 hover:border-primary/30"
                    }`}
                    onPress={() => {
                      setActiveTable(tab.key)
                      setEditingCell(null)
                    }}
                  >
                    <span className="flex flex-col items-start gap-1">
                      <span className="text-sm font-semibold capitalize text-foreground">
                        {tab.label}
                      </span>
                      <span className="text-[11px] uppercase tracking-[0.25em] text-default-500">
                        {tab.description}
                      </span>
                    </span>
                  </Button>
                )
              })}
            </div>

            {currentData.length === 0 ? (
              <div className="rounded-3xl border border-default/20 bg-content1/70 px-6 py-10 text-center text-sm text-default-500 md:px-10">
                No data available for {activeTable}
              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-default/20 shadow-inner">
                <div className="relative overflow-auto">
                  <Table
                    aria-label={`${activeTable} table`}
                    removeWrapper
                    classNames={{
                      base: "min-w-full",
                      table: "min-w-full border-collapse",
                      thead: "bg-transparent",
                      th: "bg-default-100/80 text-[12px] font-semibold uppercase tracking-[0.25em] text-default-500 first:rounded-tl-3xl last:rounded-tr-3xl",
                      tbody: "align-top",
                      td: "border-b-0 bg-transparent px-1 py-0",
                      tr: "transition-colors",
                    }}
                  >
                    <TableHeader>
                      {columns.map((column) => (
                        <TableColumn key={column} className="px-5 py-4">
                          {column}
                        </TableColumn>
                      ))}
                    </TableHeader>
                    <TableBody emptyContent={`No ${activeTable} found`}>
                      {currentData.map((item, rowIndex) => {
                        const rowId =
                          activeTable === "friendships"
                            ? `${item.user_id1 as string}-${item.user_id2 as string}`
                            : (item.id as string) ||
                              `${item.user_id1 as string}-${item.user_id2 as string}`
                        return (
                          <TableRow key={rowId}>
                            {columns.map((column) => (
                              <TableCell key={`${rowId}-${column}`}>
                                <div
                                  className={`rounded-2xl border border-default/20 bg-content1/85 px-3 py-2.5 shadow-sm transition-all ${
                                    rowIndex === 0 ? "" : "mt-2"
                                  } ${
                                    isEditMode
                                      ? "hover:border-primary/40 hover:bg-primary/10"
                                      : ""
                                  }`}
                                >
                                  {renderCell(item, column, activeTable)}
                                </div>
                              </TableCell>
                            ))}
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

