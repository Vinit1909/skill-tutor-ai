"use client"

import Link from "next/link"
import { Orbit } from "lucide-react"

interface AppHeaderProps {
  /** Right-side actions (buttons, profile badge, etc.) */
  children?: React.ReactNode
}

/**
 * The app's shared top bar: sticky translucent header with the SkillSpace
 * logo on the left (clickable — navigates home; signed-in users are routed
 * on to their dashboard by the home page) and page actions on the right.
 */
export default function AppHeader({ children }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 bg-white/20 dark:bg-neutral-800/70 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-700">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link
          href="/"
          aria-label="SkillSpace — home"
          className="flex items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:focus-visible:ring-neutral-600"
        >
          <Orbit className="h-6 w-6 text-[#6c63ff] dark:text-[#7a83ff]" />
          <h2 className="hidden sm:block text-xl font-semibold text-neutral-700 dark:text-neutral-300">
            SkillSpace
          </h2>
        </Link>

        <div className="flex items-center gap-3">{children}</div>
      </div>
    </header>
  )
}
