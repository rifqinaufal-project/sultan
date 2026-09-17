import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  children: ReactNode
}

const variants: Record<ButtonVariant, string> = {
  primary: 'border-transparent bg-zinc-950 text-white hover:bg-zinc-800',
  secondary: 'border-zinc-300 bg-white text-zinc-800 hover:border-zinc-950 hover:bg-zinc-50',
  ghost: 'border-transparent bg-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950',
  danger: 'border-red-200 bg-white text-red-700 hover:border-red-500 hover:bg-red-50',
  icon: 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-950 hover:text-zinc-950',
}

export function Button({ className, variant = 'primary', size = 'md', children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border font-bold whitespace-nowrap transition duration-200 active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' ? 'min-h-9 px-3 text-xs' : 'min-h-11 px-4 text-sm',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
