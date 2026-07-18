import { useState, useRef, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { db } from '../db/database'
import { SubjectRepository } from '../db/repositories/SubjectRepository'
import { TopicRepository } from '../db/repositories/TopicRepository'
import { QuestionRepository } from '../db/repositories/QuestionRepository'
import { subjectUpdateSchema } from '../schemas/subjectSchema'
import { topicCreateSchema } from '../schemas/topicSchema'
import { DuplicateNameError, ValidationError } from '../db/errors'
import type { Topic } from '../types/db'

import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Alert } from '../components/ui/Alert'

const subjectRepo = new SubjectRepository(db)
const topicRepo = new TopicRepository(db)
const questionRepo = new QuestionRepository(db)

type SubjectUpdateFormData = z.infer<typeof subjectUpdateSchema>
type TopicCreateFormData = { name: string }
type TopicUpdateFormData = { name: string }

export default function SubjectDetailPage() {
  const { subjectId: subjectIdParam } = useParams<{ subjectId: string }>()
  const parsedId = Number(subjectIdParam)
  const isValidId = !isNaN(parsedId) && parsedId > 0 && Number.isInteger(parsedId)

  const subject = useLiveQuery(
    () => (isValidId ? subjectRepo.getById(parsedId).then(s => s ?? null) : Promise.resolve(null)),
    [isValidId, parsedId]
  )

  const topics = useLiveQuery(
    () => (isValidId && subject ? topicRepo.getBySubject(parsedId) : Promise.resolve([])),
    [isValidId, subject, parsedId]
  )

  // Question counts per topic, plus uncategorized count
  const stats = useLiveQuery(async () => {
    if (!isValidId || !subject || !topics) return { topics: {}, uncategorized: 0, total: 0 }
    const res: Record<number, number> = {}

    const uncategorizedQuestions = await questionRepo.search({
      subjectId: parsedId,
      topicFilter: { kind: 'uncategorized' }
    })
    const uncategorized = uncategorizedQuestions.length

    for (const t of topics) {
      res[t.id] = await questionRepo.countByTopic(t.id)
    }
    const total = await questionRepo.countBySubject(parsedId)

    return { topics: res, uncategorized, total }
  }, [isValidId, subject, topics, parsedId])

  const [isEditingSubject, setIsEditingSubject] = useState(false)
  const [editingTopicId, setEditingTopicId] = useState<number | null>(null)
  const [deletingTopicId, setDeletingTopicId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSubmittingAction, setIsSubmittingAction] = useState(false)

  const cancelRef = useRef<HTMLButtonElement>(null)

  const {
    register: registerSubjectEdit,
    handleSubmit: handleSubjectEditSubmit,
    setValue: setSubjectEditValue,
    formState: { errors: subjectEditErrors, isSubmitting: isSubjectEditing }
  } = useForm<SubjectUpdateFormData>({
    resolver: zodResolver(subjectUpdateSchema)
  })

  // We omit subjectId from the form data because we inject it
  const {
    register: registerTopicCreate,
    handleSubmit: handleTopicCreateSubmit,
    reset: resetTopicCreate,
    formState: { errors: topicCreateErrors, isSubmitting: isTopicCreating }
  } = useForm<TopicCreateFormData>({
    resolver: zodResolver(z.object({ name: topicCreateSchema.shape.name })),
    defaultValues: { name: '' }
  })

  const {
    register: registerTopicEdit,
    handleSubmit: handleTopicEditSubmit,
    reset: resetTopicEdit,
    setValue: setTopicEditValue,
    formState: { errors: topicEditErrors, isSubmitting: isTopicEditing }
  } = useForm<TopicUpdateFormData>({
    resolver: zodResolver(z.object({ name: topicCreateSchema.shape.name })),
    defaultValues: { name: '' }
  })

  useEffect(() => {
    if (deletingTopicId !== null && cancelRef.current) {
      cancelRef.current.focus()
    }
  }, [deletingTopicId])

  if (!isValidId) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-text-main">Invalid Subject ID</h1>
        <p className="text-text-muted">The provided subject ID is malformed.</p>
        <Link to="/subjects" className="text-primary-text hover:underline">Back to Subjects</Link>
      </div>
    )
  }

  // Loading state
  if (subject === undefined) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="text-text-muted text-sm">Loading subject...</div>
      </div>
    )
  }

  if (subject === null) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-text-main">Subject Not Found</h1>
        <p className="text-text-muted">The subject you are looking for does not exist or has been deleted.</p>
        <Link to="/subjects" className="text-primary-text hover:underline">Back to Subjects</Link>
      </div>
    )
  }

  const startSubjectEdit = () => {
    setActionError(null)
    setSubjectEditValue('name', subject.name)
    setIsEditingSubject(true)
  }

  const cancelSubjectEdit = () => {
    setIsEditingSubject(false)
    setActionError(null)
  }

  const onSubjectEdit = async (data: SubjectUpdateFormData) => {
    setActionError(null)
    try {
      await subjectRepo.update(parsedId, data)
      setIsEditingSubject(false)
    } catch (err) {
      handleRepoError(err)
    }
  }

  const onTopicCreate = async (data: TopicCreateFormData) => {
    setActionError(null)
    try {
      await topicRepo.create({ subjectId: parsedId, name: data.name })
      resetTopicCreate()
    } catch (err) {
      handleRepoError(err)
    }
  }

  const startTopicEdit = (t: Topic) => {
    setActionError(null)
    setEditingTopicId(t.id)
    setTopicEditValue('name', t.name)
  }

  const cancelTopicEdit = () => {
    setEditingTopicId(null)
    resetTopicEdit()
    setActionError(null)
  }

  const onTopicEdit = async (data: TopicUpdateFormData) => {
    if (editingTopicId === null) return
    setActionError(null)
    try {
      await topicRepo.update(editingTopicId, { name: data.name })
      setEditingTopicId(null)
      resetTopicEdit()
    } catch (err) {
      handleRepoError(err)
    }
  }

  const confirmTopicDelete = (id: number) => {
    setActionError(null)
    setDeletingTopicId(id)
  }

  const cancelTopicDelete = (id: number) => {
    setDeletingTopicId(null)
    setActionError(null)
    setTimeout(() => {
      document.getElementById(`delete-trigger-${id}`)?.focus()
    }, 0)
  }

  const executeTopicDelete = async () => {
    if (deletingTopicId === null) return
    setIsSubmittingAction(true)
    setActionError(null)
    try {
      await topicRepo.delete(deletingTopicId)
      setDeletingTopicId(null)
    } catch (err) {
      handleRepoError(err)
    } finally {
      setIsSubmittingAction(false)
    }
  }

  const handleRepoError = (err: unknown) => {
    if (err instanceof DuplicateNameError) {
      setActionError(`A name "${err.conflictingValue}" already exists.`)
    } else if (err instanceof ValidationError) {
      setActionError('Validation error occurred.')
    } else {
      setActionError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Subject Header */}
      <Card className="p-6 flex flex-col gap-4 relative">
        <Link to="/subjects" className="text-sm font-medium text-primary-base hover:text-primary-hover transition-colors inline-flex items-center gap-1 w-fit">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Subjects
        </Link>

        {isEditingSubject ? (
          <form onSubmit={handleSubjectEditSubmit(onSubjectEdit)} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end mt-2">
            <div className="flex-1 w-full max-w-sm">
              <label htmlFor="edit-subject-name" className="sr-only">Subject Name</label>
              <Input
                id="edit-subject-name"
                {...registerSubjectEdit('name')}
                hasError={!!subjectEditErrors.name}
                className="text-xl font-bold"
                autoFocus
              />
              {subjectEditErrors.name && (
                <p className="text-danger-text text-xs mt-1">{subjectEditErrors.name.message}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={cancelSubjectEdit}
                disabled={isSubjectEditing}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubjectEditing}
                variant="primary"
              >
                {isSubjectEditing ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <h1 className="text-2xl font-bold text-text-main tracking-tight sm:text-3xl">{subject.name}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-text-muted">
                <span>{topics?.length || 0} Topics</span>
                <span>{stats?.total || 0} Questions</span>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <Button
                type="button"
                onClick={startSubjectEdit}
                variant="secondary"
                size="sm"
              >
                Edit Subject Name
              </Button>
              <Link
                to={`/questions/new?subjectId=${subject.id}`}
                className="inline-flex min-h-11 items-center px-3 py-1.5 bg-primary-base hover:bg-primary-hover text-text-inverse font-medium rounded-lg text-xs cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
              >
                + New Question
              </Link>
            </div>
          </div>
        )}
      </Card>

      {actionError && (
        <Alert variant="danger">
          {actionError}
        </Alert>
      )}

      {/* Topics Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <h2 className="text-xl font-bold text-text-main">Topics</h2>
          <Link to={`/questions?subjectId=${subject.id}`} className="text-sm font-medium text-primary-base hover:text-primary-hover transition-colors">
            View All Questions in Subject &rarr;
          </Link>
        </div>

        {/* Uncategorized Pseudo-Topic */}
        <Card className="p-4 sm:p-6 flex justify-between items-center bg-surface-overlay/30 border-dashed">
          <div>
            <h3 className="text-lg font-semibold text-text-main italic">Uncategorized</h3>
            <p className="text-xs text-text-muted mt-1">{stats?.uncategorized || 0} Questions</p>
          </div>
          <div className="flex gap-2">
             <Link
                to={`/questions?subjectId=${subject.id}&topicId=uncategorized`}
                className="inline-flex min-h-11 items-center px-3 py-1.5 bg-surface-overlay hover:bg-surface-base text-text-main font-medium rounded-lg text-xs cursor-pointer transition-colors border border-border-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
              >
                View Questions
              </Link>
          </div>
        </Card>

        {/* Topics List */}
        {topics?.map(t => {
          const isEditingThis = editingTopicId === t.id
          const isDeletingThis = deletingTopicId === t.id
          const qCount = stats?.topics[t.id] || 0

          return (
            <Card key={t.id} className="p-4 sm:p-6 transition-all hover:border-border-strong">
              {isDeletingThis ? (
                <div
                  role="dialog"
                  aria-modal="true"
                  className="space-y-4 focus:outline-none"
                  aria-labelledby={`delete-topic-heading-${t.id}`}
                  aria-describedby={`delete-topic-desc-${t.id}`}
                  tabIndex={-1}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' && !isSubmittingAction) {
                      e.stopPropagation()
                      cancelTopicDelete(t.id)
                    }
                  }}
                >
                  <div className="space-y-2">
                    <h3 id={`delete-topic-heading-${t.id}`} className="text-lg font-bold text-text-main">
                      Delete Topic: {t.name}
                    </h3>
                    <p id={`delete-topic-desc-${t.id}`} className="text-sm text-text-muted">
                      Are you sure you want to delete this topic?
                      <span className="block text-warning-text font-semibold mt-1">
                        Any current questions linked to this topic will become Uncategorized under this subject. Historical quiz snapshots will be preserved.
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <Button
                      ref={cancelRef}
                      type="button"
                      onClick={() => cancelTopicDelete(t.id)}
                      disabled={isSubmittingAction}
                      variant="secondary"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={executeTopicDelete}
                      disabled={isSubmittingAction}
                      variant="danger"
                    >
                      {isSubmittingAction ? 'Deleting...' : 'Confirm Delete'}
                    </Button>
                  </div>
                </div>
              ) : isEditingThis ? (
                <form onSubmit={handleTopicEditSubmit(onTopicEdit)} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                  <div className="flex-1 w-full">
                    <label htmlFor={`edit-topic-${t.id}`} className="sr-only">Topic Name</label>
                    <Input
                      id={`edit-topic-${t.id}`}
                      {...registerTopicEdit('name')}
                      hasError={!!topicEditErrors.name}
                      autoFocus
                    />
                    {topicEditErrors.name && (
                      <p className="text-danger-text text-xs mt-1">{topicEditErrors.name.message}</p>
                    )}
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      type="button"
                      onClick={cancelTopicEdit}
                      disabled={isTopicEditing}
                      variant="secondary"
                      className="flex-1 sm:flex-none"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isTopicEditing}
                      variant="primary"
                      className="flex-1 sm:flex-none"
                    >
                      {isTopicEditing ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-text-main">{t.name}</h3>
                    <p className="text-xs text-text-muted mt-1">{qCount} Questions</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Link
                      to={`/questions/new?subjectId=${subject.id}&topicId=${t.id}`}
                      className="inline-flex min-h-11 items-center px-3 py-1.5 bg-primary-base/10 hover:bg-primary-base/20 text-primary-text font-medium rounded-lg text-xs cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                    >
                      + New
                    </Link>
                    <Link
                      to={`/questions?subjectId=${subject.id}&topicId=${t.id}`}
                      className="inline-flex min-h-11 items-center px-3 py-1.5 bg-surface-overlay hover:bg-border-strong text-text-main font-medium rounded-lg text-xs cursor-pointer transition-colors border border-border-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                    >
                      Questions
                    </Link>
                    <Button
                      type="button"
                      onClick={() => startTopicEdit(t)}
                      variant="secondary"
                      size="sm"
                    >
                      Edit
                    </Button>
                    <Button
                      id={`delete-trigger-${t.id}`}
                      type="button"
                      onClick={() => confirmTopicDelete(t.id)}
                      variant="ghost"
                      size="sm"
                      className="text-danger-text hover:bg-danger-bg hover:text-danger-text"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )
        })}

        {/* Create Topic Form */}
        <Card className="p-4 border-dashed border-border-subtle bg-surface-base">
          <form onSubmit={handleTopicCreateSubmit(onTopicCreate)} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="flex-1 w-full">
              <label htmlFor="create-topic-name" className="block text-sm font-medium text-text-main mb-1">
                New Topic Name
              </label>
              <Input
                id="create-topic-name"
                {...registerTopicCreate('name')}
                hasError={!!topicCreateErrors.name}
                placeholder="e.g. Algebra"
              />
              {topicCreateErrors.name && (
                <p className="text-danger-text text-xs mt-1">{topicCreateErrors.name.message}</p>
              )}
            </div>
            <Button
              type="submit"
              disabled={isTopicCreating}
              className="w-full sm:w-auto"
            >
              {isTopicCreating ? 'Creating...' : 'Create Topic'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
