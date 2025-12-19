import axios from 'axios'
import { isDeepSeekConfigured } from './env'
import { cacheGet, cacheSet } from './redis'

const DEEPSEEK_MODEL = 'deepseek-chat'
const MAX_CONTEXT_MESSAGES = 20
const CONTEXT_CACHE_TTL = 3600 // 1 hora

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  content: string
  tokensUsed: number
  responseTime: number
}

const getDeepSeekApi = () => {
  if (!isDeepSeekConfigured()) {
    return null
  }

  return axios.create({
    baseURL: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    timeout: 60000,
  })
}

// Sistema de prompt padrão
const SYSTEM_PROMPT = `Você é um assistente virtual profissional e prestativo. 
Responda de forma clara, objetiva e educada. 
Mantenha suas respostas concisas, mas completas.
Sempre responda no mesmo idioma da mensagem recebida.
Se não souber algo, diga honestamente.`

// Obter contexto da conversa do cache
export async function getConversationContext(phoneNumber: string, instanceId: string): Promise<ChatMessage[]> {
  const cacheKey = `conversation:${instanceId}:${phoneNumber}`
  const cached = await cacheGet<ChatMessage[]>(cacheKey)
  return cached || []
}

// Salvar contexto da conversa no cache
export async function saveConversationContext(
  phoneNumber: string,
  instanceId: string,
  messages: ChatMessage[]
): Promise<void> {
  const cacheKey = `conversation:${instanceId}:${phoneNumber}`
  // Manter apenas as últimas mensagens para contexto
  const trimmedMessages = messages.slice(-MAX_CONTEXT_MESSAGES)
  await cacheSet(cacheKey, trimmedMessages, CONTEXT_CACHE_TTL)
}

// Gerar resposta usando DeepSeek
export async function generateResponse(
  userMessage: string,
  phoneNumber: string,
  instanceId: string,
  customSystemPrompt?: string
): Promise<ChatResponse | null> {
  const api = getDeepSeekApi()
  if (!api) {
    return null
  }

  const startTime = Date.now()

  try {
    // Recuperar contexto anterior
    const context = await getConversationContext(phoneNumber, instanceId)

    // Montar mensagens com contexto
    const messages: ChatMessage[] = [
      { role: 'system', content: customSystemPrompt || SYSTEM_PROMPT },
      ...context,
      { role: 'user', content: userMessage },
    ]

    const response = await api.post('/chat/completions', {
      model: DEEPSEEK_MODEL,
      messages,
      max_tokens: 1024,
      temperature: 0.7,
      stream: false,
    })

    const assistantMessage = response.data.choices[0]?.message?.content || ''
    const tokensUsed = response.data.usage?.total_tokens || 0
    const responseTime = Date.now() - startTime

    // Atualizar contexto com nova mensagem
    const updatedContext: ChatMessage[] = [
      ...context,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: assistantMessage },
    ]
    await saveConversationContext(phoneNumber, instanceId, updatedContext)

    return {
      content: assistantMessage,
      tokensUsed,
      responseTime,
    }
  } catch (error) {
    console.error('[DeepSeek] Erro ao gerar resposta:', error)
    throw error
  }
}

// Limpar contexto de uma conversa
export async function clearConversationContext(phoneNumber: string, instanceId: string): Promise<void> {
  const cacheKey = `conversation:${instanceId}:${phoneNumber}`
  const { cacheDel } = await import('./redis')
  await cacheDel(cacheKey)
}

// Verificar se o serviço está disponível
export async function checkDeepSeekHealth(): Promise<boolean> {
  const api = getDeepSeekApi()
  if (!api) return false

  try {
    await api.get('/models')
    return true
  } catch {
    return false
  }
}

export default getDeepSeekApi
