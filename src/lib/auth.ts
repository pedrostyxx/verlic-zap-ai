import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import prisma from './prisma'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key'
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 dias

export interface JWTPayload {
  userId: string
  email: string
  role: string
}

// Hash de senha
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

// Verificar senha
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// Gerar token JWT
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

// Verificar token JWT
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch {
    return null
  }
}

// Criar sessão no banco
export async function createSession(userId: string): Promise<string> {
  const token = generateToken({
    userId,
    email: '',
    role: 'admin',
  })

  const expiresAt = new Date(Date.now() + SESSION_DURATION)

  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  })

  return token
}

// Obter sessão atual
export async function getCurrentSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value

  if (!token) return null

  const payload = verifyToken(token)
  if (!payload) return null

  // Verificar se sessão existe e não expirou
  const session = await prisma.session.findUnique({
    where: { token },
  })

  if (!session || session.expiresAt < new Date()) {
    return null
  }

  return payload
}

// Fazer login
export async function login(email: string, password: string): Promise<{ token: string; user: { id: string; email: string; name: string } } | null> {
  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user) return null

  const isValid = await verifyPassword(password, user.password)
  if (!isValid) return null

  const token = await createSession(user.id)

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  }
}

// Fazer logout
export async function logout(token: string): Promise<void> {
  await prisma.session.delete({
    where: { token },
  }).catch(() => {})
}

// Criar usuário admin inicial (se não existir)
export async function ensureAdminExists(): Promise<void> {
  try {
    const adminCount = await prisma.user.count()
    
    if (adminCount === 0) {
      const hashedPassword = await hashPassword('admin123')
      await prisma.user.create({
        data: {
          email: 'admin@verlic.ai',
          password: hashedPassword,
          name: 'Administrador',
          role: 'admin',
        },
      })
      console.log('[Auth] Usuário admin criado: admin@verlic.ai / admin123')
    }
  } catch (error) {
    // Ignora erro se usuário já existe (race condition durante build)
    console.log('[Auth] Admin já existe ou erro ao criar:', error)
  }
}

// Verificar se usuário está autenticado (para middleware)
export async function isAuthenticated(): Promise<boolean> {
  const session = await getCurrentSession()
  return session !== null
}
