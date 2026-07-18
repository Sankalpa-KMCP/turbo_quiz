import { useState } from 'react'
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

import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Alert } from '../components/ui/Alert'
import { LoadingState } from '../components/ui/LoadingState'
import { PageHeader } from '../components/ui/PageHeader'
import { Field } from '../components/ui/Field'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { buttonStyles } from '../components/ui/buttonStyles'

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

  const {
    register: registerSubjectEdit,
    handleSubmit: handleSubjectEditSubmit,
    setValue: setSubjectEditValue,
    formState: { errors: subjectEditErrors, isSubmitting: isSubjectEditing }
  } = useForm<SubjectUpdateFormData>({
    resolver: zodResolver(subjectUpdateSchema)
  })

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

  if (!isValidId) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="font-serif text-2xl font-semibold text-text-main">Invalid Subject ID</h1>
        <p className="text-text-muted">The provided subject ID is malformed.</p>
        <Link to="/subjects" className="text-primary-text hover:underline">Back to Subjects</Link>
      </div>
    )
  }

  if (subject === undefined) {
    return <LoadingState label="Loading subject..." />
  }

  if (subject === null) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="font-serif text-2xl font-semibold text-text-main">Subject Not Found</h1>
        <p className="text-text-muted">The subject you are looking for does not exist or has been deleted.</p>
        <Link to="/subjects" className="text-primary-text hover:underline">Back to Subjects</Link>
      </div>
    )
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

  const deletingTopic = topics?.find((t) => t.id === deletingTopicId) ?? null

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

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title={subject.name}
        description={`${topics?.length || 0} Topics · ${stats?.total || 0} Questions`}
        eyebrow={
          <Link
            to="/subjects"
            className="inline-flex min-h-9 items-center gap-1 rounded-sm text-sm font-medium text-primary-text transition-colors hover:text-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Subjects
          </Link>
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={startSubjectEdit} variant="secondary" size="sm">
              Edit Subject Name
            </Button>
            <Link
              to={`/questions/new?subjectId=${subject.id}`}
              className={buttonStyles({ variant: 'primary', size: 'sm' })}
            >
              + New Question
            </Link>
          </div>
        }
      />

      {isEditingSubject ? (
        <form onSubmit={handleSubjectEditSubmit(onSubjectEdit)} className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-raised p-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Field
              id="edit-subject-name"
              label="Subject Name"
              required
              error={subjectEditErrors.name?.message}
            >
              <Input {...registerSubjectEdit('name')} autoFocus />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={cancelSubjectEdit} disabled={isSubjectEditing} variant="secondary">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubjectEditing} variant="primary">
              {isSubjectEditing ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      ) : null}

      {actionError && (
        <Alert variant="danger">
          {actionError}
        </Alert>
      )}

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-base font-semibold text-text-main">Topics</h2>
          <Link
            to={`/questions?subjectId=${subject.id}`}
            className="text-sm font-medium text-primary-text transition-colors hover:text-primary-hover"
          >
            View All Questions in Subject
          </Link>
        </div>

        <ul className="divide-y divide-border-subtle border-t border-border-subtle">
          <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold italic text-text-main">Uncategorized</h3>
              <p className="mt-0.5 text-xs text-text-muted">{stats?.uncategorized || 0} Questions</p>
            </div>
            <Link
              to={`/questions?subjectId=${subject.id}&topicId=uncategorized`}
              className={buttonStyles({ variant: 'secondary', size: 'sm' })}
            >
              View Questions
            </Link>
          </li>

          {topics?.map((t) => {
            const isEditingThis = editingTopicId === t.id
            const qCount = stats?.topics[t.id] || 0

            return (
              <li key={t.id} className="py-4">
                {isEditingThis ? (
                  <form onSubmit={handleTopicEditSubmit(onTopicEdit)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                      <Field
                        id={`edit-topic-${t.id}`}
                        label="Topic Name"
                        required
                        error={topicEditErrors.name?.message}
                      >
                        <Input {...registerTopicEdit('name')} autoFocus />
                      </Field>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" onClick={cancelTopicEdit} disabled={isTopicEditing} variant="secondary">
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isTopicEditing} variant="primary">
                        {isTopicEditing ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-text-main">{t.name}</h3>
                      <p className="mt-0.5 text-xs text-text-muted">{qCount} Questions</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to={`/questions/new?subjectId=${subject.id}&topicId=${t.id}`}
                        className={buttonStyles({ variant: 'secondary', size: 'sm' })}
                      >
                        + New
                      </Link>
                      <Link
                        to={`/questions?subjectId=${subject.id}&topicId=${t.id}`}
                        className={buttonStyles({ variant: 'secondary', size: 'sm' })}
                      >
                        Questions
                      </Link>
                      <Button type="button" onClick={() => startTopicEdit(t)} variant="secondary" size="sm">
                        Edit
                      </Button>
                      <Button
                        id={`delete-trigger-${t.id}`}
                        type="button"
                        onClick={() => {
                          setActionError(null)
                          setDeletingTopicId(t.id)
                        }}
                        variant="ghost"
                        size="sm"
                        className="text-danger-text hover:bg-danger-bg hover:text-danger-text"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        <form
          onSubmit={handleTopicCreateSubmit(onTopicCreate)}
          className="flex flex-col gap-3 rounded-lg border border-dashed border-border-subtle bg-surface-raised/60 p-4 sm:flex-row sm:items-end"
        >
          <div className="min-w-0 flex-1">
            <Field
              id="create-topic-name"
              label="New Topic Name"
              required
              error={topicCreateErrors.name?.message}
            >
              <Input {...registerTopicCreate('name')} placeholder="e.g. Algebra" />
            </Field>
          </div>
          <Button type="submit" disabled={isTopicCreating} className="w-full sm:w-auto">
            {isTopicCreating ? 'Creating...' : 'Create Topic'}
          </Button>
        </form>
      </section>

      <ConfirmDialog
        open={deletingTopicId !== null}
        title={deletingTopic ? `Delete Topic: ${deletingTopic.name}` : 'Delete Topic'}
        description={
          <>
            <p>Are you sure you want to delete this topic?</p>
            <p className="mt-2 font-semibold text-warning-text">
              Any current questions linked to this topic will become Uncategorized under this subject. Historical quiz snapshots will be preserved.
            </p>
          </>
        }
        confirmLabel="Confirm Delete"
        tone="destructive"
        pending={isSubmittingAction}
        onConfirm={executeTopicDelete}
        onCancel={() => {
          setDeletingTopicId(null)
          setActionError(null)
        }}
      />
    </div>
  )
}
