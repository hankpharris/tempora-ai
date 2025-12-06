"use client"

import { useState } from "react"
import { Button } from "@heroui/react"
import { ManageFriendshipsModal } from "./ManageFriendshipsModal"
import { twMerge } from "tailwind-merge"

interface ManageFriendshipsButtonProps {
  className?: string
}

export function ManageFriendshipsButton({ className }: ManageFriendshipsButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button 
        onPress={() => setIsOpen(true)} 
        color="primary" 
        variant="flat"
        size="sm"
        className={twMerge("font-medium", className)}
      >
        Manage Friendships
      </Button>
      <ManageFriendshipsModal isOpen={isOpen} onOpenChange={setIsOpen} />
    </>
  )
}
