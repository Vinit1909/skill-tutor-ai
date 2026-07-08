"use client"

import React from "react"

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** Short label for what's inside, used in the fallback text. */
  label?: string
}

interface ErrorBoundaryState {
  hasError: boolean
}

/**
 * Catches render-time crashes in a subtree so one bad artifact (malformed chart
 * JSON, a renderer edge case, model-generated garbage) degrades to a small
 * inline notice instead of unmounting the entire chat. LLM output is untrusted
 * input — every renderer that consumes it sits behind one of these.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.label ?? "content"}]`, error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="my-2 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/15 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          This {this.props.label ?? "content"} couldn&apos;t be displayed. The rest of the
          conversation is unaffected.
        </div>
      )
    }
    return this.props.children
  }
}
