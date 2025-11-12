"use client"

import { Switch } from "@heroui/react"

interface EditModeToggleProps {
  isEditMode: boolean
  onToggle: (value: boolean) => void
}

export function EditModeToggle({ isEditMode, onToggle }: EditModeToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">Edit Mode</span>
      <Switch
        isSelected={isEditMode}
        onValueChange={onToggle}
        color="primary"
      />
    </div>
  )
}

