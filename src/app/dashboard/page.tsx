'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatPhone } from '@/lib/utils'
import {
  MessageSquare,
  Users,
  Smartphone,
  Cpu,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
} from 'lucide-react'

interface DashboardStats {
  totalMessages: number
  inboundMessages: number
  outboundMessages: number
  aiResponses: number
  instanceCount: number
  authorizedCount: number
  activeInstances: number
  apiRequests: number
  aiRequests: number
  errors: number
}

interface RankingItem {
  phoneNumber: string
  name: string | null
  messageCount: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [ranking, setRanking] = useState<RankingItem[]>([])
  const [isMocked, setIsMocked] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [statsRes, rankingRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/messages/ranking'),
      ])

      const statsData = await statsRes.json()
      const rankingData = await rankingRes.json()

      setStats(statsData.stats)
      setIsMocked(statsData.isMocked)
      setRanking(rankingData.ranking || [])
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
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

  return (
    <div>
      <PageHeader 
        title="Dashboard" 
        description="Visão geral do sistema"
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total de Mensagens"
          value={stats?.totalMessages || 0}
          icon={MessageSquare}
          isMocked={isMocked}
        />
        <StatCard
          title="Instâncias Ativas"
          value={`${stats?.activeInstances || 0}/${stats?.instanceCount || 0}`}
          icon={Smartphone}
          isMocked={isMocked}
        />
        <StatCard
          title="Números Autorizados"
          value={stats?.authorizedCount || 0}
          icon={Users}
          isMocked={isMocked}
        />
        <StatCard
          title="Requisições IA"
          value={stats?.aiRequests || 0}
          subtitle="Últimos 7 dias"
          icon={Cpu}
          isMocked={isMocked}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Mensagens Recebidas"
          value={stats?.inboundMessages || 0}
          icon={ArrowDownLeft}
          isMocked={isMocked}
        />
        <StatCard
          title="Mensagens Enviadas"
          value={stats?.outboundMessages || 0}
          icon={ArrowUpRight}
          isMocked={isMocked}
        />
        <StatCard
          title="Erros"
          value={stats?.errors || 0}
          subtitle="Últimos 7 dias"
          icon={AlertTriangle}
          isMocked={isMocked}
        />
      </div>

      {/* Ranking */}
      <Card>
        <CardHeader>
          <CardTitle>Ranking de Mensagens</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ranking.length === 0 ? (
            <div className="px-5 py-8 text-center text-zinc-500">
              Nenhuma mensagem recebida ainda
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell header>#</TableCell>
                  <TableCell header>Número</TableCell>
                  <TableCell header>Nome</TableCell>
                  <TableCell header className="text-right">Mensagens</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranking.slice(0, 10).map((item, index) => (
                  <TableRow key={item.phoneNumber}>
                    <TableCell>
                      <Badge variant={index < 3 ? 'success' : 'default'}>
                        {index + 1}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatPhone(item.phoneNumber)}
                    </TableCell>
                    <TableCell>
                      {item.name || <span className="text-zinc-500">—</span>}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {item.messageCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
