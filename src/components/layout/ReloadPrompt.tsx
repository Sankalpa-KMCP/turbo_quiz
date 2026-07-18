import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '../ui/Button'
import { cn } from '../../utils/cn'

export function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      console.log('SW Registered: ', r)
    },
    onRegisterError(error: Error) {
      console.log('SW registration error', error)
    },
  })

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  if (!offlineReady && !needRefresh) return null

  return (
    <div
      className={cn(
        'fixed inset-x-4 bottom-4 z-50 max-w-sm rounded-lg border border-border-subtle bg-surface-raised p-4 shadow-sm',
        'sm:inset-x-auto sm:right-4',
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm leading-relaxed text-text-main">
          {offlineReady
            ? 'App is ready to work offline.'
            : 'A new version is available. Reload to update.'}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          {needRefresh ? (
            <Button onClick={() => updateServiceWorker(true)} size="sm" variant="primary">
              Reload
            </Button>
          ) : null}
          <Button onClick={close} variant="secondary" size="sm">
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  )
}
