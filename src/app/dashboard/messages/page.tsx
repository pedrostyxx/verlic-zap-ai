'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatPhone, formatRelativeTime, truncateText } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Message {
  id: string
  phoneNumber: string
  direction: string
  content: string
  status: string
  aiGenerated: boolean
  createdAt: string
  instance: {
    instanceName: string
  }
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMessages(1)
  }, [])

  const fetchMessages = async (page: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/messages?page=${page}&limit=50`)
      const data = await res.json()
      setMessages(data.messages || [])
      setPagination(data.pagination)
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDirectionBadge = (direction: string) => {
    return direction === 'inbound' 
      ? <Badge variant="info">Recebida</Badge>
      : <Badge variant="success">Enviada</Badge>
  }

  return (
    <div>
      <PageHeader 
        title="Mensagens" 
        description={`${pagination.total} mensagens no total`}
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="px-5 py-8 text-center text-zinc-500">
              Nenhuma mensagem encontrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell header>Direção</TableCell>
                  <TableCell header>Número</TableCell>
                  <TableCell header>Conteúdo</TableCell>
                  <TableCell header>Instância</TableCell>
                  <TableCell header>IA</TableCell>
                  <TableCell header>Quando</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((message) => (
                  <TableRow key={message.id}>
                    <TableCell>{getDirectionBadge(message.direction)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatPhone(message.phoneNumber)}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <span title={message.content}>
                        {truncateText(message.content, 50)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge>{message.instance.instanceName}</Badge>
                    </TableCell>
                    <TableCell>
                      {message.aiGenerated && (
                        <Badge variant="warning">IA</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-zinc-500">
                      {formatRelativeTime(message.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Paginação */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-zinc-400">
            Página {pagination.page} de {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fetchMessages(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fetchMessages(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
