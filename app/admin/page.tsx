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
import { ExpandableCell } from "../../components/ExpandableCell"
import { LogoutButton } from "../../components/LogoutButton"
import { MovingBlob } from "../../components/MovingBlob"

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
    
    // Handle arrays (start[] and end[])
    if (Array.isArray(value)) {
      // For arrays, convert to JSON for editing
      const formattedArray = value.map((v) => {
        if (v instanceof Date || (typeof v === "string" && !isNaN(Date.parse(v)))) {
          return new Date(v as string).toISOString()
        }
        return v
      })
      setEditValue(JSON.stringify(formattedArray))
      return
    }
    
    // Format date values for input
    const isDateField = field.includes("At") || field === "emailVerified" || field === "repeatUntil"
    if (isDateField) {
      if (value) {
        const dateValue = value instanceof Date ? value : new Date(value as string)
        setEditValue(dateValue.toISOString().slice(0, 16)) // Format for datetime-local input
      } else {
        setEditValue("") // Handle null repeatUntil
      }
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

    const isDateField = columnKey.includes("At") || columnKey === "emailVerified" || columnKey === "repeatUntil"
    const isDateArrayField = columnKey === "start" || columnKey === "end"

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

    // Format value for display
    let displayValue: string

    if (Array.isArray(cellValue)) {
      // Handle arrays (like start[] and end[])
      if (isDateArrayField) {
        const formattedDates = cellValue.map((v) => {
          try {
            const date = typeof v === "string" ? new Date(v) : v
            return date instanceof Date && !isNaN(date.getTime())
              ? date.toLocaleString()
              : String(v)
          } catch {
            return String(v)
          }
        })
        displayValue = formattedDates.join("\n")
      } else {
        displayValue = JSON.stringify(cellValue, null, 2)
      }
    } else if (isDateField && cellValue) {
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

    // If in edit mode, show editable cell
    if (isEditMode) {
      return (
        <div
          onClick={() => handleCellClick(table, rowId, columnKey, cellValue)}
          className="min-h-[1.75rem] rounded-xl px-1.5 py-1 text-sm text-foreground/90 cursor-pointer hover:text-primary transition-colors"
        >
          <span className="whitespace-pre-wrap">{formattedValue}</span>
        </div>
      )
    }

    // Otherwise, use ExpandableCell component for automatic truncation/expansion
    return <ExpandableCell value={formattedValue} columnName={columnKey} />
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
    users: ["id", "email", "fname", "lname", "type", "createdAt"],
    friendships: ["user_id1", "user_id2", "status", "createdAt"],
    schedules: ["id", "userId", "name", "createdAt"],
    events: ["id", "scheduleId", "name", "description", "start", "end", "repeated", "repeatUntil", "createdAt"],
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
        <MovingBlob
          size={420}
          speed={46}
          overshoot={220}
          colorClass="bg-primary/16"
          blurClass="blur-3xl"
          className="mix-blend-screen"
        />
        <MovingBlob
          size={360}
          speed={60}
          delay={1300}
          overshoot={180}
          colorClass="bg-secondary/16"
          blurClass="blur-3xl"
          className="mix-blend-screen"
        />
        <MovingBlob
          size={500}
          speed={40}
          delay={2400}
          overshoot={240}
          colorClass="bg-primary/12"
          blurClass="blur-[130px]"
          className="hidden md:block mix-blend-screen"
        />
        <MovingBlob
          size={300}
          speed={70}
          delay={3200}
          overshoot={160}
          colorClass="bg-secondary/18"
          blurClass="blur-[110px]"
          className="mix-blend-screen"
        />
      </div>

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-primary/80">Operations</p>
            <h1 className="mt-1 text-4xl font-semibold text-foreground">Admin Control Center</h1>
            <p className="mt-2 max-w-2xl text-sm text-default-500">
              Monitor and fine-tune every line in the Tempora database with inline editing.
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
              <div className="rounded-3xl border border-default/20 shadow-inner overflow-visible">
                <div className="relative overflow-x-auto overflow-y-visible">
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

