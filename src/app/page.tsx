import { redirect } from 'next/navigation'
import { getCurrentSession, ensureAdminExists } from '@/lib/auth'

export default async function Home() {
  // Garantir que admin existe
  await ensureAdminExists()
  
  // Verificar autenticação
  const session = await getCurrentSession()
  
  if (session) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
