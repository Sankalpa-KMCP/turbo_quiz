import { forwardRef, type ComponentProps } from 'react'
import { cn } from '../../utils/cn'

export interface AlertProps extends ComponentProps<'div'> {
  variant?: 'info' | 'success' | 'warning' | 'danger'
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'info', role = 'alert', ...props }, ref) => {
    const variants = {
      info: 'bg-surface-overlay text-text-main border-border-subtle',
      success: 'bg-success-bg text-success-text border-success-border',
      warning: 'bg-warning-bg text-warning-text border-warning-border',
      danger: 'bg-danger-bg text-danger-text border-danger-border'
    }

    return (
      <div
        ref={ref}
        role={role}
        className={cn(
          'px-4 py-3 rounded-xl border flex items-start text-sm leading-6',
          variants[variant],
          className
        )}
        {...props}
      />
    )
  }
)

Alert.displayName = 'Alert'
