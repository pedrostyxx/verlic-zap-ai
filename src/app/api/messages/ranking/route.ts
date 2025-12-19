import { NextResponse } from 'next/server'
import { getTopSenders } from '@/lib/metrics'

export async function GET() {
  try {
    const ranking = await getTopSenders(20)
    return NextResponse.json({ ranking })
  } catch (error) {
    console.error('[Ranking] Erro ao obter:', error)
    return NextResponse.json({ error: 'Erro ao obter ranking' }, { status: 500 })
  }
}
