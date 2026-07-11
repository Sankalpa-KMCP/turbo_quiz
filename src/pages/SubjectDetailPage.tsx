import { useParams } from 'react-router-dom'

export default function SubjectDetailPage() {
  const { subjectId } = useParams<{ subjectId: string }>()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight sm:text-3xl">Subject Details</h1>
      <p className="text-slate-400 text-sm max-w-2xl">
        Viewing details for Subject ID: <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-indigo-400 font-semibold">{subjectId || 'Unknown'}</span>.
      </p>
      <p className="text-slate-400 text-sm max-w-2xl">
        This view will show all topics, performance metrics, and a quick-launch configuration for quizzes under this subject.
      </p>
    </div>
  )
}
