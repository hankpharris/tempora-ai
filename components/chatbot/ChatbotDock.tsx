"use client"

import { AnimatePresence, motion } from "framer-motion"
import { useSession } from "next-auth/react"
import { useCallback, useEffect, useRef, useState } from "react"

type ChatRole = "assistant" | "user" | "system"

type ImageContentPart = {
  type: "image_url"
  image_url: { url: string }
}

type TextContentPart = {
  type: "text"
  text: string
}

type ContentPart = TextContentPart | ImageContentPart

type ChatMessage = {
  id: string
  role: ChatRole
  content: string | ContentPart[]
}

type AttachedImage = {
  id: string
  dataUrl: string
  name: string
}

const INITIAL_ASSISTANT_MESSAGE: ChatMessage = {
  id: "assistant-intro",
  role: "assistant",
  content:
    "Hi! I'm the Tempora copilot. Ask me to inspect schedules, create events, or move things around.",
}

const makeMessageId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

const roleLabel = (role: ChatRole) => {
  if (role === "assistant") return "Tempora AI"
  if (role === "user") return "You"
  return "System"
}

function MessageContent({ content }: { content: string | ContentPart[] }) {
  if (typeof content === "string") {
    return <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
  }

  return (
    <div className="space-y-2">
      {content.map((part, index) => {
        if (part.type === "text") {
          return (
            <p key={index} className="whitespace-pre-wrap text-sm leading-relaxed">
              {part.text}
            </p>
          )
        }
        if (part.type === "image_url") {
          return (
            <img
              key={index}
              src={part.image_url.url}
              alt="Attached image"
              className="max-h-48 rounded-lg border border-default/20"
            />
          )
        }
        return null
      })}
    </div>
  )
}

export function ChatbotDock() {
  const { data: session, status } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_ASSISTANT_MESSAGE])
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([])
  const endRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const isAuthenticated = Boolean(session?.user?.id)
  const sessionLoading = status === "loading"

  useEffect(() => {
    if (isOpen) {
      endRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isOpen])

  const togglePanel = useCallback(() => {
    setIsOpen((prev) => !prev)
    setError(null)
  }, [])

  const handleReset = useCallback(() => {
    setMessages([INITIAL_ASSISTANT_MESSAGE])
    setAttachedImages([])
    setError(null)
  }, [])

  const handleImageSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files?.length) return

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        setError("Only image files are supported.")
        return
      }

      if (file.size > 10 * 1024 * 1024) {
        setError("Images must be under 10MB.")
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        setAttachedImages((prev) => [
          ...prev,
          {
            id: makeMessageId("img"),
            dataUrl,
            name: file.name,
          },
        ])
      }
      reader.readAsDataURL(file)
    })

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  const removeImage = useCallback((imageId: string) => {
    setAttachedImages((prev) => prev.filter((img) => img.id !== imageId))
  }, [])

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim()
    const hasImages = attachedImages.length > 0
    
    if ((!trimmed && !hasImages) || isSending) {
      return
    }

    if (!isAuthenticated) {
      setError("Sign in to let Tempora Copilot work with your schedules.")
      return
    }

    let messageContent: string | ContentPart[]
    
    if (hasImages) {
      const contentParts: ContentPart[] = []
      
      if (trimmed) {
        contentParts.push({ type: "text", text: trimmed })
      }
      
      attachedImages.forEach((img) => {
        contentParts.push({
          type: "image_url",
          image_url: { url: img.dataUrl },
        })
      })
      
      messageContent = contentParts
    } else {
      messageContent = trimmed
    }

    const userMessage: ChatMessage = {
      id: makeMessageId("user"),
      role: "user",
      content: messageContent,
    }
    const nextMessages = [...messages, userMessage]

    setMessages(nextMessages)
    setInput("")
    setAttachedImages([])
    setIsSending(true)
    setError(null)

    try {
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        }),
      })

      const payload = (await response.json().catch(() => null)) as
        | { message?: { role: ChatRole; content: string }; error?: string }
        | null

      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "The assistant could not respond right now.")
      }

      if (!payload.message?.content) {
        throw new Error("The assistant returned an empty response.")
      }

      const assistantMessage: ChatMessage = {
        id: makeMessageId("assistant"),
        role: "assistant",
        content: payload.message.content,
      }

      setMessages((current) => [...current, assistantMessage])
    } catch (err) {
      const fallback =
        err instanceof Error ? err.message : "Something went wrong while contacting the assistant."
      setError(fallback)
    } finally {
      setIsSending(false)
    }
  }, [input, isSending, isAuthenticated, messages, attachedImages])

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      await sendMessage()
    },
    [sendMessage],
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault()
        void sendMessage()
      }
    },
    [sendMessage],
  )

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {isOpen ? (
          <>
            <motion.div
              key="chatbot-overlay"
              className="pointer-events-auto fixed inset-0 z-40 bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={togglePanel}
            />
            <motion.aside
              key="chatbot-panel"
              className="pointer-events-auto fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-default/20 bg-background/95 shadow-2xl backdrop-blur"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 260, damping: 32 }}
            >
              <header className="flex items-start justify-between gap-3 border-b border-default/15 px-5 py-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-primary/70">Tempora Copilot</p>
                  <p className="text-sm text-default-600">
                    Powered by gpt-5 mini (low reasoning) plus LangChain calendar tools.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={togglePanel}
                  className="rounded-full border border-default/30 px-3 py-1 text-xs font-medium text-default-700 transition hover:bg-default-100/60"
                >
                  Close
                </button>
              </header>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                <div className="space-y-4 text-sm">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-2xl border px-4 py-3 ${
                        message.role === "assistant"
                          ? "border-primary/40 bg-primary/10 text-foreground"
                          : message.role === "user"
                            ? "border-default/30 bg-default-100 text-foreground"
                            : "border-secondary/40 bg-secondary/10 text-foreground"
                      }`}
                    >
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-default-500">
                        {roleLabel(message.role)}
                      </p>
                      <MessageContent content={message.content} />
                    </div>
                  ))}
                  <div ref={endRef} />
                </div>
              </div>

              <div className="space-y-3 border-t border-default/15 px-5 py-4">
                {sessionLoading ? (
                  <p className="text-xs text-default-500">Checking your session...</p>
                ) : null}
                {error ? (
                  <div className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                    {error}
                  </div>
                ) : null}
                {!isAuthenticated && !sessionLoading ? (
                  <p className="text-xs text-default-500">
                    Sign in to let the assistant inspect and update your schedules securely.
                  </p>
                ) : null}
                <form className="space-y-3" onSubmit={handleSubmit}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageSelect}
                    disabled={!isAuthenticated || sessionLoading}
                  />
                  
                  {attachedImages.length > 0 && (
                    <div className="flex flex-wrap gap-2 rounded-xl border border-default/20 bg-default-50/50 p-2">
                      {attachedImages.map((img) => (
                        <div key={img.id} className="group relative">
                          <img
                            src={img.dataUrl}
                            alt={img.name}
                            className="h-16 w-16 rounded-lg object-cover border border-default/30"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(img.id)}
                            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] text-white opacity-0 shadow transition group-hover:opacity-100"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <textarea
                    className="h-24 w-full rounded-2xl border border-default/30 bg-background px-3 py-2 text-sm text-foreground shadow-inner outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-60"
                    placeholder={
                      isAuthenticated
                        ? "Ask about your events, request a summary, or attach an image..."
                        : "Sign in to start chatting."
                    }
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!isAuthenticated || sessionLoading}
                  />
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleReset}
                        disabled={messages.length <= 1}
                        className="rounded-full border border-default/30 px-3 py-1 font-medium text-default-600 transition hover:bg-default-100/70 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!isAuthenticated || isSending || sessionLoading}
                        className="rounded-full border border-default/30 px-3 py-1 font-medium text-default-600 transition hover:bg-default-100/70 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Attach image"
                      >
                        📷 Image
                      </button>
                    </div>
                    <button
                      type="submit"
                      disabled={
                        !isAuthenticated || isSending || (input.trim().length === 0 && attachedImages.length === 0) || sessionLoading
                      }
                      className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSending ? "Thinking..." : "Send"}
                    </button>
                  </div>
                </form>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <button
        type="button"
        aria-expanded={isOpen}
        onClick={togglePanel}
        className="pointer-events-auto flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/70"
      >
        {isOpen ? "Hide copilot" : "Ask Tempora"}
      </button>
    </div>
  )
}


