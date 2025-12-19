import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// Obter configurações
export async function GET() {
  try {
    const configs = await prisma.systemConfig.findMany()
    
    const configMap = configs.reduce((acc, c) => {
      acc[c.key] = c.value
      return acc
    }, {} as Record<string, string>)

    return NextResponse.json({ configs: configMap })
  } catch (error) {
    console.error('[Settings] Erro ao obter:', error)
    return NextResponse.json({ error: 'Erro ao obter configurações' }, { status: 500 })
  }
}

// Salvar configuração
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { key, value } = body

    if (!key) {
      return NextResponse.json({ error: 'Chave é obrigatória' }, { status: 400 })
    }

    await prisma.systemConfig.upsert({
      where: { key },
      create: { key, value: String(value) },
      update: { value: String(value) },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Settings] Erro ao salvar:', error)
    return NextResponse.json({ error: 'Erro ao salvar configuração' }, { status: 500 })
  }
}
