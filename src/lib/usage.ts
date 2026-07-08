/**
 * Usage metering + rate limiting (v1: in-memory, per-instance).
 *
 * HONEST LIMITATION: state lives in module scope, so on serverless each warm
 * instance tracks independently — caps are approximate under horizontal scale.
 * That is still real protection against runaway loops and a single abusive
 * client, and the logging gives cost visibility immediately. When billing
 * arrives, swap the store for Firestore-via-admin-SDK or Redis behind the same
 * two functions (the call sites won't change).
 */

interface Window {
  count: number
  resetAt: number
}

interface DailyUsage {
  requests: number
  promptTokens: number
  completionTokens: number
  day: string
}

const _rate = new Map<string, Window>()
const _daily = new Map<string, DailyUsage>()

const WINDOW_MS = 60_000
/** Max AI requests per uid per minute — generous for a human, hostile to a loop. */
const MAX_REQUESTS_PER_WINDOW = 20

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Sliding-window rate check. Returns null when allowed, or an error message
 * when the caller should receive a 429.
 */
export function checkRateLimit(uid: string): string | null {
  const now = Date.now()
  const w = _rate.get(uid)
  if (!w || now >= w.resetAt) {
    _rate.set(uid, { count: 1, resetAt: now + WINDOW_MS })
    return null
  }
  w.count++
  if (w.count > MAX_REQUESTS_PER_WINDOW) {
    const wait = Math.ceil((w.resetAt - now) / 1000)
    return `Rate limit reached. Please wait ~${wait}s before sending more requests.`
  }
  return null
}

/**
 * Records token usage for a uid (harvested from the stream's finish part) and
 * logs a structured line — the foundation for billing/caps later.
 */
export function recordUsage(
  uid: string,
  usage: { promptTokens?: number; completionTokens?: number }
): void {
  const day = today()
  let u = _daily.get(uid)
  if (!u || u.day !== day) {
    u = { requests: 0, promptTokens: 0, completionTokens: 0, day }
    _daily.set(uid, u)
  }
  u.requests++
  u.promptTokens += usage.promptTokens ?? 0
  u.completionTokens += usage.completionTokens ?? 0

  console.log(
    `📊 [usage] uid=${uid} day=${day} req=${u.requests} ` +
      `inTok=${u.promptTokens} outTok=${u.completionTokens} ` +
      `(+${usage.promptTokens ?? 0}/+${usage.completionTokens ?? 0})`
  )
}
