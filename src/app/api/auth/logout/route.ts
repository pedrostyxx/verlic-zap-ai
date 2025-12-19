import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { logout } from '@/lib/auth'
import { redirect } from 'next/navigation'

export async function POST() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value

    if (token) {
      await logout(token)
    }

    cookieStore.delete('session')

    return NextResponse.redirect(new URL('/login', process.env.NEXTAUTH_URL || 'http://localhost:3000'))
  } catch (error) {
    console.error('[Auth] Erro no logout:', error)
    return NextResponse.redirect(new URL('/login', process.env.NEXTAUTH_URL || 'http://localhost:3000'))
  }
}

export async function GET() {
  return POST()
}
