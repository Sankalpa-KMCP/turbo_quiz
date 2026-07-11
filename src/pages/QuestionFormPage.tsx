import { useParams } from 'react-router-dom'

export default function QuestionFormPage() {
  const { questionId } = useParams<{ questionId: string }>()
  const isEdit = !!questionId

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight sm:text-3xl">
        {isEdit ? 'Edit Question' : 'Add Question'}
      </h1>
      <p className="text-slate-400 text-sm max-w-2xl">
        {isEdit ? (
          <>Editing Question ID: <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-indigo-400 font-semibold">{questionId}</span>.</>
        ) : (
          'Add a new multiple-choice question to your question bank.'
        )}
      </p>
      <p className="text-slate-400 text-sm max-w-2xl">
        This form will validate inputs using React Hook Form and Zod schemas, supporting multiple options, difficulty classification, and explanations.
      </p>
    </div>
  )
}
