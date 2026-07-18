import { Link } from 'react-router-dom'
import { buttonStyles } from '../components/ui/buttonStyles'
import { Card } from '../components/ui/Card'

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center text-center">
      <Card className="w-full max-w-md p-8 sm:p-10">
        <h1 className="text-4xl font-black text-danger-text tracking-tight">404</h1>
        <h2 className="mt-4 text-xl font-bold text-text-main">Page Not Found</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-muted">
          The route you are looking for does not exist or has been moved.
        </p>
        <Link to="/" className={`${buttonStyles({ variant: 'primary' })} mt-6`}>
          Go to Dashboard
        </Link>
      </Card>
    </div>
  )
}
