import { type ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { Card } from './Card'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description: ReactNode
  action?: ReactNode
  tone?: 'default' | 'success'
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = 'default',
  className
}: EmptyStateProps) {
  return (
    <Card className={cn('px-6 py-8 text-center sm:px-8 sm:py-10', className)}>
      <div className="mx-auto flex max-w-md flex-col items-center">
        {icon ? (
          <div
            className={cn(
              'mb-4 inline-flex size-12 items-center justify-center rounded-lg border',
              tone === 'success'
                ? 'border-success-border bg-success-bg text-success-text'
                : 'border-border-subtle bg-surface-overlay text-text-muted'
            )}
            aria-hidden="true"
          >
            {icon}
          </div>
        ) : null}
        <h2 className="text-lg font-semibold text-text-main">{title}</h2>
        <div className="mt-1.5 text-sm leading-6 text-text-muted">{description}</div>
        {action ? <div className="mt-5 flex flex-wrap justify-center gap-3">{action}</div> : null}
      </div>
    </Card>
  )
}
