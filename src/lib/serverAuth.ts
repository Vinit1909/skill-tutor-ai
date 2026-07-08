/**
 * Server-side Firebase ID-token verification — no firebase-admin needed.
 *
 * Firebase ID tokens are RS256 JWTs signed by Google's securetoken service.
 * We verify them against Google's public JWKS and check issuer/audience against
 * the Firebase project ID. This means API routes no longer blindly trust the
 * `uid` field in the request body: the caller must present a valid ID token for
 * that uid, or the request is rejected.
 *
 * Client side: every fetch attaches `Authorization: Bearer <idToken>` via
 * getAuthHeaders() (src/lib/clientAuth.ts).
 */

import { createRemoteJWKSet, jwtVerify } from "jose"

// Google's public signing keys for Firebase ID tokens (JWKS format).
// jose caches these in-module and respects cache headers, so the network cost
// amortizes to ~zero across invocations on a warm instance.
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  )
)

export type AuthResult =
  | { ok: true; uid: string }
  | { ok: false; status: number; error: string }

/**
 * Verifies the request's Firebase ID token and (optionally) that it belongs to
 * `expectedUid`. Returns a structured result — never throws.
 *
 * Dev ergonomics: if the project ID env var is missing entirely, verification
 * is skipped with a loud warning in development, but FAILS CLOSED in production.
 */
export async function verifyAuth(
  req: Request,
  expectedUid?: string
): Promise<AuthResult> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID

  if (!projectId) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "⚠️ [auth] NEXT_PUBLIC_FIREBASE_PROJECT_ID not set — skipping token verification (dev only)"
      )
      return { ok: true, uid: expectedUid ?? "" }
    }
    return { ok: false, status: 500, error: "Server auth is not configured" }
  }

  const header = req.headers.get("authorization") ?? ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : null
  if (!token) {
    return { ok: false, status: 401, error: "Missing authentication token" }
  }

  try {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    })

    const uid = typeof payload.sub === "string" ? payload.sub : ""
    if (!uid) {
      return { ok: false, status: 401, error: "Invalid token (no subject)" }
    }
    if (expectedUid && uid !== expectedUid) {
      return { ok: false, status: 403, error: "Token does not match requested user" }
    }
    return { ok: true, uid }
  } catch (err) {
    // Expired, malformed, wrong signature, wrong project — all end here.
    const msg = err instanceof Error ? err.message : "Token verification failed"
    return { ok: false, status: 401, error: `Invalid authentication token: ${msg}` }
  }
}
