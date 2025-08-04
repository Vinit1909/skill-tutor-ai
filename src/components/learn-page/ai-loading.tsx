// import React from "react"
// import { Orbit } from "lucide-react"

// const LoadingBubble = () => {
//   return (
//     <div className="flex items-center w-full rounded-xl gap-4">
//       <div className="relative flex-shrink-0 mr-2 mt-2">
//         <Orbit
//           className="h-8 w-8 rounded-full p-1 border border-neutral-300 dark:border-neutral-600 text-[#6c63ff] dark:text-[#7a83ff] animate-[spin_3s_linear_infinite]"
//         />
//         <span className="absolute inset-0 rounded-full border border-[#6c63ff]/50 dark:border-[#7a83ff]/50 animate-[pulse-ring_1.5s_ease-in-out_infinite]"></span>
//         <span className="absolute inset-0 rounded-full border border-[#6c63ff]/30 dark:border-[#7a83ff]/30 animate-[ripple_2s_ease-out_infinite] [animation-delay:-0.5s]"></span>
//       </div>
//     </div>
//   )
// }

// export default LoadingBubble


"use client"

import { useEffect, useState } from "react"
import { Orbit } from "lucide-react"

const quickMessages = [
  "Thinking...",
  "Processing...",
  "Almost ready..."
]

const normalMessages = [
  "Processing your request...",
  "Crafting a thoughtful response...",
  "Analyzing your question...",
  "Generating response..."
]

const slowMessages = [
  "This is taking longer than usual...",
  "Working on a detailed response...",
  "Processing complex request...",
  "Finding the best answer..."
]

const switchingMessages = [
  "Switching to backup AI...",
  "Finding the optimal AI model...", 
  "Ensuring best response quality..."
]

export default function LoadingBubble() {
  const [messageIndex, setMessageIndex] = useState(0)
  const [phase, setPhase] = useState<'quick' | 'normal' | 'slow' | 'switching'>('quick')
  
  useEffect(() => {
    // Quick phase: 0-3 seconds
    const quickTimer = setTimeout(() => setPhase('normal'), 3000)
    
    // Normal phase: 3-8 seconds  
    const normalTimer = setTimeout(() => setPhase('slow'), 8000)
    
    // Slow phase: 8-15 seconds
    const slowTimer = setTimeout(() => setPhase('switching'), 15000)

    return () => {
      clearTimeout(quickTimer)
      clearTimeout(normalTimer) 
      clearTimeout(slowTimer)
    }
  }, [])

  const getMessages = () => {
    switch (phase) {
      case 'quick': return quickMessages
      case 'normal': return normalMessages
      case 'slow': return slowMessages
      case 'switching': return switchingMessages
      default: return normalMessages
    }
  }

  const messages = getMessages()

  useEffect(() => {
    setMessageIndex(0) // Reset to first message when phase changes
  }, [phase])

  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length)
    }, phase === 'quick' ? 1500 : phase === 'switching' ? 3000 : 2000)

    return () => {
      clearInterval(messageInterval)
    }
  }, [messages.length, phase])

  const getTextColor = () => {
    switch (phase) {
      case 'quick': return 'text-neutral-500 dark:text-neutral-400'
      case 'normal': return 'text-neutral-500 dark:text-neutral-400'
      case 'slow': return 'text-orange-500 dark:text-orange-400'
      case 'switching': return 'text-blue-600 dark:text-blue-400'
      default: return 'text-neutral-500 dark:text-neutral-400'
    }
  }

  const getAnimation = () => {
    return phase === 'switching' ? 'animate-bounce' : 'animate-spin'
  }

  return (
    <div className="flex items-start w-full rounded-xl gap-4">
      <Orbit 
        className={`flex-shrink-0 mr-2 mt-2 h-8 w-8 rounded-full p-1 overflow-visible border border-neutral-300 dark:border-neutral-600 text-[#6c63ff] dark:text-[#7a83ff] ${getAnimation()}`} 
      />
      <div className="flex flex-col mb-4 w-full">
        <div className={`flex-1 pt-3 text-sm italic ${getTextColor()}`}>
          {messages[messageIndex]}
        </div>
      </div>
    </div>
  )
}