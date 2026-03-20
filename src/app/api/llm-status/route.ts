/**
 * Simple provider status endpoint — lists which providers are configured
 * based on the environment variables present. Uses the same getOrderedProviders()
 * as all other routes, so this accurately reflects the live failover order.
 */

import { NextResponse } from "next/server"
import { getOrderedProviders } from "@/lib/ai-providers"

export async function GET() {
  try {
    const providers = getOrderedProviders()

    return NextResponse.json({
      totalProviders: providers.length,
      providers: providers.map((p) => ({ name: p.name })),
      failoverOrder: providers.map((p) => p.name),
    })
  } catch (error) {
    console.error("Failed to get provider status:", error)
    return NextResponse.json({ error: "Failed to get provider status" }, { status: 500 })
  }
}
