import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from 'react'
import { cn } from '../../utils/cn'

export interface FieldProps {
  /** Explicit control id. When omitted, a stable generated id is used. */
  id?: string
  label: string
  /** Marks the control as required and shows a non-color-only indicator. */
  required?: boolean
  /** Shows an explicit optional indicator. Ignored when required is true. */
  optional?: boolean
  helperText?: ReactNode
  error?: ReactNode
  className?: string
  /**
   * A single form control (Input, Select, Textarea, or native control).
   * Field injects id / aria relationships without owning validation.
   */
  children: ReactElement
}

type ControlProps = {
  id?: string
  'aria-invalid'?: boolean | 'true' | 'false'
  'aria-describedby'?: string
  'aria-required'?: boolean | 'true' | 'false'
  hasError?: boolean
}

function mergeDescribedBy(...parts: Array<string | undefined>) {
  const merged = parts
    .flatMap((part) => (part ? part.split(/\s+/) : []))
    .filter(Boolean)
  return merged.length > 0 ? Array.from(new Set(merged)).join(' ') : undefined
}

export function Field({
  id,
  label,
  required = false,
  optional = false,
  helperText,
  error,
  className,
  children,
}: FieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const helperId = `${fieldId}-helper`
  const errorId = `${fieldId}-error`
  const showOptional = optional && !required

  if (!isValidElement(children)) {
    throw new Error('Field expects a single React element child as the control.')
  }

  const child = Children.only(children) as ReactElement<ControlProps>
  const controlId = child.props.id ?? fieldId
  const describedBy = mergeDescribedBy(
    helperText ? helperId : undefined,
    error ? errorId : undefined,
    child.props['aria-describedby']
  )

  const control = cloneElement(child, {
    id: controlId,
    'aria-invalid': child.props['aria-invalid'] ?? (error ? true : undefined),
    'aria-describedby': describedBy,
    'aria-required': child.props['aria-required'] ?? (required ? true : undefined),
    hasError: child.props.hasError ?? Boolean(error),
  })

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={controlId} className="block text-sm font-medium text-text-main">
        <span>{label}</span>
        {required ? (
          <span className="ml-1 text-danger-text">
            <span aria-hidden="true">*</span>
            <span className="sr-only"> (required)</span>
          </span>
        ) : null}
        {showOptional ? (
          <span className="ml-1 font-normal text-text-muted">(optional)</span>
        ) : null}
      </label>

      {control}

      {helperText ? (
        <p id={helperId} className="text-xs leading-5 text-text-muted">
          {helperText}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className="text-xs leading-5 text-danger-text" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
