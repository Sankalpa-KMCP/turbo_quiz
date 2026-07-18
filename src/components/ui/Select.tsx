import { forwardRef, type ComponentProps } from 'react'
import { cn } from '../../utils/cn'

export interface SelectProps extends ComponentProps<'select'> {
  hasError?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, hasError, children, 'aria-invalid': ariaInvalid, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'min-h-11 w-full bg-surface-raised border rounded-lg px-3.5 py-2 text-sm text-text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus/35 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed',
          hasError
            ? 'border-danger-base focus:border-danger-base focus-visible:ring-danger-base/30'
            : 'border-border-strong focus:border-border-focus',
          className
        )}
        aria-invalid={ariaInvalid ?? (hasError ? true : undefined)}
        {...props}
      >
        {children}
      </select>
    )
  }
)

Select.displayName = 'Select'
