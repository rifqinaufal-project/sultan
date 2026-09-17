import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export const inputClassName = 'mt-2 min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-3 focus:ring-zinc-950/10 sm:text-sm'

export function FormField({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('grid gap-0 text-xs font-bold text-zinc-700', className)}>
      {label}
      {children}
      {hint && <span className="mt-1.5 font-normal leading-relaxed text-zinc-500">{hint}</span>}
    </label>
  )
}
