import React from "react"
import { Orbit } from "lucide-react"

const LoadingBubble = () => {
  return (
    <div className="flex items-center w-full rounded-xl gap-4">
      <div className="relative flex-shrink-0 mr-2 mt-2">
        <Orbit
          className="h-8 w-8 rounded-full p-1 border border-neutral-300 dark:border-neutral-600 text-[#6c63ff] dark:text-[#7a83ff] animate-[spin_3s_linear_infinite]"
        />
        <span className="absolute inset-0 rounded-full border border-[#6c63ff]/50 dark:border-[#7a83ff]/50 animate-[pulse-ring_1.5s_ease-in-out_infinite]"></span>
        <span className="absolute inset-0 rounded-full border border-[#6c63ff]/30 dark:border-[#7a83ff]/30 animate-[ripple_2s_ease-out_infinite] [animation-delay:-0.5s]"></span>
      </div>
    </div>
  )
}

export default LoadingBubble