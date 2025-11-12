"use client"

import { cn, Switch } from "@heroui/react"

interface EditModeToggleProps {
  isEditMode: boolean
  onToggle: (value: boolean) => void
}

export function EditModeToggle({ isEditMode, onToggle }: EditModeToggleProps) {
  return (
    <Switch
      isSelected={isEditMode}
      onValueChange={onToggle}
      aria-label="Toggle edit mode"
      classNames={{
        base: cn(
          "group inline-flex w-full max-w-xs items-center justify-between gap-3 rounded-xl border border-primary/15",
          "bg-content1/80 px-4 py-3 shadow-sm transition-all hover:bg-content2/80",
          "data-[selected=true]:border-primary/50 data-[selected=true]:bg-primary/15"
        ),
        wrapper: "h-5 w-11 shrink-0 overflow-visible rounded-full bg-default-200/80 p-0 transition-all data-[selected=true]:bg-primary",
        thumb: cn(
          "pointer-events-auto h-5 w-5 rounded-full border-2 border-transparent bg-background shadow transition-all",
          "group-data-[hover=true]:border-primary/40",
          "group-data-[selected=true]:ms-5",
          "group-data-[pressed=true]:w-6 group-data-[pressed=true]:border-primary/50"
        ),
        label: "flex flex-col gap-1 text-left text-sm font-medium text-foreground",
        hiddenInput: "hidden",
        thumbIcon: "hidden",
      }}
      startContent={null}
      endContent={null}
      thumbIcon={null}
    >
      <span>Edit mode</span>
      <span className="text-[11px] uppercase tracking-[0.25em] text-default-500">Inline editing</span>
    </Switch>
  )
}

