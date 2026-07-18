import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { Card } from '../ui/Card'
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

  // Handle expected routing errors (e.g., 404s)
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return (
        <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center p-6 text-center font-sans">
          <Card className="max-w-md w-full p-8 space-y-6 shadow-xl border border-border-subtle">
            <h1 className="text-4xl font-bold text-danger-text tracking-tight">404</h1>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-text-main">Page Not Found</h2>
              <p className="text-text-muted text-sm">
                The route you are looking for does not exist or has been moved.
              </p>
            </div>
            <Button
              onClick={handleGoHome}
              variant="primary"
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </Card>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center p-6 text-center font-sans">
        <Card className="max-w-md w-full p-8 space-y-6 shadow-xl border border-border-subtle">
          <h1 className="text-2xl font-bold text-text-main">Something went wrong</h1>
          <Alert variant="danger" className="text-left">
            {error.statusText || 'Routing error occurred.'}
          </Alert>
          <Button
            onClick={handleGoHome}
            variant="primary"
            className="w-full"
          >
            Go to Dashboard
          </Button>
        </Card>
      </div>
    )
  }

  // Handle generic rendering or chunk loading errors
  const isChunkError = error instanceof Error && error.name === 'ChunkLoadError'
  const errorMessage = isChunkError
    ? "A new version of the application is available. Please reload to apply updates."
    : "An unexpected error occurred while rendering this page."

  return (
    <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center p-6 text-center font-sans">
      <Card
        role="alert"
        aria-live="assertive"
        className="max-w-md w-full p-8 space-y-6 shadow-xl border border-border-subtle"
      >
        <div className="inline-flex p-4 bg-danger-bg rounded-full text-danger-text border border-danger-border">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-text-main">Application Error</h1>
          <p className="text-sm text-text-muted">{errorMessage}</p>
        </div>

        {import.meta.env.DEV && error instanceof Error && (
          <Alert variant="danger" className="text-xs text-left max-h-40 overflow-y-auto whitespace-pre-wrap font-mono">
            {error.message}
          </Alert>
        )}

        <div className="flex flex-col gap-2">
          <Button
            onClick={handleReload}
            variant="primary"
            className="w-full"
          >
            Reload Application
          </Button>
          <Button
            onClick={handleGoHome}
            variant="outline"
            className="w-full"
          >
            Go to Dashboard
          </Button>
        </div>
      </Card>
    </div>
  )
}
