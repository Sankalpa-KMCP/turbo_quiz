import { forwardRef, type ComponentProps } from 'react'
import { cn } from '../../utils/cn'

export interface BadgeProps extends ComponentProps<'span'> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-surface-overlay text-text-muted border-border-subtle',
      primary: 'bg-primary-bg text-primary-text border-primary-base/25',
      success: 'bg-success-bg text-success-text border-success-border',
      warning: 'bg-warning-bg text-warning-text border-warning-border',
      danger: 'bg-danger-bg text-danger-text border-danger-border'
    }

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
          variants[variant],
          className
        )}
        {...props}
      />
    )
  }
)

Badge.displayName = 'Badge'
