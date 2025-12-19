'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Alert } from '@/components/ui/alert'
import { formatPhone, formatDate } from '@/lib/utils'
import { Plus, Trash2 } from 'lucide-react'

interface AuthorizedNumber {
  id: string
  phoneNumber: string
  name: string | null
  isActive: boolean
  createdAt: string
  instance: {
    instanceName: string
  }
  _count: {
    messages: number
  }
}

interface Instance {
  id: string
  instanceName: string
}

export default function AuthorizedPage() {
  const [numbers, setNumbers] = useState<AuthorizedNumber[]>([])
  const [instances, setInstances] = useState<Instance[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newNumber, setNewNumber] = useState({ phoneNumber: '', name: '', instanceId: '' })
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [numbersRes, instancesRes] = await Promise.all([
        fetch('/api/authorized'),
        fetch('/api/instances'),
      ])
      const numbersData = await numbersRes.json()
      const instancesData = await instancesRes.json()
      
      setNumbers(numbersData.numbers || [])
      setInstances(instancesData.instances || [])
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const addNumber = async () => {
    if (!newNumber.phoneNumber || !newNumber.instanceId) return
    
    setAdding(true)
    try {
      const res = await fetch('/api/authorized', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNumber),
      })

      if (res.ok) {
        setNewNumber({ phoneNumber: '', name: '', instanceId: '' })
        setShowAdd(false)
        fetchData()
      }
    } catch (error) {
      console.error('Erro ao adicionar número:', error)
    } finally {
      setAdding(false)
    }
  }

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      await fetch('/api/authorized', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive }),
      })
      fetchData()
    } catch (error) {
      console.error('Erro ao atualizar:', error)
    }
  }

  const deleteNumber = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este número?')) return

    try {
      await fetch(`/api/authorized?id=${id}`, { method: 'DELETE' })
      fetchData()
    } catch (error) {
      console.error('Erro ao remover número:', error)
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
        title="Números Autorizados" 
        description="Números que podem interagir com o bot"
        actions={
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Número
          </Button>
        }
      />

      {/* Modal adicionar */}
      {showAdd && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Adicionar Número</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                placeholder="Número (ex: 5511999999999)"
                value={newNumber.phoneNumber}
                onChange={(e) => setNewNumber({ ...newNumber, phoneNumber: e.target.value })}
              />
              <Input
                placeholder="Nome (opcional)"
                value={newNumber.name}
                onChange={(e) => setNewNumber({ ...newNumber, name: e.target.value })}
              />
              <select
                value={newNumber.instanceId}
                onChange={(e) => setNewNumber({ ...newNumber, instanceId: e.target.value })}
                className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100"
              >
                <option value="">Selecione a instância</option>
                {instances.map((instance) => (
                  <option key={instance.id} value={instance.id}>
                    {instance.instanceName}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 mt-4">
              <Button onClick={addNumber} loading={adding}>
                Adicionar
              </Button>
              <Button variant="ghost" onClick={() => setShowAdd(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {instances.length === 0 ? (
        <Alert type="warning">
          Crie uma instância primeiro antes de adicionar números autorizados.
        </Alert>
      ) : numbers.length === 0 ? (
        <Alert type="info">
          Nenhum número autorizado. Adicione números para permitir interação com o bot.
        </Alert>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell header>Número</TableCell>
                  <TableCell header>Nome</TableCell>
                  <TableCell header>Instância</TableCell>
                  <TableCell header>Mensagens</TableCell>
                  <TableCell header>Ativo</TableCell>
                  <TableCell header></TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {numbers.map((number) => (
                  <TableRow key={number.id}>
                    <TableCell className="font-mono text-xs">
                      {formatPhone(number.phoneNumber)}
                    </TableCell>
                    <TableCell>
                      {number.name || <span className="text-zinc-500">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge>{number.instance.instanceName}</Badge>
                    </TableCell>
                    <TableCell>{number._count.messages}</TableCell>
                    <TableCell>
                      <Switch
                        checked={number.isActive}
                        onChange={(checked) => toggleActive(number.id, checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteNumber(number.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
