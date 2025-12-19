import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { 
  getInstanceQRCode, 
  getInstanceStatus,
  restartInstance,
  disconnectInstance,
} from '@/lib/evolution'
import { isEvolutionConfigured } from '@/lib/env'
import { recordMetric } from '@/lib/metrics'

interface RouteParams {
  params: Promise<{ id: string }>
}

// Obter detalhes de uma instância
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id },
      include: {
        authorizedNumbers: true,
        _count: {
          select: {
            messages: true,
          },
        },
      },
    })

    if (!instance) {
      return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })
    }

    // Atualizar status e QR Code se Evolution estiver configurado
    if (isEvolutionConfigured()) {
      const status = await getInstanceStatus(instance.instanceName)
      
      let qrCode = instance.qrCode
      let qrCodeRaw = null
      let pairingCode = null
      
      if (status?.state !== 'open') {
        const qrResponse = await getInstanceQRCode(instance.instanceName)
        qrCode = qrResponse?.base64 || null
        qrCodeRaw = qrResponse?.code || null
        pairingCode = qrResponse?.pairingCode || null
      }

      await prisma.whatsAppInstance.update({
        where: { id },
        data: { 
          status: status?.state === 'open' ? 'connected' : 'disconnected',
          qrCode,
        },
      })

      return NextResponse.json({
        instance: {
          ...instance,
          status: status?.state === 'open' ? 'connected' : 'disconnected',
          qrCode,
          qrCodeRaw,
          pairingCode,
        },
      })
    }

    return NextResponse.json({ instance })
  } catch (error) {
    console.error('[Instance] Erro ao obter:', error)
    return NextResponse.json({ error: 'Erro ao obter instância' }, { status: 500 })
  }
}

// Ações na instância (restart, disconnect, etc)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action } = body

    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id },
    })

    if (!instance) {
      return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })
    }

    if (!isEvolutionConfigured()) {
      return NextResponse.json({ 
        error: 'Evolution API não configurada',
        isMocked: true,
      }, { status: 400 })
    }

    let success = false
    let newStatus = instance.status

    switch (action) {
      case 'restart':
        success = await restartInstance(instance.instanceName)
        await recordMetric('bot_started', 1, { instanceId: id })
        break
      
      case 'disconnect':
        success = await disconnectInstance(instance.instanceName)
        newStatus = 'disconnected'
        await recordMetric('bot_stopped', 1, { instanceId: id })
        break
      
      case 'connect':
        const qrResponse = await getInstanceQRCode(instance.instanceName)
        await prisma.whatsAppInstance.update({
          where: { id },
          data: { qrCode: qrResponse?.base64 || null },
        })
        return NextResponse.json({ 
          success: true, 
          qrCode: qrResponse?.base64,
          qrCodeRaw: qrResponse?.code, // Código bruto para gerar QR personalizado
          pairingCode: qrResponse?.pairingCode,
        })
      
      default:
        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }

    if (success) {
      await prisma.whatsAppInstance.update({
        where: { id },
        data: { status: newStatus },
      })
    }

    await recordMetric('api_request', 1, { action: `instance_${action}` })

    return NextResponse.json({ success, status: newStatus })
  } catch (error) {
    console.error('[Instance] Erro na ação:', error)
    return NextResponse.json({ error: 'Erro ao executar ação' }, { status: 500 })
  }
}
