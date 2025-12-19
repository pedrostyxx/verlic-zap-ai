import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Rotas públicas que não precisam de autenticação
const publicRoutes = ['/login', '/api/auth/login', '/api/webhook/evolution']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Permitir rotas públicas
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Permitir arquivos estáticos
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.includes('.')) {
    return NextResponse.next()
  }

  // Verificar cookie de sessão
  const session = request.cookies.get('session')?.value

  if (!session) {
    // Se for API, retornar 401
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    
    // Se for página, redirecionar para login
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
