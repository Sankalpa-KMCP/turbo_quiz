import { isRouteErrorResponse, useRouteError } from 'react-router-dom'

export default function GlobalErrorBoundary() {
  const error = useRouteError()

  // Handle expected routing errors (e.g., 404s)
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="max-w-md w-full p-8 bg-slate-900 border border-slate-800 rounded-2xl space-y-6">
            <h1 className="text-4xl font-black text-slate-100">404</h1>
            <h2 className="text-xl font-bold text-slate-400">Page Not Found</h2>
            <button
              onClick={() => { window.location.href = '/' }}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-slate-100 font-bold rounded-xl text-sm transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full p-8 bg-slate-900 border border-slate-800 rounded-2xl space-y-6">
          <h1 className="text-2xl font-bold text-slate-100">Something went wrong</h1>
          <p className="text-slate-400">{error.statusText}</p>
        </div>
      </div>
    )
  }

  // Handle generic rendering or chunk loading errors
  const isChunkError = error instanceof Error && error.name === 'ChunkLoadError'
  const errorMessage = isChunkError
    ? "A new version of the application is available. Please reload to apply updates."
    : "An unexpected error occurred while rendering this page."

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center font-sans">
      <div
        role="alert"
        aria-live="assertive"
        className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl space-y-6 shadow-2xl"
      >
        <div className="inline-flex p-4 bg-rose-500/10 rounded-full text-rose-400">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-100">Application Error</h1>
          <p className="text-sm text-slate-400">{errorMessage}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex w-full items-center justify-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-slate-100 font-bold rounded-xl text-sm transition-colors shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Reload Application
        </button>
        <button
          onClick={() => {
            window.location.href = '/'
          }}
          className="inline-flex w-full items-center justify-center px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-sm transition-colors mt-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  )
}
