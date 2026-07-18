import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Alert } from '../ui/Alert'

export default function GlobalErrorBoundary() {
  const error = useRouteError()

  const handleGoHome = () => {
    window.location.href = '/'
  }

  const handleReload = () => {
    window.location.reload()
  }

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-surface-base px-6 py-12 text-center font-sans">
          <div className="w-full max-w-md space-y-6">
            <p className="text-sm font-medium uppercase tracking-wider text-text-muted">404</p>
            <div className="space-y-2">
              <h1 className="font-serif text-3xl font-semibold tracking-tight text-text-main">
                Page not found
              </h1>
              <p className="text-sm leading-relaxed text-text-muted">
                The route you are looking for does not exist or has been moved.
              </p>
            </div>
            <Button onClick={handleGoHome} variant="primary" className="w-full sm:w-auto">
              Go to Dashboard
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface-base px-6 py-12 text-center font-sans">
        <div className="w-full max-w-md space-y-6" role="alert">
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-text-main">
            Something went wrong
          </h1>
          <Alert variant="danger" className="text-left">
            {error.statusText || 'A routing error occurred.'}
          </Alert>
          <Button onClick={handleGoHome} variant="primary" className="w-full sm:w-auto">
            Go to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  const isChunkError = error instanceof Error && error.name === 'ChunkLoadError'
  const errorMessage = isChunkError
    ? 'A new version of the application is available. Reload to apply updates.'
    : 'An unexpected error occurred while rendering this page.'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-base px-6 py-12 text-center font-sans">
      <div
        className="w-full max-w-md space-y-6 rounded-lg border border-border-subtle bg-surface-raised p-6 sm:p-8"
        role="alert"
        aria-live="assertive"
      >
        <div className="space-y-2">
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-text-main">
            Application error
          </h1>
          <p className="text-sm leading-relaxed text-text-muted">{errorMessage}</p>
        </div>

        {import.meta.env.DEV && error instanceof Error ? (
          <Alert variant="danger" className="max-h-40 overflow-y-auto text-left font-mono text-xs whitespace-pre-wrap">
            {error.message}
          </Alert>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={handleReload} variant="primary" className="w-full sm:w-auto">
            Reload Application
          </Button>
          <Button onClick={handleGoHome} variant="secondary" className="w-full sm:w-auto">
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
