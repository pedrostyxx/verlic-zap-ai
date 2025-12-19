'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Save, Database, Key, Server, Cpu } from 'lucide-react'

interface EnvStatus {
  database: boolean
  redis: boolean
  evolutionApi: boolean
  deepseek: boolean
}

export default function SettingsPage() {
  const [configs, setConfigs] = useState<Record<string, string>>({})
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [configsRes, statsRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/dashboard/stats'),
      ])
      
      const configsData = await configsRes.json()
      const statsData = await statsRes.json()
      
      setConfigs(configsData.configs || {})
      setEnvStatus(statsData.envStatus)
      setSystemPrompt(configsData.configs?.system_prompt || '')
    } catch (error) {
      console.error('Erro ao carregar configurações:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async (key: string, value: string) => {
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })
      setConfigs({ ...configs, [key]: value })
    } catch (error) {
      console.error('Erro ao salvar:', error)
    } finally {
      setSaving(false)
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
        title="Configurações" 
        description="Configurações do sistema"
      />

      {/* Status das variáveis de ambiente */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Status das Integrações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-3 bg-zinc-800 rounded-lg">
              <Database className="w-5 h-5 text-zinc-400" />
              <div>
                <p className="text-sm text-zinc-300">Database</p>
                <Badge variant={envStatus?.database ? 'success' : 'danger'}>
                  {envStatus?.database ? 'Conectado' : 'Erro'}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-zinc-800 rounded-lg">
              <Server className="w-5 h-5 text-zinc-400" />
              <div>
                <p className="text-sm text-zinc-300">Redis</p>
                <Badge variant={envStatus?.redis ? 'success' : 'warning'}>
                  {envStatus?.redis ? 'Conectado' : 'Não configurado'}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-zinc-800 rounded-lg">
              <Key className="w-5 h-5 text-zinc-400" />
              <div>
                <p className="text-sm text-zinc-300">Evolution API</p>
                <Badge variant={envStatus?.evolutionApi ? 'success' : 'warning'}>
                  {envStatus?.evolutionApi ? 'Configurado' : 'Não configurado'}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-zinc-800 rounded-lg">
              <Cpu className="w-5 h-5 text-zinc-400" />
              <div>
                <p className="text-sm text-zinc-300">DeepSeek</p>
                <Badge variant={envStatus?.deepseek ? 'success' : 'warning'}>
                  {envStatus?.deepseek ? 'Configurado' : 'Não configurado'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prompt do sistema */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Prompt do Sistema (IA)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-400 mb-4">
            Defina o comportamento padrão do assistente IA para todas as conversas.
          </p>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Você é um assistente virtual profissional e prestativo..."
            className="w-full h-32 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <Button 
            className="mt-4" 
            onClick={() => saveConfig('system_prompt', systemPrompt)}
            loading={saving}
          >
            <Save className="w-4 h-4 mr-2" />
            Salvar Prompt
          </Button>
        </CardContent>
      </Card>

      {/* Instruções */}
      <Alert type="info">
        <strong>Variáveis de ambiente:</strong> As configurações de conexão (DATABASE_URL, REDIS_URL, EVOLUTION_API_URL, etc.) 
        devem ser definidas no arquivo <code className="bg-zinc-800 px-1 rounded">.env</code> e requerem reinício da aplicação.
      </Alert>
    </div>
  )
}
