"use client"

import { Button, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spinner, Tab, Tabs, User as UserAvatar } from "@heroui/react"
import { useSession } from "next-auth/react"
import { useCallback, useEffect, useState } from "react"

type FriendshipStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "BLOCKED" | "NONE"

interface User {
  id: string
  fname: string | null
  lname: string | null
  email: string
  image: string | null
  friendshipStatus?: FriendshipStatus
  friendshipSenderId?: string
}

interface Friendship {
  user_id1: string
  user_id2: string
  status: FriendshipStatus
  user1: User // The sender
}

interface ManageFriendshipsModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function ManageFriendshipsModal({ isOpen, onOpenChange }: ManageFriendshipsModalProps) {
  const { data: session } = useSession()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [pendingRequests, setPendingRequests] = useState<Friendship[]>([])
  const [isLoadingRequests, setIsLoadingRequests] = useState(false)
  const [friendsList, setFriendsList] = useState<User[]>([])
  const [isLoadingFriends, setIsLoadingFriends] = useState(false)
  
  // Fetch pending requests
  const fetchPendingRequests = useCallback(async () => {
    try {
      setIsLoadingRequests(true)
      const res = await fetch("/api/friends/pending")
      if (res.ok) {
        const data = (await res.json()) as Friendship[]
        setPendingRequests(data)
      }
    } catch (error) {
      console.error("Failed to fetch pending requests", error)
    } finally {
      setIsLoadingRequests(false)
    }
  }, [])

  // Fetch friends list
  const fetchFriendsList = useCallback(async () => {
    try {
      setIsLoadingFriends(true)
      const res = await fetch("/api/friends/list")
      if (res.ok) {
        const data = (await res.json()) as User[]
        setFriendsList(data)
      }
    } catch (error) {
      console.error("Failed to fetch friends list", error)
    } finally {
      setIsLoadingFriends(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchPendingRequests()
      fetchFriendsList()
    }
  }, [isOpen, fetchPendingRequests, fetchFriendsList])

  // Search users
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length < 2) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      try {
        const res = await fetch(`/api/friends/search?query=${encodeURIComponent(searchQuery)}`)
        if (res.ok) {
          const data = (await res.json()) as User[]
          setSearchResults(data)
        }
      } catch (error) {
        console.error("Search failed", error)
      } finally {
        setIsSearching(false)
      }
    }, 500)

    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery])

  const sendFriendRequest = async (targetUserId: string) => {
    try {
      const res = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      })

      if (res.ok) {
        // Update local state to show pending
        setSearchResults((prev) =>
          prev.map((user) =>
            user.id === targetUserId
              ? { ...user, friendshipStatus: "PENDING", friendshipSenderId: session?.user?.id }
              : user
          )
        )
      }
    } catch (error) {
      console.error("Failed to send friend request", error)
    }
  }

  const respondToRequest = async (requesterId: string, action: "ACCEPT" | "DECLINE") => {
    try {
      const res = await fetch("/api/friends/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId, action }),
      })

      if (res.ok) {
        // Remove from list
        setPendingRequests((prev) => prev.filter((req) => req.user1.id !== requesterId))
        // If searching, update that too if visible
        setSearchResults((prev) =>
            prev.map((user) =>
              user.id === requesterId
                ? { ...user, friendshipStatus: action === "ACCEPT" ? "ACCEPTED" : "NONE" }
                : user
            )
          )
        // Refresh friends list if accepted
        if (action === "ACCEPT") {
            fetchFriendsList()
        }
      }
    } catch (error) {
      console.error("Failed to respond to friend request", error)
    }
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onOpenChange={onOpenChange}
      size="2xl"
      scrollBehavior="inside"
      backdrop="blur"
      className="dark:bg-content1 rounded-3xl"
      placement="center"
    >
      <ModalContent className="bg-white dark:bg-content1 border border-default-200 shadow-xl rounded-3xl">
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 border-b border-default-100">Manage Friendships</ModalHeader>
            <ModalBody className="p-6">
              <Tabs aria-label="Friendship options" color="primary" variant="underlined">
                <Tab key="friends" title="Friends List">
                  <div className="flex flex-col gap-3 py-4 min-h-[200px]">
                    {isLoadingFriends ? (
                        <div className="flex justify-center py-4">
                          <Spinner />
                        </div>
                    ) : friendsList.length > 0 ? (
                      friendsList.map((friend) => (
                        <div key={friend.id} className="flex items-center justify-between p-3 rounded-lg border border-default-200 hover:bg-default-100 transition-colors">
                           <UserAvatar
                              name={`${friend.fname || ""} ${friend.lname || ""}`.trim() || friend.email}
                              description={friend.email}
                              avatarProps={{
                                src: friend.image || undefined
                              }}
                            />
                            <Chip color="success" variant="flat" size="sm">Friend</Chip>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-default-500 py-4">You have no friends yet. Use the &apos;Add Friend&apos; tab to search!</div>
                    )}
                  </div>
                </Tab>
                <Tab key="add" title="Add Friend">
                  <div className="flex flex-col gap-4 py-4">
                    <Input
                      aria-label="Search Users"
                      placeholder="Search by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      variant="bordered"
                      classNames={{
                        inputWrapper: "bg-default-100",
                      }}
                      startContent={
                        <svg
                          aria-hidden="true"
                          fill="none"
                          focusable="false"
                          height="1em"
                          role="presentation"
                          viewBox="0 0 24 24"
                          width="1em"
                          className="text-2xl text-default-400 pointer-events-none flex-shrink-0"
                        >
                          <path
                            d="M11.5 21C16.7467 21 21 16.7467 21 11.5C21 6.25329 16.7467 2 11.5 2C6.25329 2 2 6.25329 2 11.5C2 16.7467 6.25329 21 11.5 21Z"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                          />
                          <path
                            d="M22 22L20 20"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                          />
                        </svg>
                      }
                    />
                    
                    <div className="flex flex-col gap-3 min-h-[200px]">
                      {isSearching ? (
                        <div className="flex justify-center py-4">
                          <Spinner />
                        </div>
                      ) : searchResults.length > 0 ? (
                        searchResults.map((user) => (
                          <div key={user.id} className="flex items-center justify-between p-3 rounded-lg border border-default-200 hover:bg-default-100 transition-colors">
                            <UserAvatar
                              name={`${user.fname || ""} ${user.lname || ""}`.trim() || user.email}
                              description={user.email}
                              avatarProps={{
                                src: user.image || undefined
                              }}
                            />
                            {user.friendshipStatus === "ACCEPTED" ? (
                              <Chip color="success" variant="flat" size="sm">Friends</Chip>
                            ) : user.friendshipStatus === "PENDING" ? (
                                user.friendshipSenderId === session?.user?.id ? (
                                    <Chip color="warning" variant="flat" size="sm">Sent</Chip>
                                ) : (
                                    <div className="flex gap-2">
                                        <Button size="sm" color="primary" onPress={() => respondToRequest(user.id, "ACCEPT")}>Accept</Button>
                                    </div>
                                )
                            ) : (
                              <Button 
                                size="sm" 
                                color="primary" 
                                variant="flat"
                                onPress={() => sendFriendRequest(user.id)}
                              >
                                Add Friend
                              </Button>
                            )}
                          </div>
                        ))
                      ) : searchQuery.length >= 2 ? (
                        <div className="text-center text-default-500 py-4">No users found</div>
                      ) : (
                        <div className="text-center text-default-500 py-4">Type to search for friends</div>
                      )}
                    </div>
                  </div>
                </Tab>
                <Tab 
                    key="requests" 
                    title={
                        <div className="flex items-center space-x-2">
                            <span>Pending Requests</span>
                            {pendingRequests.length > 0 && (
                                <Chip size="sm" color="danger" variant="solid">{pendingRequests.length}</Chip>
                            )}
                        </div>
                    }
                >
                  <div className="flex flex-col gap-3 py-4 min-h-[200px]">
                    {isLoadingRequests ? (
                        <div className="flex justify-center py-4">
                          <Spinner />
                        </div>
                    ) : pendingRequests.length > 0 ? (
                      pendingRequests.map((req) => (
                        <div key={req.user1.id} className="flex items-center justify-between p-3 rounded-lg border border-default-200">
                           <UserAvatar
                              name={`${req.user1.fname || ""} ${req.user1.lname || ""}`.trim() || req.user1.email}
                              description={req.user1.email}
                              avatarProps={{
                                src: req.user1.image || undefined
                              }}
                            />
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              color="primary" 
                              onPress={() => respondToRequest(req.user1.id, "ACCEPT")}
                            >
                              Accept
                            </Button>
                            <Button 
                              size="sm" 
                              color="danger" 
                              variant="light"
                              onPress={() => respondToRequest(req.user1.id, "DECLINE")}
                            >
                              Decline
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-default-500 py-4">No pending requests</div>
                    )}
                  </div>
                </Tab>
              </Tabs>
            </ModalBody>
            <ModalFooter className="border-t border-default-100">
              <Button color="danger" variant="light" onPress={onClose}>
                Close
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
