import { forwardRef, type ComponentProps } from 'react'
import { cn } from '../../utils/cn'

export interface CardProps extends ComponentProps<'div'> {
  variant?: 'raised' | 'outlined' | 'ghost'
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'raised', ...props }, ref) => {
    const variants = {
      raised: 'bg-surface-raised border border-border-subtle',
      outlined: 'bg-transparent border border-border-subtle',
      ghost: 'bg-surface-base'
    }

    return (
      <div
        ref={ref}
        className={cn('rounded-lg', variants[variant], className)}
        {...props}
      />
    )
  }
)

Card.displayName = 'Card'
