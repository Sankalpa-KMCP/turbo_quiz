import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

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
    <Card className="fixed inset-x-4 bottom-4 z-50 p-4 shadow-xl sm:left-auto sm:right-4 sm:max-w-sm" role="alert" aria-live="assertive">
      <div className="flex flex-col gap-3">
        <div className="text-sm font-medium text-text-main">
          {offlineReady
            ? <span>App ready to work offline</span>
            : <span>New content available, click on reload button to update.</span>}
        </div>
        <div className="flex justify-end gap-2">
          {needRefresh && (
            <Button
              onClick={() => updateServiceWorker(true)}
              size="sm"
            >
              Reload
            </Button>
          )}
          <Button
            onClick={close}
            variant="secondary"
            size="sm"
          >
            Close
          </Button>
        </div>
      </div>
    </Card>
  )
}
