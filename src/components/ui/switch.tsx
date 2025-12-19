'use client'

import { cn } from '@/lib/utils'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
  className?: string
}

export function Switch({ checked, onChange, disabled, label, className }: SwitchProps) {
  return (
    <label className={cn('flex items-center gap-3 cursor-pointer', disabled && 'cursor-not-allowed opacity-50', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
          checked ? 'bg-emerald-600' : 'bg-zinc-700',
          'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-900'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
      {label && <span className="text-sm text-zinc-300">{label}</span>}
    </label>
  )
}
