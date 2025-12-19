'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { ConnectionModal } from '@/components/whatsapp/connection-modal'
import { Plus, Trash2, RefreshCw, Power, PowerOff, QrCode, Smartphone } from 'lucide-react'

interface Instance {
  id: string
  instanceName: string
  phoneNumber: string | null
  status: string
  qrCode: string | null
  isActive: boolean
  createdAt: string
  _count: {
    messages: number
    authorizedNumbers: number
  }
}

export default function InstancesPage() {
  const [instances, setInstances] = useState<Instance[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newInstanceName, setNewInstanceName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [connectionModal, setConnectionModal] = useState<{ instanceId: string; instanceName: string } | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchInstances()
  }, [])

  const fetchInstances = async () => {
    try {
      const res = await fetch('/api/instances')
      const data = await res.json()
      setInstances(data.instances || [])
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error)
    } finally {
      setLoading(false)
    }
  }

  const createInstance = async () => {
    if (!newInstanceName.trim()) return
    
    setCreating(true)
    try {
      const res = await fetch('/api/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName: newInstanceName.trim() }),
      })

      if (res.ok) {
        const data = await res.json()
        setNewInstanceName('')
        setShowCreate(false)
        await fetchInstances()
        
        // Abrir modal de conexão automaticamente após criar
        if (data.instance) {
          setConnectionModal({ 
            instanceId: data.instance.id, 
            instanceName: data.instance.instanceName 
          })
        }
      }
    } catch (error) {
      console.error('Erro ao criar instância:', error)
    } finally {
      setCreating(false)
    }
  }

  const deleteInstance = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta instância?')) return

    setActionLoading(id)
    try {
      await fetch(`/api/instances?id=${id}`, { method: 'DELETE' })
      fetchInstances()
    } catch (error) {
      console.error('Erro ao excluir instância:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const performAction = async (id: string, action: string, instanceName?: string) => {
    setActionLoading(id)
    try {
      await fetch(`/api/instances/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      
      if (action === 'connect' && instanceName) {
        // Abrir modal de conexão
        setConnectionModal({ instanceId: id, instanceName })
      }
      
      await fetchInstances()
    } catch (error) {
      console.error('Erro na ação:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const openConnectionModal = (instance: Instance) => {
    setConnectionModal({ 
      instanceId: instance.id, 
      instanceName: instance.instanceName 
    })
  }

  const handleConnectionSuccess = () => {
    fetchInstances()
    setConnectionModal(null)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
      case 'open':
        return <Badge variant="success">Conectado</Badge>
      case 'connecting':
        return <Badge variant="warning">Conectando</Badge>
      default:
        return <Badge variant="danger">Desconectado</Badge>
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
        title="Instâncias WhatsApp" 
        description="Gerencie suas conexões com o WhatsApp"
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Instância
          </Button>
        }
      />

      {/* Modal de criar */}
      {showCreate && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Nova Instância</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                placeholder="Nome da instância (ex: vendas-01)"
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createInstance()}
                className="flex-1"
              />
              <Button onClick={createInstance} loading={creating}>
                Criar
              </Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de Conexão com QR Code */}
      {connectionModal && (
        <ConnectionModal
          instanceId={connectionModal.instanceId}
          instanceName={connectionModal.instanceName}
          onClose={() => setConnectionModal(null)}
          onConnected={handleConnectionSuccess}
        />
      )}

      {/* Lista de instâncias */}
      {instances.length === 0 ? (
        <Alert type="info">
          Nenhuma instância configurada. Crie uma nova instância para começar.
        </Alert>
      ) : (
        <div className="grid gap-4">
          {instances.map((instance) => (
            <Card key={instance.id} className="hover:border-zinc-700 transition-colors">
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-zinc-800">
                        <Smartphone className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-zinc-100">{instance.instanceName}</h3>
                        {instance.phoneNumber && (
                          <p className="text-sm text-zinc-500">
                            {instance.phoneNumber}
                          </p>
                        )}
                      </div>
                      {getStatusBadge(instance.status)}
                    </div>
                    <div className="flex gap-4 text-sm text-zinc-400 mt-3">
                      <span className="flex items-center gap-1">
                        <span className="text-zinc-500">Números:</span>
                        {instance._count.authorizedNumbers}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="text-zinc-500">Mensagens:</span>
                        {instance._count.messages}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {instance.status !== 'connected' && instance.status !== 'open' && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openConnectionModal(instance)}
                          disabled={actionLoading === instance.id}
                        >
                          <QrCode className="w-4 h-4 mr-1" />
                          QR Code
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => performAction(instance.id, 'connect', instance.instanceName)}
                          disabled={actionLoading === instance.id}
                        >
                          <Power className="w-4 h-4 mr-1" />
                          Conectar
                        </Button>
                      </>
                    )}
                    
                    {(instance.status === 'connected' || instance.status === 'open') && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => performAction(instance.id, 'disconnect')}
                        disabled={actionLoading === instance.id}
                      >
                        <PowerOff className="w-4 h-4 mr-1" />
                        Desconectar
                      </Button>
                    )}
                    
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => performAction(instance.id, 'restart')}
                      disabled={actionLoading === instance.id}
                      title="Reiniciar instância"
                    >
                      <RefreshCw className={`w-4 h-4 ${actionLoading === instance.id ? 'animate-spin' : ''}`} />
                    </Button>
                    
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => deleteInstance(instance.id)}
                      disabled={actionLoading === instance.id}
                      title="Excluir instância"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}