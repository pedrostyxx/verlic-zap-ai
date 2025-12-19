import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { recordMetric } from '@/lib/metrics'

// Listar números autorizados
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const instanceId = searchParams.get('instanceId')

    const where = instanceId ? { instanceId } : {}

    const numbers = await prisma.authorizedNumber.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        instance: {
          select: {
            instanceName: true,
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    })

    return NextResponse.json({ numbers })
  } catch (error) {
    console.error('[AuthorizedNumbers] Erro ao listar:', error)
    return NextResponse.json({ error: 'Erro ao listar números' }, { status: 500 })
  }
}

// Adicionar número autorizado
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phoneNumber, name, instanceId } = body

    if (!phoneNumber || !instanceId) {
      return NextResponse.json(
        { error: 'Número de telefone e instância são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar se instância existe
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId },
    })

    if (!instance) {
      return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })
    }

    // Formatar número (remover caracteres não numéricos)
    const formattedNumber = phoneNumber.replace(/\D/g, '')

    // Verificar se já existe
    const existing = await prisma.authorizedNumber.findUnique({
      where: {
        phoneNumber_instanceId: {
          phoneNumber: formattedNumber,
          instanceId,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Este número já está autorizado para esta instância' },
        { status: 400 }
      )
    }

    const number = await prisma.authorizedNumber.create({
      data: {
        phoneNumber: formattedNumber,
        name: name || null,
        instanceId,
      },
    })

    await recordMetric('api_request', 1, { action: 'add_authorized_number' })

    return NextResponse.json({ number })
  } catch (error) {
    console.error('[AuthorizedNumbers] Erro ao adicionar:', error)
    return NextResponse.json({ error: 'Erro ao adicionar número' }, { status: 500 })
  }
}

// Atualizar número autorizado
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, isActive } = body

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    const number = await prisma.authorizedNumber.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json({ number })
  } catch (error) {
    console.error('[AuthorizedNumbers] Erro ao atualizar:', error)
    return NextResponse.json({ error: 'Erro ao atualizar número' }, { status: 500 })
  }
}

// Remover número autorizado
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    await prisma.authorizedNumber.delete({
      where: { id },
    })

    await recordMetric('api_request', 1, { action: 'remove_authorized_number' })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[AuthorizedNumbers] Erro ao remover:', error)
    return NextResponse.json({ error: 'Erro ao remover número' }, { status: 500 })
  }
}
