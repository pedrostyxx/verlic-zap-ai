import { NextResponse } from 'next/server'
import { getDashboardStats } from '@/lib/metrics'
import { getEnvStatus } from '@/lib/env'

export async function GET() {
  try {
    const envStatus = getEnvStatus()
    
    // Se o banco não estiver configurado, retornar dados mockados
    if (!envStatus.database) {
      return NextResponse.json({
        stats: {
          totalMessages: 0,
          inboundMessages: 0,
          outboundMessages: 0,
          aiResponses: 0,
          instanceCount: 0,
          authorizedCount: 0,
          activeInstances: 0,
          apiRequests: 0,
          aiRequests: 0,
          errors: 0,
        },
        envStatus,
        isMocked: true,
      })
    }

    const stats = await getDashboardStats()

    return NextResponse.json({
      stats,
      envStatus,
      isMocked: false,
    })
  } catch (error) {
    console.error('[Dashboard] Erro ao obter stats:', error)
    return NextResponse.json(
      { 
        error: 'Erro ao obter estatísticas',
        envStatus: getEnvStatus(),
        isMocked: true,
        stats: {
          totalMessages: 0,
          inboundMessages: 0,
          outboundMessages: 0,
          aiResponses: 0,
          instanceCount: 0,
          authorizedCount: 0,
          activeInstances: 0,
          apiRequests: 0,
          aiRequests: 0,
          errors: 0,
        },
      },
      { status: 200 }
    )
  }
}
