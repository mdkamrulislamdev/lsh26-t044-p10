import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

type CardProps = {
  children: ReactNode
  className?: string
  id?: string
}

export function Card({ children, className, id }: CardProps) {
  return (
    <section
      id={id}
      className={cn(
        'rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_0_rgba(26,31,22,0.04)] sm:p-6',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function CardHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-lg font-semibold tracking-tight text-ink sm:text-xl">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
