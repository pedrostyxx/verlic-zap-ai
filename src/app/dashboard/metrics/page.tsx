'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import {
  MessageSquare,
  Cpu,
  AlertTriangle,
  Activity,
} from 'lucide-react'

interface MetricsData {
  summary: Record<string, { total: number; count: number }>
  messageStats: {
    totalMessages: number
    inboundMessages: number
    outboundMessages: number
    aiResponses: number
  }
  charts: {
    messagesPerDay: Array<{ date: string; total: number }>
    aiRequestsPerDay: Array<{ date: string; total: number }>
  }
  recentErrors: Array<{
    id: string
    createdAt: string
    metadata: Record<string, unknown> | null
  }>
}

export default function MetricsPage() {
  const [data, setData] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMetrics()
  }, [])

  const fetchMetrics = async () => {
    try {
      const res = await fetch('/api/metrics')
      const metricsData = await res.json()
      setData(metricsData)
    } catch (error) {
      console.error('Erro ao carregar métricas:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    )
  }

  const summary = data?.summary || {}
  const messageStats = data?.messageStats || { totalMessages: 0, inboundMessages: 0, outboundMessages: 0, aiResponses: 0 }

  return (
    <div>
      <PageHeader 
        title="Métricas" 
        description="Estatísticas de uso do sistema (últimos 30 dias)"
      />

      {/* Stats principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Mensagens Recebidas"
          value={summary['message_received']?.total || 0}
          icon={MessageSquare}
        />
        <StatCard
          title="Mensagens Enviadas"
          value={summary['message_sent']?.total || 0}
          icon={MessageSquare}
        />
        <StatCard
          title="Requisições IA"
          value={summary['ai_request']?.total || 0}
          icon={Cpu}
        />
        <StatCard
          title="Erros"
          value={summary['error']?.total || 0}
          icon={AlertTriangle}
        />
      </div>

      {/* Detalhes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Atividade por tipo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Atividade por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell header>Tipo</TableCell>
                  <TableCell header className="text-right">Total</TableCell>
                  <TableCell header className="text-right">Ocorrências</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(summary).map(([type, stats]) => (
                  <TableRow key={type}>
                    <TableCell>
                      <Badge variant={type === 'error' ? 'danger' : 'default'}>
                        {type.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {stats.total}
                    </TableCell>
                    <TableCell className="text-right text-zinc-500">
                      {stats.count}
                    </TableCell>
                  </TableRow>
                ))}
                {Object.keys(summary).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-zinc-500 py-8">
                      Nenhuma métrica registrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Erros recentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Erros Recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data?.recentErrors && data.recentErrors.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell header>Quando</TableCell>
                    <TableCell header>Detalhes</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentErrors.map((error) => (
                    <TableRow key={error.id}>
                      <TableCell className="text-zinc-500 text-xs">
                        {formatDate(error.createdAt)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {error.metadata?.error as string || error.metadata?.source as string || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="px-5 py-8 text-center text-zinc-500">
                Nenhum erro registrado
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mensagens por dia */}
      {data?.charts?.messagesPerDay && data.charts.messagesPerDay.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Mensagens por Dia (últimos 7 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-32">
              {data.charts.messagesPerDay.map((day, i) => {
                const maxValue = Math.max(...data.charts.messagesPerDay.map(d => d.total))
                const height = maxValue > 0 ? (day.total / maxValue) * 100 : 0
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div 
                      className="w-full bg-emerald-600 rounded-t"
                      style={{ height: `${height}%`, minHeight: day.total > 0 ? '4px' : '0' }}
                    />
                    <span className="text-xs text-zinc-500">
                      {new Date(day.date).toLocaleDateString('pt-BR', { weekday: 'short' })}
                    </span>
                    <span className="text-xs text-zinc-400 font-medium">{day.total}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
