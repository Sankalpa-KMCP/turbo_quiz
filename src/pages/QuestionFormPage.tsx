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

import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Alert } from '../components/ui/Alert'
import { Select } from '../components/ui/Select'
import { Textarea } from '../components/ui/Textarea'
import { PageHeader } from '../components/ui/PageHeader'
import { LoadingState } from '../components/ui/LoadingState'
import { Field } from '../components/ui/Field'

const subjectRepo = new SubjectRepository(db)
const topicRepo = new TopicRepository(db)
const questionRepo = new QuestionRepository(db)

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
    return <LoadingState label="Loading..." />
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        title={isEdit ? 'Edit Question' : 'Create Question'}
        description={isEdit ? 'Update this question while keeping your existing study structure.' : 'Add a question to your subject bank for focused practice.'}
        action={
          <Button type="button" onClick={() => navigate(-1)} variant="ghost" size="sm">
            Cancel
          </Button>
        }
      />

      {errorMsg && (
        <Alert variant="danger">
          {errorMsg}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <section className="space-y-4" aria-labelledby="placement-heading">
          <h2 id="placement-heading" className="text-sm font-semibold text-text-main">Placement</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="subjectId"
              label="Subject"
              required
              error={errors.subjectId?.message}
            >
              <Select {...register('subjectId', { valueAsNumber: true })}>
                <option value={0} disabled>Select a Subject</option>
                {subjects?.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </Field>

            <Field
              id="topicId"
              label="Topic"
              optional
              error={errors.topicId?.message}
            >
              <Select
                value={currentTopicId === null ? 'null' : String(currentTopicId)}
                {...register('topicId', {
                  setValueAs: v => (v === '' || v === 'null' || v === null ? null : Number(v))
                })}
                disabled={!selectedSubjectId}
              >
                <option value="null">Uncategorized</option>
                {topics?.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </Field>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-text-main">Difficulty</legend>
            <div className="flex flex-wrap gap-3">
              {(['easy', 'medium', 'hard'] as Difficulty[]).map(diff => (
                <label
                  key={diff}
                  htmlFor={`diff-${diff}`}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-1 focus-within:ring-2 focus-within:ring-border-focus"
                >
                  <input
                    id={`diff-${diff}`}
                    type="radio"
                    value={diff}
                    {...register('difficulty')}
                    aria-describedby={errors.difficulty ? 'difficulty-error' : undefined}
                    className="h-4 w-4 border-border-strong text-primary-base focus:ring-primary-base"
                  />
                  <span className="text-sm font-medium capitalize text-text-main">{diff}</span>
                </label>
              ))}
            </div>
            {errors.difficulty && (
              <p id="difficulty-error" className="text-xs text-danger-text" role="alert">
                {errors.difficulty.message}
              </p>
            )}
          </fieldset>
        </section>

        <section className="space-y-4" aria-labelledby="content-heading">
          <h2 id="content-heading" className="text-sm font-semibold text-text-main">Question content</h2>
          <Field
            id="questionText"
            label="Question Text"
            required
            error={errors.questionText?.message}
          >
            <Textarea
              {...register('questionText')}
              rows={3}
              placeholder="Type your question here..."
            />
          </Field>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-text-main">
                Options (2-6) <span className="text-danger-text" aria-hidden="true">*</span>
                <span className="sr-only"> (required)</span>
              </p>
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
              <p className="text-xs text-danger-text" role="alert">{errors.options.root.message}</p>
            )}

            <ul className="space-y-3">
              {options.map((option, index) => (
                <li key={index} className="flex items-start gap-3">
                  <label
                    htmlFor={`correctOption-${index}`}
                    className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg focus-within:ring-2 focus-within:ring-border-focus"
                  >
                    <input
                      id={`correctOption-${index}`}
                      type="radio"
                      name="correctOptionIndex"
                      checked={currentCorrectOptionIndex === index}
                      onChange={() => setValue('correctOptionIndex', index, { shouldValidate: true })}
                      className="h-5 w-5 cursor-pointer border-border-strong text-primary-base focus:ring-primary-base"
                      aria-label={`Mark option ${index + 1} as correct answer`}
                      title="Mark as correct answer"
                    />
                  </label>
                  <div className="min-w-0 flex-1">
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
                      aria-label={`Option ${index + 1}`}
                      aria-describedby={errors.options?.[index] ? `option-${index}-error` : undefined}
                    />
                    {errors.options?.[index] && (
                      <p id={`option-${index}-error`} className="mt-1 text-xs text-danger-text" role="alert">
                        {errors.options[index]?.message}
                      </p>
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
                      className="text-text-muted hover:text-danger-text"
                      aria-label={`Remove option ${index + 1}`}
                      title="Remove Option"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {errors.correctOptionIndex && (
              <p className="text-xs text-danger-text" role="alert">{errors.correctOptionIndex.message}</p>
            )}
          </div>

          <Field
            id="explanation"
            label="Explanation"
            optional
            helperText="Shown after answering in feedback-friendly practice modes."
            error={errors.explanation?.message}
          >
            <Textarea
              {...register('explanation')}
              rows={2}
              placeholder="Explain why the answer is correct..."
            />
          </Field>
        </section>

        <div className="flex flex-col-reverse gap-3 border-t border-border-subtle pt-4 sm:flex-row sm:justify-end">
          <Button type="button" onClick={() => navigate(-1)} disabled={isSubmitting} variant="secondary">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} variant="primary">
            {isSubmitting ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Question')}
          </Button>
        </div>
      </form>
    </div>
  )
}
