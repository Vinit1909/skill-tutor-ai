"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface DockProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: "top" | "bottom" | "left" | "right" | "middle" | "topRight" | "topCenter"
}

/**
 * A "floating" Dock component that can pin to edges with flex layout.
 */
export function Dock({
  direction = "bottom",
  className,
  children,
  ...props
}: DockProps) {
  let directionClasses = ""

  switch (direction) {
    case "top":
      // pinned top left-to-right, 
      // but no longer full width. 
      // For minimal changes, let's do center. 
      directionClasses = "top-4 left-1/2 transform -translate-x-1/2"
      break
    case "topRight":
      directionClasses = "top-4 right-20"
      break
    case "bottom":
      directionClasses = "bottom-4 inset-x-4"
      break
    case "left":
      directionClasses = "left-4 inset-y-4 flex-col"
      break
    case "right":
      directionClasses = "right-4 inset-y-4 flex-col"
      break
    case "middle":
      directionClasses = "inset-x-4 bottom-4 justify-center"
      break
    // etc. default or any fallback
    default:
      directionClasses = "bottom-4 inset-x-4"
  }

  return (
    <div
      className={cn(
        "fixed flex gap-4 p-2 backdrop-blur-2xl rounded-2xl shadow-md z-50 border dark:border-neutral-700 dark:bg-[hsl(0,0%,18%)]",
        directionClasses,
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * A single dock icon container that grows or animates on hover.
 */
export function DockIcon({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center transition-all duration-300 ease-in-out hover:scale-110",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}