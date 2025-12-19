import prisma from './prisma'

export type MetricType = 
  | 'api_request'
  | 'ai_request'
  | 'message_sent'
  | 'message_received'
  | 'error'
  | 'webhook_received'
  | 'bot_started'
  | 'bot_stopped'

export async function recordMetric(
  metricType: MetricType,
  value: number = 1,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.systemMetric.create({
      data: {
        metricType,
        value,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    })
  } catch (error) {
    console.error('[Metrics] Erro ao gravar métrica:', error)
  }
}

export async function getMetricsSummary(days: number = 7) {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const metrics = await prisma.systemMetric.groupBy({
    by: ['metricType'],
    where: {
      createdAt: { gte: since },
    },
    _sum: {
      value: true,
    },
    _count: true,
  })

  return metrics.reduce((acc, m) => {
    acc[m.metricType] = {
      total: m._sum.value || 0,
      count: m._count,
    }
    return acc
  }, {} as Record<string, { total: number; count: number }>)
}

export async function getMetricsByDay(metricType: MetricType, days: number = 7) {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const metrics = await prisma.$queryRaw<Array<{ date: Date; total: bigint }>>`
    SELECT DATE(created_at) as date, SUM(value) as total
    FROM system_metrics
    WHERE metric_type = ${metricType}
    AND created_at >= ${since}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `

  return metrics.map(m => ({
    date: m.date,
    total: Number(m.total),
  }))
}

export async function getMessageStats() {
  const totalMessages = await prisma.message.count()
  const inboundMessages = await prisma.message.count({ where: { direction: 'inbound' } })
  const outboundMessages = await prisma.message.count({ where: { direction: 'outbound' } })
  const aiResponses = await prisma.message.count({ where: { aiGenerated: true } })

  return {
    totalMessages,
    inboundMessages,
    outboundMessages,
    aiResponses,
  }
}

export async function getTopSenders(limit: number = 10) {
  const topSenders = await prisma.message.groupBy({
    by: ['phoneNumber'],
    where: {
      direction: 'inbound',
    },
    _count: true,
    orderBy: {
      _count: {
        phoneNumber: 'desc',
      },
    },
    take: limit,
  })

  // Buscar nomes dos números autorizados
  const phoneNumbers = topSenders.map(s => s.phoneNumber)
  const authorizedNumbers = await prisma.authorizedNumber.findMany({
    where: {
      phoneNumber: { in: phoneNumbers },
    },
    select: {
      phoneNumber: true,
      name: true,
    },
  })

  const nameMap = new Map(authorizedNumbers.map(a => [a.phoneNumber, a.name]))

  return topSenders.map(sender => ({
    phoneNumber: sender.phoneNumber,
    name: nameMap.get(sender.phoneNumber) || null,
    messageCount: sender._count,
  }))
}

export async function getDashboardStats() {
  const [
    messageStats,
    instanceCount,
    authorizedCount,
    activeInstances,
    metricsSummary,
  ] = await Promise.all([
    getMessageStats(),
    prisma.whatsAppInstance.count(),
    prisma.authorizedNumber.count({ where: { isActive: true } }),
    prisma.whatsAppInstance.count({ where: { status: 'connected' } }),
    getMetricsSummary(7),
  ])

  return {
    ...messageStats,
    instanceCount,
    authorizedCount,
    activeInstances,
    apiRequests: metricsSummary['api_request']?.total || 0,
    aiRequests: metricsSummary['ai_request']?.total || 0,
    errors: metricsSummary['error']?.total || 0,
  }
}
