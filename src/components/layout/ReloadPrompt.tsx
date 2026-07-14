import { useRegisterSW } from 'virtual:pwa-register/react'

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
    <div className="fixed bottom-4 right-4 z-50 p-4 bg-slate-800 border border-slate-700 shadow-xl rounded-2xl max-w-sm w-full transition-all" role="alert" aria-live="assertive">
      <div className="flex flex-col gap-3">
        <div className="text-sm font-medium text-slate-200">
          {offlineReady
            ? <span>App ready to work offline</span>
            : <span>New content available, click on reload button to update.</span>}
        </div>
        <div className="flex justify-end gap-2">
          {needRefresh && (
            <button
              onClick={() => updateServiceWorker(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-slate-100 rounded-lg text-sm font-bold transition-colors"
            >
              Reload
            </button>
          )}
          <button
            onClick={close}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
