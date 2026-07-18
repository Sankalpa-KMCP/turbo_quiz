import { forwardRef, type ComponentProps } from 'react'
import { cn } from '../../utils/cn'

export interface InputProps extends ComponentProps<'input'> {
  hasError?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError, type = 'text', 'aria-invalid': ariaInvalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'min-h-11 w-full bg-surface-base border rounded-xl px-4 py-2 text-text-main placeholder:text-text-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
          hasError 
            ? 'border-danger-base focus:border-danger-base focus-visible:ring-danger-base/30' 
            : 'border-border-strong focus:border-border-focus',
          className
        )}
        aria-invalid={ariaInvalid ?? (hasError ? true : undefined)}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'
