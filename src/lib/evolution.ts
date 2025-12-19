import axios from 'axios'
import { isEvolutionConfigured } from './env'

const getEvolutionApi = () => {
  if (!isEvolutionConfigured()) {
    return null
  }

  return axios.create({
    baseURL: process.env.EVOLUTION_API_URL,
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.EVOLUTION_API_KEY,
    },
    timeout: 30000,
  })
}

export interface InstanceInfo {
  name: string           // Evolution retorna "name"
  instanceName?: string  // Para compatibilidade
  instanceId?: string
  id?: string
  status?: string
  connectionStatus?: string
  owner?: string
  ownerJid?: string
  profileName?: string
}

export interface QRCodeResponse {
  base64: string
  code: string
  pairingCode?: string
}

// Criar instância
export async function createInstance(instanceName: string): Promise<InstanceInfo | null> {
  const api = getEvolutionApi()
  if (!api) return null

  try {
    const response = await api.post('/instance/create', {
      instanceName,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
    })
    return response.data
  } catch (error) {
    console.error('[Evolution] Erro ao criar instância:', error)
    throw error
  }
}

// Obter QR Code
export async function getInstanceQRCode(instanceName: string): Promise<QRCodeResponse | null> {
  const api = getEvolutionApi()
  if (!api) return null

  try {
    const response = await api.get(`/instance/connect/${instanceName}`)
    return {
      base64: response.data?.base64 || null,
      code: response.data?.code || null,
      pairingCode: response.data?.pairingCode || null,
    }
  } catch (error) {
    console.error('[Evolution] Erro ao obter QR Code:', error)
    return null
  }
}

// Status da instância com informações do dispositivo
export async function getInstanceStatus(instanceName: string): Promise<{ 
  state: string
  instance?: {
    profileName?: string
    profilePictureUrl?: string
    owner?: string
  }
} | null> {
  const api = getEvolutionApi()
  if (!api) return null

  try {
    const response = await api.get(`/instance/connectionState/${instanceName}`)
    // A Evolution retorna { instance: { instanceName, state } }
    const state = response.data?.instance?.state || response.data?.state || 'disconnected'
    return { state }
  } catch (error) {
    console.error('[Evolution] Erro ao obter status:', error)
    return { state: 'disconnected' }
  }
}

// Obter informações da instância conectada
export async function getInstanceInfo(instanceName: string): Promise<{
  profileName?: string
  profilePictureUrl?: string
  owner?: string
  phoneNumber?: string
  connectionStatus?: string
} | null> {
  const api = getEvolutionApi()
  if (!api) return null

  try {
    const response = await api.get(`/instance/fetchInstances`, {
      params: { instanceName }
    })
    const instance = response.data?.[0] || response.data
    
    // A Evolution retorna ownerJid no formato "5511999999999@s.whatsapp.net"
    const ownerJid = instance?.ownerJid || instance?.owner
    const phoneNumber = ownerJid ? ownerJid.split('@')[0] : null
    
    return {
      profileName: instance?.profileName,
      profilePictureUrl: instance?.profilePicUrl,
      owner: ownerJid,
      phoneNumber: phoneNumber,
      connectionStatus: instance?.connectionStatus,
    }
  } catch (error) {
    console.error('[Evolution] Erro ao obter info:', error)
    return null
  }
}

// Listar instâncias
export async function listInstances(): Promise<InstanceInfo[]> {
  const api = getEvolutionApi()
  if (!api) return []

  try {
    const response = await api.get('/instance/fetchInstances')
    return response.data || []
  } catch (error) {
    console.error('[Evolution] Erro ao listar instâncias:', error)
    return []
  }
}

// Desconectar instância
export async function disconnectInstance(instanceName: string): Promise<boolean> {
  const api = getEvolutionApi()
  if (!api) return false

  try {
    await api.delete(`/instance/logout/${instanceName}`)
    return true
  } catch (error) {
    console.error('[Evolution] Erro ao desconectar:', error)
    return false
  }
}

// Deletar instância
export async function deleteInstance(instanceName: string): Promise<boolean> {
  const api = getEvolutionApi()
  if (!api) return false

  try {
    await api.delete(`/instance/delete/${instanceName}`)
    return true
  } catch (error) {
    console.error('[Evolution] Erro ao deletar instância:', error)
    return false
  }
}

// Reiniciar instância
export async function restartInstance(instanceName: string): Promise<boolean> {
  const api = getEvolutionApi()
  if (!api) return false

  try {
    await api.post(`/instance/restart/${instanceName}`)
    return true
  } catch (error) {
    console.error('[Evolution] Erro ao reiniciar:', error)
    return false
  }
}

// Enviar mensagem de texto
export async function sendTextMessage(
  instanceName: string,
  phoneNumber: string,
  message: string
): Promise<boolean> {
  const api = getEvolutionApi()
  if (!api) return false

  try {
    await api.post(`/message/sendText/${instanceName}`, {
      number: phoneNumber,
      text: message,
    })
    return true
  } catch (error) {
    console.error('[Evolution] Erro ao enviar mensagem:', error)
    return false
  }
}

// Configurar webhook
export async function setWebhook(instanceName: string, webhookUrl: string): Promise<boolean> {
  const api = getEvolutionApi()
  if (!api) return false

  try {
    await api.post(`/webhook/set/${instanceName}`, {
      webhook: {
        enabled: true,
        url: webhookUrl,
        events: [
          'MESSAGES_UPSERT',
          'CONNECTION_UPDATE',
          'QRCODE_UPDATED',
        ],
      },
    })
    return true
  } catch (error) {
    console.error('[Evolution] Erro ao configurar webhook:', error)
    return false
  }
}

export default getEvolutionApi
