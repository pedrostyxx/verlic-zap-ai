import { redirect } from 'next/navigation'
import { getCurrentSession, ensureAdminExists } from '@/lib/auth'
import { getEnvStatus } from '@/lib/env'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

export default async function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  // Garantir que admin existe
  await ensureAdminExists()

  // Verificar autenticação
  const session = await getCurrentSession()
  if (!session) {
    redirect('/login')
  }

  const envStatus = getEnvStatus()

  return (
    <DashboardLayout envStatus={envStatus}>
      {children}
    </DashboardLayout>
  )
}
