/**
 * Client-side helper: attach the current user's Firebase ID token to API calls.
 *
 * getIdToken() returns the cached token and transparently refreshes it when it
 * is within 5 minutes of expiry — so calling this per-request is cheap and
 * always yields a valid token for the server to verify (src/lib/serverAuth.ts).
 */

import { auth } from "./firebase"

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser
  if (!user) return {}
  try {
    const token = await user.getIdToken()
    return { Authorization: `Bearer ${token}` }
  } catch (err) {
    console.error("[auth] Failed to get ID token:", err)
    return {}
  }
}
