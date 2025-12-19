import Redis from 'ioredis'

const getRedisClient = () => {
  const redisUrl = process.env.REDIS_URL

  if (!redisUrl) {
    console.warn('[Redis] REDIS_URL não configurada - cache desabilitado')
    return null
  }

  try {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    })

    client.on('error', (err) => {
      console.error('[Redis] Erro de conexão:', err.message)
    })

    client.on('connect', () => {
      console.log('[Redis] Conectado com sucesso')
    })

    return client
  } catch (error) {
    console.error('[Redis] Falha ao criar cliente:', error)
    return null
  }
}

const globalForRedis = globalThis as unknown as {
  redis: Redis | null | undefined
}

export const redis = globalForRedis.redis ?? getRedisClient()

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis

// Cache helpers
export const cacheGet = async <T>(key: string): Promise<T | null> => {
  if (!redis) return null
  try {
    const data = await redis.get(key)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

export const cacheSet = async (key: string, value: unknown, ttlSeconds = 300): Promise<void> => {
  if (!redis) return
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
  } catch (error) {
    console.error('[Redis] Erro ao salvar cache:', error)
  }
}

export const cacheDel = async (key: string): Promise<void> => {
  if (!redis) return
  try {
    await redis.del(key)
  } catch (error) {
    console.error('[Redis] Erro ao deletar cache:', error)
  }
}

export const cacheDelPattern = async (pattern: string): Promise<void> => {
  if (!redis) return
  try {
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  } catch (error) {
    console.error('[Redis] Erro ao deletar pattern:', error)
  }
}

export default redis
