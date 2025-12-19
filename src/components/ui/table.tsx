'use client'

import { cn } from '@/lib/utils'

interface TableProps {
  children: React.ReactNode
  className?: string
}

export function Table({ children, className }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full text-left', className)}>
        {children}
      </table>
    </div>
  )
}

export function TableHeader({ children, className }: TableProps) {
  return (
    <thead className={cn('border-b border-zinc-800', className)}>
      {children}
    </thead>
  )
}

export function TableBody({ children, className }: TableProps) {
  return (
    <tbody className={cn('divide-y divide-zinc-800', className)}>
      {children}
    </tbody>
  )
}

export function TableRow({ children, className }: TableProps) {
  return (
    <tr className={cn('hover:bg-zinc-800/50', className)}>
      {children}
    </tr>
  )
}

interface TableCellProps {
  children?: React.ReactNode
  className?: string
  header?: boolean
  colSpan?: number
}

export function TableCell({ children, className, header, colSpan }: TableCellProps) {
  if (header) {
    return (
      <th colSpan={colSpan} className={cn('px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider', className)}>
        {children}
      </th>
    )
  }
  
  return (
    <td colSpan={colSpan} className={cn('px-4 py-3 text-sm text-zinc-300', className)}>
      {children}
    </td>
  )
}
