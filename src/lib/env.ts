// Validação de variáveis de ambiente
export interface EnvStatus {
  isValid: boolean
  missing: string[]
  warnings: string[]
}

export const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
] as const

export const optionalEnvVars = [
  'REDIS_URL',
  'EVOLUTION_API_URL',
  'EVOLUTION_API_KEY',
  'DEEPSEEK_API_KEY',
  'DEEPSEEK_API_URL',
] as const

export function validateEnv(): EnvStatus {
  const missing: string[] = []
  const warnings: string[] = []

  // Verificar obrigatórias
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar)
    }
  }

  // Verificar opcionais (avisos)
  if (!process.env.EVOLUTION_API_URL || !process.env.EVOLUTION_API_KEY) {
    warnings.push('Evolution API não configurada - funcionalidades WhatsApp desabilitadas')
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    warnings.push('DeepSeek API não configurada - respostas AI desabilitadas')
  }

  if (!process.env.REDIS_URL) {
    warnings.push('Redis não configurado - cache desabilitado')
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
  }
}

export function getEnvStatus() {
  return {
    database: !!process.env.DATABASE_URL,
    redis: !!process.env.REDIS_URL,
    evolutionApi: !!(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY),
    deepseek: !!process.env.DEEPSEEK_API_KEY,
    jwt: !!process.env.JWT_SECRET,
  }
}

export function isEvolutionConfigured(): boolean {
  return !!(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY)
}

export function isDeepSeekConfigured(): boolean {
  return !!process.env.DEEPSEEK_API_KEY
}

export function isRedisConfigured(): boolean {
  return !!process.env.REDIS_URL
}
