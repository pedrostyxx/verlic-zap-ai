'use client'

import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AlertProps {
  type?: 'info' | 'success' | 'warning' | 'error'
  title?: string
  children: React.ReactNode
  onClose?: () => void
  className?: string
}

export function Alert({ type = 'info', title, children, onClose, className }: AlertProps) {
  const styles = {
    info: {
      container: 'bg-blue-900/20 border-blue-800 text-blue-300',
      icon: Info,
    },
    success: {
      container: 'bg-emerald-900/20 border-emerald-800 text-emerald-300',
      icon: CheckCircle,
    },
    warning: {
      container: 'bg-yellow-900/20 border-yellow-800 text-yellow-300',
      icon: AlertTriangle,
    },
    error: {
      container: 'bg-red-900/20 border-red-800 text-red-300',
      icon: AlertTriangle,
    },
  }

  const { container, icon: Icon } = styles[type]

  return (
    <div className={cn('flex items-start gap-3 p-4 border rounded-lg', container, className)}>
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {title && <p className="font-medium mb-1">{title}</p>}
        <div className="text-sm opacity-90">{children}</div>
      </div>
      {onClose && (
        <button onClick={onClose} className="p-1 hover:opacity-70">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
