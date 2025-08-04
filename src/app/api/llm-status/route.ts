import { NextResponse } from "next/server"
import { multiLLM } from "@/lib/llm-providers"

export async function GET() {
  try {
    const status = multiLLM.getProviderStatus()
    
    return NextResponse.json({
      currentProvider: status.currentProvider,
      consecutiveFailures: status.consecutiveFailures,
      providers: status.providers,
      totalProviders: status.providers.length,
      availableProviders: status.providers.filter(p => p.available).length,
      summary: {
        healthy: status.providers.filter(p => p.available && p.successCount > p.failureCount).length,
        struggling: status.providers.filter(p => p.available && p.failureCount >= p.successCount && p.successCount > 0).length,
        failed: status.providers.filter(p => !p.available).length,
        untested: status.providers.filter(p => p.successCount === 0 && p.failureCount === 0).length
      },
      performance: {
        totalSuccesses: status.providers.reduce((sum, p) => sum + p.successCount, 0),
        totalFailures: status.providers.reduce((sum, p) => sum + p.failureCount, 0),
        successRate: (() => {
          const total = status.providers.reduce((sum, p) => sum + p.successCount + p.failureCount, 0)
          const successes = status.providers.reduce((sum, p) => sum + p.successCount, 0)
          return total > 0 ? Math.round((successes / total) * 100) : 0
        })()
      }
    })
  } catch (error) {
    console.error("Failed to get LLM provider status:", error)
    return NextResponse.json(
      { error: "Failed to get provider status" },
      { status: 500 }
    )
  }
}