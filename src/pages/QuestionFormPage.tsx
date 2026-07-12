import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { SubjectRepository } from '../db/repositories/SubjectRepository'
import { TopicRepository } from '../db/repositories/TopicRepository'
import { QuestionRepository } from '../db/repositories/QuestionRepository'
import { questionCreateSchema } from '../schemas/questionSchema'
import type { QuestionInput, Difficulty } from '../types/db'

const subjectRepo = new SubjectRepository(db)
const topicRepo = new TopicRepository(db)
const questionRepo = new QuestionRepository(db)

// Use the same schema as creation, it covers updates for our simple form.
type QuestionFormData = z.infer<typeof questionCreateSchema>

export default function QuestionFormPage() {
  const { questionId: qIdParam } = useParams<{ questionId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const isEdit = !!qIdParam
  const parsedQId = Number(qIdParam)

  const defaultSubjectId = Number(searchParams.get('subjectId')) || null
  const defaultTopicId = searchParams.get('topicId') === 'uncategorized'
    ? null
    : (Number(searchParams.get('topicId')) || null)

  const [initialLoaded, setInitialLoaded] = useState(!isEdit)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting }
  } = useForm<z.input<typeof questionCreateSchema>, unknown, QuestionFormData>({
    resolver: zodResolver(questionCreateSchema),
    defaultValues: {
      subjectId: defaultSubjectId || 0,
      topicId: defaultTopicId,
      questionText: '',
      options: ['Option 1', 'Option 2'],
      correctOptionIndex: 0,
      difficulty: 'medium',
      explanation: null,
      bookmarkStatus: 0
    }
  })

  const selectedSubjectId = useWatch({ control, name: 'subjectId' })
  const currentTopicId = useWatch({ control, name: 'topicId' })
  const options = useWatch({ control, name: 'options' }) || []
  const currentCorrectOptionIndex = useWatch({ control, name: 'correctOptionIndex' })

  const subjects = useLiveQuery(() => subjectRepo.getAll(), [])
  const topics = useLiveQuery(
    () => (selectedSubjectId ? topicRepo.getBySubject(selectedSubjectId) : Promise.resolve([])),
    [selectedSubjectId]
  )

  // Load existing question if edit
  useEffect(() => {
    if (isEdit && !isNaN(parsedQId)) {
      questionRepo.getById(parsedQId).then(q => {
        if (q) {
          reset({
            subjectId: q.subjectId,
            topicId: q.topicId,
            questionText: q.questionText,
            options: q.options,
            correctOptionIndex: q.correctOptionIndex,
            difficulty: q.difficulty,
            explanation: q.explanation || ''
          })
          setInitialLoaded(true)
        } else {
          setErrorMsg('Question not found.')
          setInitialLoaded(true)
        }
      }).catch(err => {
        setErrorMsg(err.message)
        setInitialLoaded(true)
      })
    }
  }, [isEdit, parsedQId, reset])

  // When subject changes, if the new subject doesn't have the current topic, we should reset topicId to null.
  // We'll let the user handle it or reset it safely.
  useEffect(() => {
    // A quick hack: if topics loaded and current topic is not in it, we could reset it.
    // But we skip complex auto-resets to avoid bugs.
  }, [selectedSubjectId, topics])

  const onSubmit = async (data: QuestionFormData) => {
    setErrorMsg(null)
    try {
      const payload: QuestionInput = {
        ...data,
        topicId: data.topicId ?? null,
        explanation: data.explanation ?? null,
        bookmarkStatus: (data.bookmarkStatus ?? 0) as 0 | 1
      }
      if (isEdit) {
        await questionRepo.update(parsedQId, payload)
      } else {
        await questionRepo.create(payload)
      }
      navigate(`/questions?subjectId=${data.subjectId}`)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    }
  }

  if (!initialLoaded || subjects === undefined) {
    return <div className="max-w-3xl mx-auto py-12 text-slate-500">Loading...</div>
  }

  if (errorMsg && isEdit && !initialLoaded /* meaning it failed to load */) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-slate-100">Error</h1>
        <p className="text-rose-400">{errorMsg}</p>
        <button onClick={() => navigate(-1)} className="text-indigo-400 hover:underline">Go Back</button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight sm:text-3xl">
          {isEdit ? 'Edit Question' : 'Create Question'}
        </h1>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-sm font-medium text-slate-400 hover:text-slate-300 transition-colors"
        >
          Cancel
        </button>
      </div>

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-4 py-3 rounded-xl text-sm">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl">

        {/* Placement */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="subjectId" className="block text-sm font-medium text-slate-300 mb-1">Subject *</label>
            <select
              id="subjectId"
              {...register('subjectId', { valueAsNumber: true })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            >
              <option value={0} disabled>Select a Subject</option>
              {subjects?.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {errors.subjectId && <p className="text-rose-400 text-xs mt-1">{errors.subjectId.message}</p>}
          </div>

          <div>
            <label htmlFor="topicId" className="block text-sm font-medium text-slate-300 mb-1">Topic</label>
            <select
              id="topicId"
              value={currentTopicId === null ? 'null' : String(currentTopicId)}
              {...register('topicId', {
                setValueAs: v => (v === '' || v === 'null' || v === null ? null : Number(v))
              })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              disabled={!selectedSubjectId}
            >
              <option value="null">Uncategorized</option>
              {topics?.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {errors.topicId && <p className="text-rose-400 text-xs mt-1">{errors.topicId.message}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Difficulty</label>
          <div className="flex gap-4">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map(diff => (
              <label key={diff} htmlFor={`diff-${diff}`} className="flex items-center gap-2 cursor-pointer">
                <input
                  id={`diff-${diff}`}
                  type="radio"
                  value={diff}
                  {...register('difficulty')}
                  className="w-4 h-4 text-indigo-600 bg-slate-950 border-slate-700 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-slate-300 capitalize">{diff}</span>
              </label>
            ))}
          </div>
          {errors.difficulty && <p className="text-rose-400 text-xs mt-1">{errors.difficulty.message}</p>}
        </div>

        {/* Question Text */}
        <div>
          <label htmlFor="questionText" className="block text-sm font-medium text-slate-300 mb-1">Question Text *</label>
          <textarea
            id="questionText"
            {...register('questionText')}
            rows={3}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            placeholder="Type your question here..."
          />
          {errors.questionText && <p className="text-rose-400 text-xs mt-1">{errors.questionText.message}</p>}
        </div>

        {/* Options */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="block text-sm font-medium text-slate-300">Options (2-6) *</label>
            {options.length < 6 && (
              <button
                type="button"
                onClick={() => setValue('options', [...options, ''], { shouldValidate: true })}
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                + Add Option
              </button>
            )}
          </div>
          {errors.options?.root && (
            <p className="text-rose-400 text-xs">{errors.options.root.message}</p>
          )}

          {options.map((option, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="pt-2.5">
                <input
                  id={`correctOption-${index}`}
                  type="radio"
                  name="correctOptionIndex"
                  checked={currentCorrectOptionIndex === index}
                  onChange={() => setValue('correctOptionIndex', index, { shouldValidate: true })}
                  className="w-5 h-5 text-indigo-600 bg-slate-950 border-slate-700 focus:ring-indigo-500 cursor-pointer"
                  title="Mark as correct answer"
                />
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const newOpts = [...options]
                    newOpts[index] = e.target.value
                    setValue('options', newOpts, { shouldValidate: true })
                  }}
                  placeholder={`Option ${index + 1}`}
                  className={`w-full bg-slate-950 border rounded-xl px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors ${
                    errors.options?.[index] ? 'border-rose-500' : 'border-slate-800'
                  }`}
                />
                {errors.options?.[index] && (
                  <p className="text-rose-400 text-xs mt-1">{errors.options[index]?.message}</p>
                )}
              </div>
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const currentCorrect = getValues('correctOptionIndex')
                    if (currentCorrect === index) {
                      setValue('correctOptionIndex', -1, { shouldValidate: true })
                    } else if (currentCorrect > index) {
                      setValue('correctOptionIndex', currentCorrect - 1, { shouldValidate: true })
                    }
                    setValue('options', options.filter((_, i) => i !== index), { shouldValidate: true })
                  }}
                  className="p-2.5 text-slate-500 hover:text-rose-400 transition-colors rounded-xl"
                  title="Remove Option"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))}
          {errors.correctOptionIndex && (
            <p className="text-rose-400 text-xs mt-1">{errors.correctOptionIndex.message}</p>
          )}
        </div>

        {/* Explanation */}
        <div>
          <label htmlFor="explanation" className="block text-sm font-medium text-slate-300 mb-1">Explanation (Optional)</label>
          <textarea
            id="explanation"
            {...register('explanation')}
            rows={2}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            placeholder="Explain why the answer is correct..."
          />
          {errors.explanation && <p className="text-rose-400 text-xs mt-1">{errors.explanation.message}</p>}
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-slate-100 font-bold rounded-xl text-sm transition-colors"
          >
            {isSubmitting ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Question')}
          </button>
        </div>
      </form>
    </div>
  )
}
