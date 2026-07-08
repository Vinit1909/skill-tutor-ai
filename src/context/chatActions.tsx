"use client"

import { createContext, useContext } from "react"

/**
 * Lets deeply-nested artifacts (e.g. the code-exercise sandbox) send a message
 * back into the chat — so the tutor can review the learner's code and results.
 * The chat component provides the implementation; artifacts consume it.
 */
export interface ChatActions {
  sendUserMessage: (text: string) => void
}

const ChatActionsContext = createContext<ChatActions | null>(null)

export const ChatActionsProvider = ChatActionsContext.Provider

export function useChatActions(): ChatActions | null {
  return useContext(ChatActionsContext)
}
