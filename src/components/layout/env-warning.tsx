'use client'

import { Alert } from '@/components/ui/alert'

interface EnvWarningProps {
  status: {
    database: boolean
    redis: boolean
    evolutionApi: boolean
    deepseek: boolean
  }
}

export function EnvWarning({ status }: EnvWarningProps) {
  const warnings: string[] = []

  if (!status.evolutionApi) {
    warnings.push('Evolution API não configurada')
  }
  if (!status.deepseek) {
    warnings.push('DeepSeek API não configurada')
  }
  if (!status.redis) {
    warnings.push('Redis não configurado')
  }

  if (warnings.length === 0) return null

  return (
    <Alert type="warning" className="mb-6">
      <span className="font-medium">Configuração incompleta:</span> {warnings.join(' • ')}. 
      Alguns dados podem estar sendo simulados para visualização.
    </Alert>
  )
}
