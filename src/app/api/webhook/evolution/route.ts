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
  console.log('='.repeat(60))
  console.log('[Webhook] PROCESSANDO MENSAGEM')
  console.log('='.repeat(60))
  console.log('[Webhook] Payload completo:', JSON.stringify(fullPayload, null, 2))
  
  // Verificar se é mensagem própria (fromMe)
  // Quando fromMe=true, o bot está enviando, não recebendo
  const fromMe = data?.key?.fromMe === true
  if (fromMe) {
    console.log('[Webhook] ✗ Ignorando mensagem própria (fromMe=true)')
    return
  }
  
  // O remoteJid contém o número de QUEM ENVIOU a mensagem (quando fromMe=false)
  // Exemplo: "5511999999999@s.whatsapp.net" - este é o número do USUÁRIO
  // O campo "sender" do payload é o número do BOT, não do usuário!
  const remoteJid = data?.key?.remoteJid || ''
  
  console.log('[Webhook] remoteJid (usuário):', remoteJid)
  console.log('[Webhook] fromMe:', fromMe)
  console.log('[Webhook] sender (bot):', fullPayload?.sender)
  
  // Ignorar grupos
  if (remoteJid.includes('@g.us')) {
    console.log('[Webhook] ✗ Ignorando grupo:', remoteJid)
    return
  }
  
  // Ignorar LIDs (IDs internos do WhatsApp, não são números reais)
  if (remoteJid.includes('@lid')) {
    console.log('[Webhook] ✗ Ignorando LID (ID interno):', remoteJid)
    // Tentar buscar número alternativo
    const altJid = data?.key?.participant || fullPayload?.data?.key?.remoteJidAlt
    if (altJid) {
      console.log('[Webhook] Tentando remoteJidAlt:', altJid)
    }
    return
  }
  
  // Extrair número do remoteJid (número do usuário)
  const phoneNumber = extractPhoneNumber(remoteJid)
  console.log('[Webhook] Número extraído do usuário:', phoneNumber)
  
  if (!phoneNumber) {
    console.log('[Webhook] ✗ Não foi possível extrair número do remoteJid')
    return
  }
  
  // Extrair conteúdo da mensagem
  const msg = data?.message
  const messageContent = 
    msg?.conversation ||
    msg?.extendedTextMessage?.text ||
    msg?.imageMessage?.caption ||
    msg?.videoMessage?.caption ||
    msg?.documentMessage?.caption ||
    null
    
  console.log('[Webhook] Tipo mensagem:', data?.messageType)
  console.log('[Webhook] Conteúdo:', messageContent?.substring(0, 100))
  
  if (!messageContent) {
    console.log('[Webhook] ✗ Mensagem sem conteúdo de texto')
    return
  }
  
  console.log('[Webhook] ✓ Mensagem recebida de:', phoneNumber, '-', messageContent)
  
  // Verificar se número está autorizado
  console.log('[Webhook] Verificando autorização para:', phoneNumber, 'na instância:', instance.id)
  const authorizedNumber = await findAuthorizedNumber(instance.id, phoneNumber)
  console.log('[Webhook] Autorizado:', authorizedNumber ? 'SIM' : 'NÃO')
  
  // Salvar mensagem recebida
  try {
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
    console.log('[Webhook] ✓ Mensagem salva no banco')
  } catch (err) {
    console.error('[Webhook] ✗ Erro ao salvar mensagem:', err)
  }
  
  await recordMetric('message_received', 1, { instanceId: instance.id })
  
  // Se não autorizado, parar aqui
  if (!authorizedNumber) {
    console.log('[Webhook] ✗ PARANDO: Número não autorizado:', phoneNumber)
    console.log('[Webhook] Dica: Adicione o número', phoneNumber, 'como autorizado no dashboard')
    return
  }
  
  console.log('[Webhook] ✓ Número autorizado! Gerando resposta IA...')
  
  // Verificar se DeepSeek está configurado
  const deepseekConfigured = isDeepSeekConfigured()
  console.log('[Webhook] DeepSeek configurado:', deepseekConfigured)
  console.log('[Webhook] DEEPSEEK_API_KEY presente:', !!process.env.DEEPSEEK_API_KEY)
  
  if (!deepseekConfigured) {
    console.log('[Webhook] ✗ PARANDO: DeepSeek não configurado')
    return
  }
  
  // Gerar resposta com IA
  try {
    console.log('[Webhook] Chamando DeepSeek API...')
    const startTime = Date.now()
    
    const aiResponse = await generateResponse(
      messageContent,
      phoneNumber,
      instance.id
    )
    
    console.log('[Webhook] Resposta DeepSeek:', aiResponse ? 'RECEBIDA' : 'VAZIA')
    
    if (!aiResponse) {
      console.log('[Webhook] ✗ DeepSeek não retornou resposta')
      return
    }
    
    console.log('[Webhook] ✓ Resposta IA:', aiResponse.content.substring(0, 100))
    console.log('[Webhook] Tokens usados:', aiResponse.tokensUsed)
    console.log('[Webhook] Tempo resposta:', aiResponse.responseTime, 'ms')
    
    await recordMetric('ai_request', 1, {
      instanceId: instance.id,
      tokensUsed: aiResponse.tokensUsed,
      responseTime: aiResponse.responseTime,
    })
    
    // Enviar resposta via Evolution
    const evolutionConfigured = isEvolutionConfigured()
    console.log('[Webhook] Evolution configurado:', evolutionConfigured)
    
    if (!evolutionConfigured) {
      console.log('[Webhook] ✗ Evolution não configurado, não pode enviar resposta')
      return
    }
    
    console.log('[Webhook] Enviando mensagem para:', phoneNumber, 'via instância:', instance.instanceName)
    
    const sent = await sendTextMessage(
      instance.instanceName,
      phoneNumber,
      aiResponse.content
    )
    
    console.log('[Webhook] Mensagem enviada:', sent ? 'SIM' : 'NÃO')
    
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
      console.log('[Webhook] ✓ SUCESSO! Resposta enviada para', phoneNumber)
    } else {
      console.log('[Webhook] ✗ FALHA ao enviar mensagem')
    }
  } catch (error) {
    console.error('[Webhook] ✗ ERRO ao processar:', error)
    await recordMetric('error', 1, { source: 'ai_response', error: String(error) })
  }
  
  console.log('='.repeat(60))
}
