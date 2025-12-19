'use client'

import { ReactNode } from 'react'
import { Sidebar } from './sidebar'
import { EnvWarning } from './env-warning'

interface DashboardLayoutProps {
  children: ReactNode
  envStatus?: {
    database: boolean
    redis: boolean
    evolutionApi: boolean
    deepseek: boolean
  }
}

export function DashboardLayout({ children, envStatus }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-zinc-950">
      <Sidebar />
      <main className="lg:pl-64 pt-14 lg:pt-0">
        <div className="p-6 lg:p-8">
          {envStatus && <EnvWarning status={envStatus} />}
          {children}
        </div>
      </main>
    </div>
  )
}
