interface LoadingStateProps {
  label?: string
  compact?: boolean
}

export function LoadingState({ label = 'Loading…', compact = false }: LoadingStateProps) {
  return (
    <div
      className={compact
        ? 'flex min-h-40 flex-col items-center justify-center gap-4 text-center'
        : 'flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center'}
      role="status"
      aria-live="polite"
    >
      <div
        className="size-9 animate-spin rounded-full border-2 border-border-strong border-t-primary-base"
        aria-hidden="true"
      />
      <p className="text-sm text-text-muted">{label}</p>
    </div>
  )
}
