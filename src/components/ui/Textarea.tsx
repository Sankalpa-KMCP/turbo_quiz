import { forwardRef, type ComponentProps } from 'react'
import { cn } from '../../utils/cn'

export interface TextareaProps extends ComponentProps<'textarea'> {
  hasError?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, hasError, 'aria-invalid': ariaInvalid, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full bg-surface-raised border rounded-lg px-3.5 py-3 text-sm text-text-main placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus/35 transition-colors min-h-[112px] resize-y disabled:opacity-60 disabled:cursor-not-allowed',
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

Textarea.displayName = 'Textarea'
