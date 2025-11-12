"use client"

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
  SelectItem,
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
      console.log("Fetching admin data from /api/admin/data")
      setLoading(true)
      const response = await fetch("/api/admin/data")
      console.log("Response status:", response.status, response.statusText)
      
      if (response.ok) {
        const result = (await response.json()) as TableData
        console.log("Data received:", result)
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
    console.log("Admin page useEffect - status:", status, "session:", session)
    
    if (status === "unauthenticated") {
      console.log("Unauthenticated, redirecting to login")
      router.push("/login")
      return
    }

    if (status === "authenticated") {
      console.log("Authenticated, checking admin type:", session?.user?.type)
      if (session?.user?.type !== "ADMIN") {
        console.log("Not admin, redirecting to login")
        router.push("/login")
        return
      }
      console.log("Admin confirmed, fetching data...")
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
        <div className="flex gap-2">
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
          />
          <Button size="sm" color="primary" onPress={handleSave}>
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
        displayValue = date instanceof Date && !isNaN(date.getTime()) 
          ? date.toLocaleString() 
          : String(cellValue || "")
      } catch {
        displayValue = String(cellValue || "")
      }
    } else {
      displayValue = String(cellValue ?? "")
    }

    return (
      <span
        onClick={() => handleCellClick(table, rowId, columnKey, cellValue)}
        className={isEditMode ? "cursor-pointer hover:bg-default-100 rounded px-2 py-1" : ""}
      >
        {displayValue}
      </span>
    )
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600">Loading session...</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600">Loading data...</p>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <div className="flex items-center gap-4">
            <EditModeToggle isEditMode={isEditMode} onToggle={setIsEditMode} />
            <LogoutButton />
          </div>
        </div>
        
        <div className="mb-4 text-sm text-gray-600">
          Debug: Status: {status}, Loading: {loading ? "true" : "false"}, Data count: {currentData.length}
        </div>

        <div className="mb-4">
          <Select
            label="Select Table"
            selectedKeys={[activeTable]}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as keyof TableData
              if (selected) {
                setActiveTable(selected)
                setEditingCell(null)
              }
            }}
            className="max-w-xs"
          >
            <SelectItem key="users">Users</SelectItem>
            <SelectItem key="friendships">Friendships</SelectItem>
            <SelectItem key="schedules">Schedules</SelectItem>
            <SelectItem key="events">Events</SelectItem>
          </Select>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold capitalize">{activeTable}</h2>
          </CardHeader>
          <CardBody>
            {currentData.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                No data available for {activeTable}
              </div>
            ) : (
              <Table aria-label={`${activeTable} table`}>
                <TableHeader>
                  {columns.map((column) => (
                    <TableColumn key={column}>{column}</TableColumn>
                  ))}
                </TableHeader>
                <TableBody emptyContent={`No ${activeTable} found`}>
                  {currentData.map((item) => {
                    const rowId =
                      activeTable === "friendships"
                        ? `${item.user_id1 as string}-${item.user_id2 as string}`
                        : (item.id as string) || `${item.user_id1 as string}-${item.user_id2 as string}`
                    return (
                      <TableRow key={rowId}>
                        {columns.map((column) => (
                          <TableCell key={`${rowId}-${column}`}>
                            {renderCell(item, column, activeTable)}
                          </TableCell>
                        ))}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

