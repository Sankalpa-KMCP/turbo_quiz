import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
      <h1 className="text-4xl font-black text-rose-500 tracking-tight">404</h1>
      <h2 className="text-xl font-bold text-slate-100">Page Not Found</h2>
      <p className="text-slate-400 text-sm max-w-md">
        The route you are looking for does not exist or has been moved.
      </p>
      <Link
        to="/"
        className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-slate-100 font-medium rounded-lg text-sm shadow transition-colors cursor-pointer"
      >
        Go to Dashboard
      </Link>
    </div>
  )
}
