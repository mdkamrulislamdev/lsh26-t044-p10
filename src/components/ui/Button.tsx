import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  children: ReactNode
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-white hover:bg-brand-dark focus-visible:ring-brand disabled:bg-line disabled:text-muted',
  secondary:
    'bg-white text-ink border border-line hover:border-brand hover:text-brand focus-visible:ring-brand',
  ghost: 'bg-transparent text-muted hover:text-ink hover:bg-white/70 focus-visible:ring-brand',
}

export function Button({
  variant = 'primary',
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
