import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyApiAuth } from '@/lib/auth'

// GET - Listar últimos webhooks
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyApiAuth(request)
    if (!auth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const event = searchParams.get('event')
    const instanceName = searchParams.get('instance')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}
    
    if (event) {
      where.event = event
    }
    
    if (instanceName) {
      where.instanceName = instanceName
    }

    const logs = await prisma.webhookLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100), // máximo 100
    })

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('[API] Erro ao buscar webhook logs:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar logs' },
      { status: 500 }
    )
  }
}

// DELETE - Limpar logs antigos
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyApiAuth(request)
    if (!auth) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7')
    
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    const result = await prisma.webhookLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    })

    return NextResponse.json({ deleted: result.count })
  } catch (error) {
    console.error('[API] Erro ao limpar webhook logs:', error)
    return NextResponse.json(
      { error: 'Erro ao limpar logs' },
      { status: 500 }
    )
  }
}
