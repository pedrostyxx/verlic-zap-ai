import { NextResponse } from 'next/server'
import { getMetricsSummary, getMetricsByDay, getMessageStats } from '@/lib/metrics'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const [summary, messageStats, messagesPerDay, aiRequestsPerDay, recentErrors] = await Promise.all([
      getMetricsSummary(30),
      getMessageStats(),
      getMetricsByDay('message_received', 7),
      getMetricsByDay('ai_request', 7),
      prisma.systemMetric.findMany({
        where: { metricType: 'error' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ])

    return NextResponse.json({
      summary,
      messageStats,
      charts: {
        messagesPerDay,
        aiRequestsPerDay,
      },
      recentErrors: recentErrors.map(e => ({
        id: e.id,
        createdAt: e.createdAt,
        metadata: e.metadata ? JSON.parse(e.metadata) : null,
      })),
    })
  } catch (error) {
    console.error('[Metrics] Erro ao obter:', error)
    return NextResponse.json({ error: 'Erro ao obter métricas' }, { status: 500 })
  }
}
