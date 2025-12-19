'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  RefreshCw, 
  Trash2,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  Filter
} from 'lucide-react'

interface WebhookLog {
  id: string
  instanceName: string | null
  event: string
  payload: string
  processed: boolean
  error: string | null
  createdAt: string
}

export default function WebhooksPage() {
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [eventFilter, setEventFilter] = useState('')
  const [instanceFilter, setInstanceFilter] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  
  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.set('limit', '50')
      if (eventFilter) params.set('event', eventFilter)
      if (instanceFilter) params.set('instance', instanceFilter)
      
      const response = await fetch(`/api/webhooks/logs?${params}`)
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs || [])
      }
    } catch (error) {
      console.error('Erro ao buscar logs:', error)
    } finally {
      setLoading(false)
    }
  }, [eventFilter, instanceFilter])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 3000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, fetchLogs])

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleClearLogs = async () => {
    if (!confirm('Limpar logs com mais de 7 dias?')) return
    
    try {
      const response = await fetch('/api/webhooks/logs?days=7', { method: 'DELETE' })
      if (response.ok) {
        const data = await response.json()
        alert(`${data.deleted} logs removidos`)
        fetchLogs()
      }
    } catch (error) {
      console.error('Erro ao limpar logs:', error)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getEventColor = (event: string) => {
    if (event.includes('MESSAGE')) return 'bg-blue-500/20 text-blue-400'
    if (event.includes('CONNECTION')) return 'bg-green-500/20 text-green-400'
    if (event.includes('QRCODE')) return 'bg-yellow-500/20 text-yellow-400'
    return 'bg-gray-500/20 text-gray-400'
  }

  const formatPayload = (payload: string) => {
    try {
      const parsed = JSON.parse(payload)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return payload
    }
  }

  const uniqueEvents = [...new Set(logs.map(l => l.event))]
  const uniqueInstances = [...new Set(logs.map(l => l.instanceName).filter(Boolean))]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Webhook Logs</h1>
          <p className="text-gray-400 mt-1">
            Últimos webhooks recebidos da Evolution API
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              autoRefresh 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <RefreshCw className={`w-5 h-5 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto (3s)' : 'Auto Refresh'}
          </button>
          <button
            onClick={fetchLogs}
            className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Atualizar
          </button>
          <button
            onClick={handleClearLogs}
            className="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 flex items-center gap-2"
          >
            <Trash2 className="w-5 h-5" />
            Limpar Antigos
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-gray-800/50 rounded-lg p-4 flex gap-4 items-center">
        <Filter className="w-5 h-5 text-gray-400" />
        <div className="flex gap-4">
          <select
            value={eventFilter}
            onChange={e => setEventFilter(e.target.value)}
            className="bg-gray-700 text-white rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Todos os eventos</option>
            {uniqueEvents.map(event => (
              <option key={event} value={event}>{event}</option>
            ))}
          </select>
          <select
            value={instanceFilter}
            onChange={e => setInstanceFilter(e.target.value)}
            className="bg-gray-700 text-white rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Todas as instâncias</option>
            {uniqueInstances.map(instance => (
              <option key={instance} value={instance || ''}>{instance}</option>
            ))}
          </select>
        </div>
        <span className="text-gray-400 text-sm ml-auto">
          {logs.length} logs encontrados
        </span>
      </div>

      {/* Lista de Logs */}
      <div className="space-y-2">
        {logs.length === 0 ? (
          <div className="bg-gray-800/50 rounded-lg p-8 text-center">
            <p className="text-gray-400">Nenhum webhook recebido ainda</p>
            <p className="text-gray-500 text-sm mt-2">
              Os webhooks aparecerão aqui assim que a Evolution API enviar eventos
            </p>
          </div>
        ) : (
          logs.map(log => (
            <div
              key={log.id}
              className="bg-gray-800/50 rounded-lg overflow-hidden"
            >
              {/* Header do Log */}
              <div
                onClick={() => toggleExpand(log.id)}
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-700/50 transition-colors"
              >
                {expandedIds.has(log.id) ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
                
                <span className={`px-2 py-1 rounded text-xs font-medium ${getEventColor(log.event)}`}>
                  {log.event}
                </span>
                
                <span className="text-gray-400 text-sm">
                  {log.instanceName || 'N/A'}
                </span>
                
                <span className="text-gray-500 text-sm ml-auto">
                  {formatDate(log.createdAt)}
                </span>
                
                {log.processed ? (
                  log.error ? (
                    <span title={log.error}>
                      <XCircle className="w-5 h-5 text-red-400" />
                    </span>
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  )
                ) : (
                  <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                )}
              </div>

              {/* Payload Expandido */}
              {expandedIds.has(log.id) && (
                <div className="border-t border-gray-700 p-4">
                  {log.error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                      <p className="text-red-400 text-sm font-medium">Erro:</p>
                      <p className="text-red-300 text-sm mt-1">{log.error}</p>
                    </div>
                  )}
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-gray-300 text-xs font-mono whitespace-pre-wrap">
                      {formatPayload(log.payload)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
