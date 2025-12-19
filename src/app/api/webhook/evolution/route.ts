import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { generateResponse } from '@/lib/deepseek'
import { sendTextMessage } from '@/lib/evolution'
import { recordMetric } from '@/lib/metrics'
import { isDeepSeekConfigured, isEvolutionConfigured } from '@/lib/env'

// Extrair número de telefone do JID do WhatsApp
function extractPhoneNumber(jid: string): string | null {
  if (!jid) return null
  
  // Remover sufixos conhecidos
  // @s.whatsapp.net - contatos normais
  // @c.us - formato antigo
  // @g.us - grupos
  // @lid - IDs internos (não são números)
  // @broadcast - listas de transmissão
  
  // Se for grupo, broadcast ou lid, retornar null
  if (jid.includes('@g.us') || jid.includes('@lid') || jid.includes('@broadcast')) {
    return null
  }
  
  // Extrair apenas os dígitos antes do @
  const match = jid.match(/^(\d+)@/)
  if (match) {
    return match[1]
  }
  
  // Se não tem @, pode ser só o número
  if (/^\d+$/.test(jid)) {
    return jid
  }
  
  return null
}

// Normalizar número para comparação
function normalizePhoneNumber(phone: string): string {
  // Remover tudo que não é dígito
  return phone.replace(/\D/g, '')
}

// Buscar número autorizado com diferentes formatos
async function findAuthorizedNumber(instanceId: string, phoneNumber: string) {
  const normalized = normalizePhoneNumber(phoneNumber)
  
  // Buscar exato
  let authorized = await prisma.authorizedNumber.findFirst({
    where: {
      instanceId,
      isActive: true,
      phoneNumber: normalized,
    },
  })
  
  if (authorized) return authorized
  
  // Buscar sem código do país (Brasil = 55)
  if (normalized.startsWith('55') && normalized.length > 10) {
    const withoutCountry = normalized.substring(2)
    authorized = await prisma.authorizedNumber.findFirst({
      where: {
        instanceId,
        isActive: true,
        phoneNumber: withoutCountry,
      },
    })
    if (authorized) return authorized
  }
  
  // Buscar com código do país adicionado
  if (!normalized.startsWith('55') && normalized.length <= 11) {
    authorized = await prisma.authorizedNumber.findFirst({
      where: {
        instanceId,
        isActive: true,
        phoneNumber: `55${normalized}`,
      },
    })
    if (authorized) return authorized
  }
  
  // Buscar números que contenham este número (para casos de formatação diferente)
  authorized = await prisma.authorizedNumber.findFirst({
    where: {
      instanceId,
      isActive: true,
      phoneNumber: {
        endsWith: normalized.slice(-9), // Últimos 9 dígitos
      },
    },
  })
  
  return authorized
}

interface WebhookMessage {
  key: {
    remoteJid: string
    fromMe: boolean
    id: string
  }
  message?: {
    conversation?: string
    extendedTextMessage?: {
      text: string
    }
  }
  messageTimestamp?: number
}

interface WebhookPayload {
  event: string
  instance: string
  data?: {
    key?: {
      remoteJid: string
      fromMe: boolean
    }
    message?: {
      conversation?: string
      extendedTextMessage?: {
        text: string
      }
    }
    state?: string
    qrcode?: {
      base64: string
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload: WebhookPayload = await request.json()
    
    await recordMetric('webhook_received', 1, { event: payload.event })

    const instanceName = payload.instance

    // Buscar instância no banco
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { instanceName },
    })

    if (!instance) {
      console.log('[Webhook] Instância não encontrada:', instanceName)
      return NextResponse.json({ received: true })
    }

    // Processar eventos
    switch (payload.event) {
      case 'connection.update':
      case 'CONNECTION_UPDATE':
        await handleConnectionUpdate(instance.id, payload.data?.state)
        break

      case 'qrcode.updated':
      case 'QRCODE_UPDATED':
        await handleQRCodeUpdate(instance.id, payload.data?.qrcode?.base64)
        break

      case 'messages.upsert':
      case 'MESSAGES_UPSERT':
        await handleIncomingMessage(instance, payload.data)
        break
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Webhook] Erro:', error)
    await recordMetric('error', 1, { source: 'webhook', error: String(error) })
    return NextResponse.json({ error: 'Erro ao processar webhook' }, { status: 500 })
  }
}

async function handleConnectionUpdate(instanceId: string, state?: string) {
  if (!state) return

  const status = state === 'open' ? 'connected' : 'disconnected'
  
  await prisma.whatsAppInstance.update({
    where: { id: instanceId },
    data: { status },
  })

  // Atualizar status do bot
  await prisma.botStatus.upsert({
    where: { instanceId },
    create: {
      instanceId,
      isRunning: status === 'connected',
      lastStarted: status === 'connected' ? new Date() : undefined,
      lastStopped: status === 'disconnected' ? new Date() : undefined,
    },
    update: {
      isRunning: status === 'connected',
      lastStarted: status === 'connected' ? new Date() : undefined,
      lastStopped: status === 'disconnected' ? new Date() : undefined,
    },
  })
}

async function handleQRCodeUpdate(instanceId: string, qrCode?: string) {
  if (!qrCode) return

  await prisma.whatsAppInstance.update({
    where: { id: instanceId },
    data: { qrCode },
  })
}

async function handleIncomingMessage(
  instance: { id: string; instanceName: string },
  data?: WebhookPayload['data']
) {
  if (!data?.key || !data.message) return

  const remoteJid = data.key.remoteJid
  const fromMe = data.key.fromMe

  // Ignorar mensagens enviadas por nós
  if (fromMe) return

  // Ignorar grupos
  if (remoteJid.includes('@g.us')) return
  
  // Ignorar JIDs do tipo @lid (são IDs internos, não números reais)
  if (remoteJid.includes('@lid')) {
    console.log('[Webhook] Ignorando JID interno:', remoteJid)
    return
  }

  // Extrair número de telefone do JID
  // Formatos possíveis: 5511999999999@s.whatsapp.net, 5511999999999@c.us
  const phoneNumber = extractPhoneNumber(remoteJid)
  
  if (!phoneNumber) {
    console.log('[Webhook] Não foi possível extrair número de:', remoteJid)
    return
  }

  // Extrair conteúdo da mensagem
  const messageContent = data.message.conversation || 
    data.message.extendedTextMessage?.text || 
    ''

  if (!messageContent) return

  console.log('[Webhook] Mensagem recebida de:', phoneNumber, '-', messageContent.substring(0, 50))

  // Verificar se número está autorizado (buscar com diferentes formatos)
  const authorizedNumber = await findAuthorizedNumber(instance.id, phoneNumber)

  // Salvar mensagem recebida
  await prisma.message.create({
    data: {
      instanceId: instance.id,
      phoneNumber,
      direction: 'inbound',
      content: messageContent,
      status: 'received',
      authorizedNumber: authorizedNumber?.id,
    },
  })

  await recordMetric('message_received', 1, { instanceId: instance.id })

  // Se não autorizado, ignorar
  if (!authorizedNumber) {
    console.log('[Webhook] Número não autorizado:', phoneNumber)
    return
  }

  console.log('[Webhook] Número autorizado, gerando resposta...')

  // Gerar resposta com IA se configurado
  if (!isDeepSeekConfigured()) {
    console.log('[Webhook] DeepSeek não configurado')
    return
  }

  try {
    const startTime = Date.now()
    const aiResponse = await generateResponse(
      messageContent,
      phoneNumber,
      instance.id
    )

    if (!aiResponse) {
      console.log('[Webhook] Sem resposta da IA')
      return
    }

    await recordMetric('ai_request', 1, {
      instanceId: instance.id,
      tokensUsed: aiResponse.tokensUsed,
      responseTime: aiResponse.responseTime,
    })

    // Enviar resposta via Evolution
    if (isEvolutionConfigured()) {
      const sent = await sendTextMessage(
        instance.instanceName,
        phoneNumber,
        aiResponse.content
      )

      if (sent) {
        // Salvar mensagem enviada
        await prisma.message.create({
          data: {
            instanceId: instance.id,
            phoneNumber,
            direction: 'outbound',
            content: aiResponse.content,
            status: 'sent',
            aiGenerated: true,
            tokensUsed: aiResponse.tokensUsed,
            responseTime: aiResponse.responseTime,
            authorizedNumber: authorizedNumber.id,
          },
        })

        await recordMetric('message_sent', 1, { instanceId: instance.id })
      }
    }
  } catch (error) {
    console.error('[Webhook] Erro ao processar mensagem:', error)
    await recordMetric('error', 1, { source: 'ai_response', error: String(error) })
  }
}
