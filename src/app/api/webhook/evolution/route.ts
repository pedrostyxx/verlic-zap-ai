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

// Interfaces flexíveis para o webhook da Evolution API v2
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface WebhookData {
  key?: {
    remoteJid?: string
    fromMe?: boolean
    id?: string
    participant?: string
  }
  message?: {
    conversation?: string
    extendedTextMessage?: { text?: string }
    imageMessage?: { caption?: string }
    videoMessage?: { caption?: string }
    documentMessage?: { caption?: string }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any
  }
  participant?: string
  pushName?: string
  state?: string
  qrcode?: { base64?: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

interface WebhookPayload {
  event: string
  instance: string
  data?: WebhookData
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    
    // Log completo do payload para debug
    console.log('[Webhook] Payload recebido:', JSON.stringify(payload, null, 2))
    
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
        await handleIncomingMessage(instance, payload.data, payload)
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleIncomingMessage(
  instance: { id: string; instanceName: string },
  data?: WebhookPayload['data'],
  fullPayload?: any
) {
  // Log para debug - ver estrutura completa
  console.log('[Webhook] Data recebida:', JSON.stringify(data, null, 2))
  
  if (!data) return

  // A Evolution API v2 pode enviar a mensagem em diferentes estruturas
  // Vamos tentar extrair de várias formas
  
  // Tentar extrair key e message de diferentes locais
  const key = data.key
  const message = data.message
  
  // Verificar se é mensagem válida
  if (!key || !message) {
    console.log('[Webhook] Estrutura de mensagem inválida')
    return
  }

  const remoteJid = key.remoteJid
  const fromMe = key.fromMe

  // Ignorar mensagens enviadas por nós
  if (fromMe) {
    console.log('[Webhook] Ignorando mensagem própria')
    return
  }

  // Ignorar grupos
  if (remoteJid?.includes('@g.us')) {
    console.log('[Webhook] Ignorando grupo:', remoteJid)
    return
  }

  // Extrair número de telefone
  // Na Evolution v2, o número pode estar em:
  // 1. remoteJid (5511999999999@s.whatsapp.net)
  // 2. data.pushName pode ter o nome do contato
  // 3. Para @lid, precisamos buscar o número real em outro lugar
  
  let phoneNumber: string | null = null
  
  // Se remoteJid é um @lid, não temos o número neste campo
  // O @lid é um ID interno do WhatsApp, não um número de telefone
  if (remoteJid?.includes('@lid')) {
    // Tentar buscar número em campos alternativos do payload
    // A Evolution às vezes inclui participant ou outras informações
    const participant = key.participant || data.participant
    if (participant) {
      phoneNumber = extractPhoneNumber(participant)
    }
    
    // Se ainda não encontrou, buscar no pushName não ajuda pois é só nome
    if (!phoneNumber) {
      console.log('[Webhook] Mensagem com @lid sem número real:', remoteJid)
      console.log('[Webhook] Payload completo para análise:', JSON.stringify(fullPayload, null, 2))
      return
    }
  } else if (remoteJid) {
    phoneNumber = extractPhoneNumber(remoteJid)
  }
  
  if (!phoneNumber) {
    console.log('[Webhook] Não foi possível extrair número de:', remoteJid)
    return
  }

  // Extrair conteúdo da mensagem - suportar múltiplos formatos
  const messageContent = 
    message.conversation || 
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    ''

  if (!messageContent) {
    console.log('[Webhook] Mensagem sem conteúdo de texto')
    return
  }

  console.log('[Webhook] ✓ Mensagem recebida de:', phoneNumber, '-', messageContent.substring(0, 50))

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
    console.log('[Webhook] ✗ Número não autorizado:', phoneNumber)
    return
  }

  console.log('[Webhook] ✓ Número autorizado, gerando resposta...')

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
