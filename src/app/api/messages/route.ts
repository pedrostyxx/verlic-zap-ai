import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getTopSenders } from '@/lib/metrics'

// Listar mensagens
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const instanceId = searchParams.get('instanceId')
    const phoneNumber = searchParams.get('phoneNumber')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (instanceId) where.instanceId = instanceId
    if (phoneNumber) where.phoneNumber = phoneNumber

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          instance: {
            select: { instanceName: true },
          },
        },
      }),
      prisma.message.count({ where }),
    ])

    return NextResponse.json({
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[Messages] Erro ao listar:', error)
    return NextResponse.json({ error: 'Erro ao listar mensagens' }, { status: 500 })
  }
}
