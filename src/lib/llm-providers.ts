import { ChatGroq } from "@langchain/groq"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { ChatCohere } from "@langchain/cohere"
import { ChatOpenAI } from "@langchain/openai"
import { BaseChatModel } from "@langchain/core/language_models/chat_models"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

interface LLMProvider {
  name: string
  model: BaseChatModel
  available: boolean
  lastError?: Date
  successCount: number
  failureCount: number
}

class MultiLLMManager {
  private providers: LLMProvider[] = []
  private currentProviderIndex: number = 0
  private stickyProvider: LLMProvider | null = null
  private consecutiveFailures: number = 0
  private maxConsecutiveFailures: number = 2
  private initialized: boolean = false

  constructor() {
    // Don't initialize immediately - do it lazily
  }

  private ensureInitialized() {
    if (!this.initialized) {
      this.initializeProviders()
      this.initialized = true
    }
  }

  private initializeProviders() {
    console.log("🚀 Initializing MultiLLM Manager...")

    // Groq - Fast and reliable (try first)
    if (process.env.GROQ_API_KEY) {
      try {
        this.providers.push({
          name: "Groq",
          model: new ChatGroq({
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            maxRetries: 2,
            timeout: 30000,
          }),
          available: true,
          successCount: 0,
          failureCount: 0
        })
        console.log("✅ Groq provider initialized")
      } catch (error) {
        console.warn("⚠️ Failed to initialize Groq:", error)
      }
    } else {
      console.log("⚪ Groq API key not found, skipping...")
    }

    // Google Gemini - High quality, generous free tier
    if (process.env.GOOGLE_API_KEY) {
      try {
        this.providers.push({
          name: "Google Gemini",
          model: new ChatGoogleGenerativeAI({
            model: "gemini-1.5-flash",
            temperature: 0.7,
            maxRetries: 2,
            apiKey: process.env.GOOGLE_API_KEY,
          }),
          available: true,
          successCount: 0,
          failureCount: 0
        })
        console.log("✅ Google Gemini provider initialized")
      } catch (error) {
        console.warn("⚠️ Failed to initialize Google Gemini:", error)
      }
    } else {
      console.log("⚪ Google API key not found, skipping...")
    }

    // Together AI - Fast and cost-effective
    if (process.env.TOGETHER_API_KEY) {
      try {
        this.providers.push({
          name: "Together AI",
          model: new ChatOpenAI({
            modelName: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
            temperature: 0.7,
            maxRetries: 2,
            timeout: 30000,
            configuration: {
              baseURL: "https://api.together.xyz/v1",
              apiKey: process.env.TOGETHER_API_KEY,
            },
          }),
          available: true,
          successCount: 0,
          failureCount: 0
        })
        console.log("✅ Together AI provider initialized")
      } catch (error) {
        console.warn("⚠️ Failed to initialize Together AI:", error)
      }
    } else {
      console.log("⚪ Together API key not found, skipping...")
    }

    // Fireworks AI - Fast inference
    if (process.env.FIREWORKS_API_KEY) {
      try {
        this.providers.push({
          name: "Fireworks AI",
          model: new ChatOpenAI({
            modelName: "accounts/fireworks/models/llama-v3p1-70b-instruct",
            temperature: 0.7,
            maxRetries: 2,
            timeout: 30000,
            configuration: {
              baseURL: "https://api.fireworks.ai/inference/v1",
              apiKey: process.env.FIREWORKS_API_KEY,
            },
          }),
          available: true,
          successCount: 0,
          failureCount: 0
        })
        console.log("✅ Fireworks AI provider initialized")
      } catch (error) {
        console.warn("⚠️ Failed to initialize Fireworks AI:", error)
      }
    } else {
      console.log("⚪ Fireworks API key not found, skipping...")
    }

    // Cohere - Good for various tasks
    if (process.env.COHERE_API_KEY) {
      try {
        this.providers.push({
          name: "Cohere",
          model: new ChatCohere({
            model: "command-r-plus",
            temperature: 0.7,
            maxRetries: 2,
            apiKey: process.env.COHERE_API_KEY,
          }),
          available: true,
          successCount: 0,
          failureCount: 0
        })
        console.log("✅ Cohere provider initialized")
      } catch (error) {
        console.warn("⚠️ Failed to initialize Cohere:", error)
      }
    } else {
      console.log("⚪ Cohere API key not found, skipping...")
    }

    // Hugging Face - Community models (try last as it can be slower)
    if (process.env.HUGGINGFACE_API_KEY) {
      try {
        this.providers.push({
          name: "Hugging Face",
          model: new ChatOpenAI({
            modelName: "meta-llama/Llama-2-70b-chat-hf",
            temperature: 0.7,
            maxRetries: 2,
            timeout: 45000, // Longer timeout for HF
            configuration: {
              baseURL: "https://api-inference.huggingface.co/v1",
              apiKey: process.env.HUGGINGFACE_API_KEY,
            }
          }),
          available: true,
          successCount: 0,
          failureCount: 0
        })
        console.log("✅ Hugging Face provider initialized")
      } catch (error) {
        console.warn("⚠️ Failed to initialize Hugging Face:", error)
      }
    } else {
      console.log("⚪ Hugging Face API key not found, skipping...")
    }

    // Set initial sticky provider to the first available one
    if (this.providers.length > 0) {
      this.stickyProvider = this.providers[0]
      console.log(`🎯 Initial sticky provider set to: ${this.stickyProvider.name}`)
    }

    console.log(`🤖 MultiLLM initialized with ${this.providers.length} providers:`, 
      this.providers.map(p => p.name).join(", "))

    if (this.providers.length === 0) {
      console.error("❌ No LLM providers available! Please check your API keys.")
    }
  }

  private switchToNextProvider() {
    const availableProviders = this.providers.filter(p => p.available)
    if (availableProviders.length === 0) return null

    // Find the next available provider after current sticky provider
    let nextIndex = 0
    if (this.stickyProvider) {
      const currentIndex = availableProviders.findIndex(p => p.name === this.stickyProvider!.name)
      nextIndex = (currentIndex + 1) % availableProviders.length
    }

    this.stickyProvider = availableProviders[nextIndex]
    this.consecutiveFailures = 0
    console.log(`🔄 Switched sticky provider to: ${this.stickyProvider?.name}`)
    return this.stickyProvider
  }

  private markProviderUnavailable(providerName: string, error: unknown) {
    const provider = this.providers.find(p => p.name === providerName)
    if (provider) {
      provider.available = false
      provider.lastError = new Date()
      provider.failureCount++
      
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.log(`⚠️ Marked ${providerName} as temporarily unavailable:`, errorMessage)
      
      // If this was our sticky provider, switch to next one
      if (this.stickyProvider?.name === providerName) {
        this.switchToNextProvider()
      }
      
      // Re-enable after 10 minutes for server/connection errors
      setTimeout(() => {
        provider.available = true
        console.log(`🔄 Re-enabled ${providerName}`)
      }, 10 * 60 * 1000)
    }
  }

  async callLLM(messages: ChatMessage[]): Promise<{
    content: string,
    provider: string,
    attempt: number,
    switched: boolean
  }> {
    this.ensureInitialized()

    if (this.providers.length === 0) {
      throw new Error("No LLM providers available. Please check your API keys in the environment variables.")
    }

    // Convert ChatMessage[] to BaseMessageLike[]
    const baseMessages = messages.map(msg => ({
      type: msg.role,
      content: msg.content
    }))

    let switched = false
    let totalAttempts = 0

    // Use sticky provider first if available
    if (this.stickyProvider && this.stickyProvider.available) {
      totalAttempts++
      try {
        console.log(`🎯 Using sticky provider: ${this.stickyProvider.name} (${this.stickyProvider.successCount} successes so far)`)
        
        const aiMsg = await this.stickyProvider.model.invoke(baseMessages)
        
        let content: string
        if (typeof aiMsg.content === "string") {
          content = aiMsg.content
        } else if (Array.isArray(aiMsg.content)) {
          content = aiMsg.content.join(" ")
        } else {
          content = String(aiMsg.content)
        }

        // Success! Reset failure counter and update success count
        this.consecutiveFailures = 0
        this.stickyProvider.successCount++
        
        console.log(`✅ Success with sticky provider: ${this.stickyProvider.name} (${this.stickyProvider.successCount} total successes)`)
        
        return {
          content,
          provider: this.stickyProvider.name,
          attempt: totalAttempts,
          switched
        }

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.log(`❌ Sticky provider ${this.stickyProvider.name} failed:`, errorMessage)
        this.consecutiveFailures++
        this.stickyProvider.failureCount++

        console.log(`🔄 Switching providers immediately due to failure (${this.consecutiveFailures} consecutive failures)`)
        switched = true
        
        // Mark as temporarily unavailable if it's a server/connection error
        if (this.isTemporaryError(error)) {
          this.markProviderUnavailable(this.stickyProvider.name, error)
        } else {
          // Just switch without marking unavailable for other errors
          this.switchToNextProvider()
        }
      }
    }

    // Try all available providers (excluding the failed one)
    const availableProviders = this.providers.filter(p => p.available)
    
    if (availableProviders.length === 0) {
      throw new Error("All LLM providers are currently unavailable. Please try again in a few minutes.")
    }

    console.log(`🔄 Trying ${availableProviders.length} available providers`)

    for (const provider of availableProviders) {
      totalAttempts++
      try {
        console.log(`🔄 Attempting with ${provider.name} (attempt ${totalAttempts})`)
        
        const aiMsg = await provider.model.invoke(baseMessages)
        
        let content: string
        if (typeof aiMsg.content === "string") {
          content = aiMsg.content
        } else if (Array.isArray(aiMsg.content)) {
          content = aiMsg.content.join(" ")
        } else {
          content = String(aiMsg.content)
        }

        // Success! Make this the new sticky provider
        this.stickyProvider = provider
        this.consecutiveFailures = 0
        provider.successCount++
        
        console.log(`✅ Success with ${provider.name}, now the sticky provider (${provider.successCount} total successes)`)
        
        return {
          content,
          provider: provider.name,
          attempt: totalAttempts,
          switched: true // Always true when we reach this point
        }

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.log(`❌ Provider ${provider.name} failed:`, errorMessage)
        provider.failureCount++
        
        // Mark as temporarily unavailable if it's a server/connection error
        if (this.isTemporaryError(error)) {
          this.markProviderUnavailable(provider.name, error)
        }
        
        continue
      }
    }
    
    // Only throw error if ALL providers failed
    throw new Error(`All ${this.providers.length} LLM providers failed. Please try again in a few minutes.`)
  }

  private isTemporaryError(error: unknown): boolean {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
    const errorCode = (error as { code?: number | string; status?: number | string })?.code || 
                     (error as { code?: number | string; status?: number | string })?.status
    
    return (
      errorMessage.includes("rate limit") ||
      errorMessage.includes("quota") ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("connection") ||
      errorMessage.includes("econnreset") ||
      errorMessage.includes("server error") ||
      errorMessage.includes("service unavailable") ||
      errorCode === 429 ||
      errorCode === 503 ||
      errorCode === 502 ||
      errorCode === 504
    )
  }

  private isPermanentError(error: unknown): boolean {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
    const errorCode = (error as { code?: number | string; status?: number | string })?.code || 
                     (error as { code?: number | string; status?: number | string })?.status
    
    return (
      errorMessage.includes("invalid api key") ||
      errorMessage.includes("unauthorized") ||
      errorMessage.includes("forbidden") ||
      errorCode === 401 ||
      errorCode === 403
    )
  }

  getProviderStatus() {
    this.ensureInitialized()
    
    return {
      currentProvider: this.stickyProvider?.name || "none",
      providers: this.providers.map(p => ({
        name: p.name,
        available: p.available,
        successCount: p.successCount,
        failureCount: p.failureCount,
        lastError: p.lastError,
        isSticky: p.name === this.stickyProvider?.name
      })),
      consecutiveFailures: this.consecutiveFailures
    }
  }
}

// Create and export a TRUE singleton instance
let multiLLMInstance: MultiLLMManager | null = null

function getMultiLLMInstance(): MultiLLMManager {
  if (!multiLLMInstance) {
    multiLLMInstance = new MultiLLMManager()
  }
  return multiLLMInstance
}

export const multiLLM = getMultiLLMInstance()

// Export the main function for backward compatibility
export async function callGroqLLM(messages: ChatMessage[]): Promise<string> {
  const result = await multiLLM.callLLM(messages)
  return result.content
}