import { Link } from 'react-router-dom'
import { buttonStyles } from '../components/ui/buttonStyles'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="w-full max-w-md space-y-6">
        <p className="text-sm font-medium uppercase tracking-wider text-text-muted">404</p>
        <div className="space-y-2">
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-text-main">
            Page not found
          </h1>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-text-muted">
            The route you are looking for does not exist or has been moved.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <Link to="/" className={buttonStyles({ variant: 'primary' })}>
            Go to Dashboard
          </Link>
          <Link
            to="/subjects"
            className="text-sm font-medium text-primary-text underline-offset-2 hover:underline focus:outline-none focus-visible:underline"
          >
            Browse subjects
          </Link>
        </div>
      </div>
    </div>
  )
}
