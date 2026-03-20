"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"

interface InlineEditProps {
  value: string
  onSave: (newValue: string) => Promise<void> | void
  className?: string
  inputClassName?: string
  /** Element to render the display text in (default: "span") */
  as?: "span" | "h1" | "h2" | "h3" | "p"
  placeholder?: string
  disabled?: boolean
}

/**
 * Reusable inline-edit component.
 * Click once to activate editing; press Enter or blur to save; Escape to cancel.
 */
export function InlineEdit({
  value,
  onSave,
  className,
  inputClassName,
  as: Tag = "span",
  placeholder = "Click to edit",
  disabled = false,
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep draft in sync with external value changes
  useEffect(() => {
    if (!isEditing) setDraft(value)
  }, [value, isEditing])

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleActivate = useCallback(() => {
    if (disabled) return
    setDraft(value)
    setIsEditing(true)
  }, [disabled, value])

  const handleSave = useCallback(async () => {
    const trimmed = draft.trim()
    if (!trimmed || trimmed === value) {
      setIsEditing(false)
      setDraft(value)
      return
    }
    setIsSaving(true)
    try {
      await onSave(trimmed)
    } catch (err) {
      console.error("InlineEdit save failed:", err)
      setDraft(value) // Revert on failure
    } finally {
      setIsSaving(false)
      setIsEditing(false)
    }
  }, [draft, value, onSave])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSave()
    } else if (e.key === "Escape") {
      setIsEditing(false)
      setDraft(value)
    }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        disabled={isSaving}
        className={cn(
          "bg-transparent border-b border-neutral-400 dark:border-neutral-500 outline-none",
          "focus:border-primary dark:focus:border-primary",
          "text-inherit font-inherit leading-inherit",
          "min-w-[60px] max-w-full",
          isSaving && "opacity-50 cursor-not-allowed",
          inputClassName
        )}
        style={{ width: `${Math.max(draft.length, 4)}ch` }}
      />
    )
  }

  return (
    <Tag
      onClick={handleActivate}
      title={disabled ? undefined : "Click to rename"}
      className={cn(
        !disabled && "cursor-pointer hover:underline hover:decoration-dashed hover:underline-offset-2",
        "transition-all duration-150",
        className
      )}
    >
      {value || <span className="text-muted-foreground italic">{placeholder}</span>}
    </Tag>
  )
}
