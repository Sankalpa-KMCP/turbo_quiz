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

import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Alert } from '../components/ui/Alert'
import { Select } from '../components/ui/Select'
import { Textarea } from '../components/ui/Textarea'

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
    return <div className="max-w-3xl mx-auto py-12 text-text-muted">Loading...</div>
  }

  if (errorMsg && isEdit && !initialLoaded /* meaning it failed to load */) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-text-main">Error</h1>
        <p className="text-danger-text">{errorMsg}</p>
        <Button onClick={() => navigate(-1)} variant="ghost">Go Back</Button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-main tracking-tight sm:text-3xl">
          {isEdit ? 'Edit Question' : 'Create Question'}
        </h1>
        <Button
          type="button"
          onClick={() => navigate(-1)}
          variant="ghost"
          size="sm"
        >
          Cancel
        </Button>
      </div>

      {errorMsg && (
        <Alert variant="danger">
          {errorMsg}
        </Alert>
      )}

      <Card className="p-6 sm:p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          {/* Placement */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="subjectId" className="block text-sm font-medium text-text-main mb-1">Subject *</label>
              <Select
                id="subjectId"
                {...register('subjectId', { valueAsNumber: true })}
                hasError={!!errors.subjectId}
                aria-describedby={errors.subjectId ? "subjectId-error" : undefined}
              >
                <option value={0} disabled>Select a Subject</option>
                {subjects?.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
              {errors.subjectId && <p id="subjectId-error" className="text-danger-text text-xs mt-1">{errors.subjectId.message}</p>}
            </div>

            <div>
              <label htmlFor="topicId" className="block text-sm font-medium text-text-main mb-1">Topic</label>
              <Select
                id="topicId"
                value={currentTopicId === null ? 'null' : String(currentTopicId)}
                {...register('topicId', {
                  setValueAs: v => (v === '' || v === 'null' || v === null ? null : Number(v))
                })}
                disabled={!selectedSubjectId}
                hasError={!!errors.topicId}
                aria-describedby={errors.topicId ? "topicId-error" : undefined}
              >
                <option value="null">Uncategorized</option>
                {topics?.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
              {errors.topicId && <p id="topicId-error" className="text-danger-text text-xs mt-1">{errors.topicId.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Difficulty</label>
            <div className="flex gap-4">
              {(['easy', 'medium', 'hard'] as Difficulty[]).map(diff => (
                <label key={diff} htmlFor={`diff-${diff}`} className="flex min-h-11 items-center gap-2 cursor-pointer rounded-lg px-1 focus-within:ring-2 focus-within:ring-border-focus">
                  <input
                    id={`diff-${diff}`}
                    type="radio"
                    value={diff}
                    {...register('difficulty')}
                    aria-describedby={errors.difficulty ? "difficulty-error" : undefined}
                    className="w-4 h-4 text-primary-base bg-surface-base border-border-strong focus:ring-primary-base"
                  />
                  <span className="text-sm font-medium text-text-main capitalize">{diff}</span>
                </label>
              ))}
            </div>
            {errors.difficulty && <p id="difficulty-error" className="text-danger-text text-xs mt-1">{errors.difficulty.message}</p>}
          </div>

          {/* Question Text */}
          <div>
            <label htmlFor="questionText" className="block text-sm font-medium text-text-main mb-1">Question Text *</label>
            <Textarea
              id="questionText"
              {...register('questionText')}
              rows={3}
              placeholder="Type your question here..."
              hasError={!!errors.questionText}
              aria-describedby={errors.questionText ? "questionText-error" : undefined}
            />
            {errors.questionText && <p id="questionText-error" className="text-danger-text text-xs mt-1">{errors.questionText.message}</p>}
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-text-main">Options (2-6) *</label>
              {options.length < 6 && (
                <Button
                  type="button"
                  onClick={() => setValue('options', [...options, ''], { shouldValidate: true })}
                  variant="ghost"
                  size="sm"
                  className="text-primary-text hover:text-primary-hover"
                >
                  + Add Option
                </Button>
              )}
            </div>
            {errors.options?.root && (
              <p className="text-danger-text text-xs">{errors.options.root.message}</p>
            )}

            {options.map((option, index) => (
              <div key={index} className="flex items-start gap-3">
                <label
                  htmlFor={`correctOption-${index}`}
                  className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl focus-within:ring-2 focus-within:ring-border-focus"
                >
                  <input
                    id={`correctOption-${index}`}
                    type="radio"
                    name="correctOptionIndex"
                    checked={currentCorrectOptionIndex === index}
                    onChange={() => setValue('correctOptionIndex', index, { shouldValidate: true })}
                    className="w-5 h-5 text-primary-base bg-surface-base border-border-strong focus:ring-primary-base cursor-pointer"
                    aria-label={`Mark option ${index + 1} as correct answer`}
                    title="Mark as correct answer"
                  />
                </label>
                <div className="flex-1">
                  <Input
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const newOpts = [...options]
                      newOpts[index] = e.target.value
                      setValue('options', newOpts, { shouldValidate: true })
                    }}
                    placeholder={`Option ${index + 1}`}
                    hasError={!!errors.options?.[index]}
                    aria-describedby={errors.options?.[index] ? `option-${index}-error` : undefined}
                  />
                  {errors.options?.[index] && (
                    <p id={`option-${index}-error`} className="text-danger-text text-xs mt-1">{errors.options[index]?.message}</p>
                  )}
                </div>
                {options.length > 2 && (
                  <Button
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
                    variant="ghost"
                    size="sm"
                    className="p-0 text-text-muted hover:text-danger-text"
                    aria-label={`Remove option ${index + 1}`}
                    title="Remove Option"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </Button>
                )}
              </div>
            ))}
            {errors.correctOptionIndex && (
              <p className="text-danger-text text-xs mt-1">{errors.correctOptionIndex.message}</p>
            )}
          </div>

          {/* Explanation */}
          <div>
            <label htmlFor="explanation" className="block text-sm font-medium text-text-main mb-1">Explanation (Optional)</label>
            <Textarea
              id="explanation"
              {...register('explanation')}
              rows={2}
              placeholder="Explain why the answer is correct..."
              hasError={!!errors.explanation}
              aria-describedby={errors.explanation ? "explanation-error" : undefined}
            />
            {errors.explanation && <p id="explanation-error" className="text-danger-text text-xs mt-1">{errors.explanation.message}</p>}
          </div>

          <div className="pt-4 border-t border-border-subtle flex justify-end gap-3">
            <Button
              type="button"
              onClick={() => navigate(-1)}
              disabled={isSubmitting}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              variant="primary"
            >
              {isSubmitting ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Question')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
