"use client"

import { cn } from "@heroui/react"
import { useEffect, useRef } from "react"

type MovingBlobProps = {
  size: number
  colorClass: string
  blurClass?: string
  speed?: number
  delay?: number
  overshoot?: number
  className?: string
}

export function MovingBlob({
  size,
  colorClass,
  blurClass,
  speed = 60,
  delay = 0,
  overshoot,
  className,
}: MovingBlobProps) {
  const blobRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = blobRef.current
    if (!node) return
    if (typeof window === "undefined") return

    node.style.width = `${size}px`
    node.style.height = `${size}px`
    node.style.transform = "translate3d(0, 0, 0)"

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const padding = overshoot ?? size * 0.35

    const bounds = { width: window.innerWidth, height: window.innerHeight }

    const updateBounds = () => {
      bounds.width = window.innerWidth
      bounds.height = window.innerHeight
    }

    const pickInitial = (dimension: number) => {
      const min = -padding
      const max = dimension - size + padding
      return min + Math.random() * (max - min)
    }

    const ensureVelocity = (value: number) => {
      const minVelocity = speed * 0.35
      if (Math.abs(value) < minVelocity) {
        const direction = value === 0 ? (Math.random() > 0.5 ? 1 : -1) : Math.sign(value)
        return direction * minVelocity
      }
      return value
    }

    const randomVelocity = () => {
      const variance = speed * 0.6
      return ensureVelocity((Math.random() * 2 - 1) * variance)
    }

    const position = {
      x: pickInitial(bounds.width),
      y: pickInitial(bounds.height),
    }

    const velocity = {
      x: randomVelocity(),
      y: randomVelocity(),
    }

    const applyTransform = () => {
      node.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`
    }

    applyTransform()

    if (reduceMotion.matches) {
      window.addEventListener("resize", updateBounds)
      return () => {
        window.removeEventListener("resize", updateBounds)
      }
    }

    let frameId: number
    let startTime: number | null = null
    let lastTime: number | null = null
    const delayMs = Math.max(0, delay)

    const animate = (time: number) => {
      if (startTime === null) startTime = time
      if (time - startTime < delayMs) {
        frameId = requestAnimationFrame(animate)
        return
      }

      if (lastTime === null) lastTime = time
      const delta = (time - lastTime) / 1000
      lastTime = time

      position.x += velocity.x * delta
      position.y += velocity.y * delta

      const minX = -padding
      const maxX = bounds.width - size + padding
      const minY = -padding
      const maxY = bounds.height - size + padding

      if (position.x <= minX && velocity.x < 0) {
        position.x = minX
        velocity.x *= -1
      } else if (position.x >= maxX && velocity.x > 0) {
        position.x = maxX
        velocity.x *= -1
      }

      if (position.y <= minY && velocity.y < 0) {
        position.y = minY
        velocity.y *= -1
      } else if (position.y >= maxY && velocity.y > 0) {
        position.y = maxY
        velocity.y *= -1
      }

      applyTransform()
      frameId = requestAnimationFrame(animate)
    }

    frameId = requestAnimationFrame(animate)
    window.addEventListener("resize", updateBounds)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener("resize", updateBounds)
    }
  }, [delay, overshoot, size, speed])

  return (
    <div
      ref={blobRef}
      className={cn("pointer-events-none absolute will-change-transform", className)}
      aria-hidden
    >
      <div className={cn("h-full w-full rounded-full", colorClass, blurClass)} />
    </div>
  )
}

