import { type ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface PageHeaderProps {
  title: string
  description?: ReactNode
  eyebrow?: ReactNode
  action?: ReactNode
  className?: string
}

export function PageHeader({ title, description, eyebrow, action, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0 max-w-3xl">
        {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}
        <h1 className="text-2xl font-bold tracking-tight text-text-main sm:text-3xl">{title}</h1>
        {description ? (
          <div className="mt-1.5 text-sm leading-6 text-text-muted">{description}</div>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-3">{action}</div> : null}
    </header>
  )
}
