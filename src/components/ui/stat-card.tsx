'use client'

import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  className?: string
  isMocked?: boolean
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, className, isMocked }: StatCardProps) {
  return (
    <div className={cn('bg-zinc-900 border border-zinc-800 rounded-lg p-5', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-zinc-400">{title}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-semibold text-zinc-100">{value}</p>
            {trend && (
              <span className={cn('text-xs font-medium', trend.isPositive ? 'text-emerald-400' : 'text-red-400')}>
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>
          )}
          {isMocked && (
            <p className="text-xs text-yellow-500 mt-1">⚠ Dados simulados</p>
          )}
        </div>
        {Icon && (
          <div className="p-2 bg-zinc-800 rounded-lg">
            <Icon className="w-5 h-5 text-zinc-400" />
          </div>
        )}
      </div>
    </div>
  )
}
