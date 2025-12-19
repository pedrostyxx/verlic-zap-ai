import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getInstanceStatus, getInstanceInfo } from '@/lib/evolution'
import { isEvolutionConfigured } from '@/lib/env'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id },
    })

    if (!instance) {
      return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })
    }

    if (!isEvolutionConfigured()) {
      return NextResponse.json({
        status: instance.status,
        deviceInfo: null,
      })
    }

    // Obter status atual da Evolution
    const statusResponse = await getInstanceStatus(instance.instanceName)
    const isConnected = statusResponse?.state === 'open'
    const status = isConnected ? 'connected' : 'disconnected'

    let deviceInfo = null

    // Se conectado, obter informações do dispositivo
    if (isConnected) {
      const info = await getInstanceInfo(instance.instanceName)
      deviceInfo = {
        profileName: info?.profileName,
        profilePictureUrl: info?.profilePictureUrl,
        phoneNumber: info?.phoneNumber || info?.owner,
      }

      // Atualizar no banco
      await prisma.whatsAppInstance.update({
        where: { id },
        data: {
          status: 'connected',
          phoneNumber: deviceInfo.phoneNumber || instance.phoneNumber,
          qrCode: null, // Limpar QR quando conectado
        },
      })
    } else {
      // Atualizar status como desconectado
      await prisma.whatsAppInstance.update({
        where: { id },
        data: {
          status: 'disconnected',
        },
      })
    }

    return NextResponse.json({
      status,
      deviceInfo,
    })
  } catch (error) {
    console.error('[Instance Status] Erro:', error)
    return NextResponse.json({ error: 'Erro ao verificar status' }, { status: 500 })
  }
}
