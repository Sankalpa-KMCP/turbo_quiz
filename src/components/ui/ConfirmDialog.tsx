import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../utils/cn'
import { Button } from './Button'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Visual and semantic tone for the confirm action. */
  tone?: 'default' | 'destructive'
  /** Disables confirm and shows pending affordance; caller retains open state. */
  pending?: boolean
  /** Disables the confirm action without implying a pending request. */
  disabled?: boolean
  onConfirm: () => void
  onCancel: () => void
  /** When false, Escape does not invoke onCancel. Defaults to true. */
  closeOnEscape?: boolean
  /** When false, backdrop clicks do not invoke onCancel. Defaults to true. */
  closeOnBackdrop?: boolean
  className?: string
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  pending = false,
  disabled = false,
  onConfirm,
  onCancel,
  closeOnEscape = true,
  closeOnBackdrop = true,
  className,
}: ConfirmDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const confirmGuardRef = useRef(false)

  const confirmDisabled = pending || disabled

  useLayoutEffect(() => {
    if (!open) {
      confirmGuardRef.current = false
      return
    }

    const active = document.activeElement
    restoreFocusRef.current = active instanceof HTMLElement ? active : null
    cancelRef.current?.focus()
  }, [open])

  useLayoutEffect(() => {
    if (open) return

    const previous = restoreFocusRef.current
    restoreFocusRef.current = null
    if (previous && document.contains(previous) && typeof previous.focus === 'function') {
      previous.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!closeOnEscape || pending) return
        event.preventDefault()
        onCancel()
        return
      }

      if (event.key !== 'Tab' || !panelRef.current) return

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true')

      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault()
          last.focus()
        }
      } else if (document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, closeOnEscape, pending, onCancel])

  if (!open || typeof document === 'undefined') {
    return null
  }

  const handleConfirm = () => {
    if (confirmDisabled || confirmGuardRef.current) return
    confirmGuardRef.current = true
    onConfirm()
  }

  const handleBackdropClick = () => {
    if (!closeOnBackdrop || pending) return
    onCancel()
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-text-main/40"
        aria-hidden="true"
        onClick={handleBackdropClick}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          'relative z-10 w-full max-w-md max-h-[min(90dvh,40rem)] overflow-y-auto rounded-lg border border-border-subtle bg-surface-raised p-5 shadow-lg outline-none sm:p-6',
          className
        )}
      >
        <div className="space-y-2">
          <h2 id={titleId} className="font-serif text-xl font-semibold tracking-tight text-text-main">
            {title}
          </h2>
          {description ? (
            <div id={descriptionId} className="text-sm leading-6 text-text-muted">
              {description}
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={pending}
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            variant={tone === 'destructive' ? 'danger' : 'primary'}
            onClick={handleConfirm}
            disabled={confirmDisabled}
            aria-busy={pending || undefined}
          >
            {pending ? `${confirmLabel}…` : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
