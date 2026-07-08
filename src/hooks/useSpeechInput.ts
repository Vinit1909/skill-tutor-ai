/**
 * Web Speech API voice input hook.
 *
 * Uses SpeechRecognition (Chrome, Edge, Safari) to transcribe speech to text.
 * Returns isSupported=false in Firefox and non-secure contexts (button hidden).
 * No cost, no backend — entirely browser-native.
 */

"use client"

import { useState, useRef, useCallback, useEffect } from "react"

// Type declaration for the cross-browser SpeechRecognition API
interface SpeechRecognitionEvent {
  results: { [index: number]: { [index: number]: { transcript: string } } }
}

interface SpeechRecognitionErrorEvent {
  error: string
}

interface SpeechRecognitionInstance {
  lang: string
  continuous: boolean
  interimResults: boolean
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition as SpeechRecognitionConstructor) ||
    (w.webkitSpeechRecognition as SpeechRecognitionConstructor) ||
    null
}

export interface UseSpeechInputReturn {
  isListening: boolean
  transcript: string
  start: () => void
  stop: () => void
  /** False in Firefox, non-browser environments, or insecure contexts */
  isSupported: boolean
}

export function useSpeechInput(
  onTranscript?: (text: string) => void
): UseSpeechInputReturn {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState("")
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const SpeechRecognitionAPI = getSpeechRecognition()
  const isSupported = !!SpeechRecognitionAPI

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  const start = useCallback(() => {
    const API = getSpeechRecognition()
    if (!API || isListening) return

    const recognition = new API()
    recognition.lang = "en-US"
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => {
      setIsListening(true)
      setTranscript("")
    }

    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript ?? ""
      setTranscript(text)
      onTranscript?.(text)
    }

    recognition.onerror = (event) => {
      console.error("[speech] error:", event.error)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [isListening, onTranscript])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  return { isListening, transcript, start, stop, isSupported }
}
