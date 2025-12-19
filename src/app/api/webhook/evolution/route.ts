import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { generateResponse } from '@/lib/deepseek'
import { sendTextMessage } from '@/lib/evolution'
import { recordMetric } from '@/lib/metrics'
import { isDeepSeekConfigured, isEvolutionConfigured } from '@/lib/env'

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

  // Extrair número de telefone
  const phoneNumber = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '')

  // Ignorar grupos por enquanto
  if (remoteJid.includes('@g.us')) return

  // Extrair conteúdo da mensagem
  const messageContent = data.message.conversation || 
    data.message.extendedTextMessage?.text || 
    ''

  if (!messageContent) return

  // Verificar se número está autorizado
  const authorizedNumber = await prisma.authorizedNumber.findFirst({
    where: {
      phoneNumber,
      instanceId: instance.id,
      isActive: true,
    },
  })

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
