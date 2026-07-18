import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { db } from '../db/database'
import { SubjectRepository } from '../db/repositories/SubjectRepository'
import { TopicRepository } from '../db/repositories/TopicRepository'
import { QuestionRepository } from '../db/repositories/QuestionRepository'
import { subjectCreateSchema, subjectUpdateSchema } from '../schemas/subjectSchema'
import { DuplicateNameError, ValidationError } from '../db/errors'
import type { Subject } from '../types/db'

import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Alert } from '../components/ui/Alert'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingState } from '../components/ui/LoadingState'
import { PageHeader } from '../components/ui/PageHeader'
import { Field } from '../components/ui/Field'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

const subjectRepo = new SubjectRepository(db)
const topicRepo = new TopicRepository(db)
const questionRepo = new QuestionRepository(db)

type CreateFormData = z.infer<typeof subjectCreateSchema>
type UpdateFormData = z.infer<typeof subjectUpdateSchema>

export default function SubjectsPage() {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSubmittingAction, setIsSubmittingAction] = useState(false)

  const subjects = useLiveQuery(() => subjectRepo.getAll())

  const subjectStats = useLiveQuery(async () => {
    if (!subjects) return {}
    const stats: Record<number, { topics: number; questions: number }> = {}
    for (const sub of subjects) {
      const topics = await topicRepo.getBySubject(sub.id)
      const qCount = await questionRepo.countBySubject(sub.id)
      stats[sub.id] = { topics: topics.length, questions: qCount }
    }
    return stats
  }, [subjects])

  const {
    register: registerCreate,
    handleSubmit: handleCreateSubmit,
    reset: resetCreate,
    formState: { errors: createErrors, isSubmitting: isCreating }
  } = useForm<z.input<typeof subjectCreateSchema>, unknown, CreateFormData>({
    resolver: zodResolver(subjectCreateSchema),
    defaultValues: { name: '' }
  })

  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    setValue: setEditValue,
    formState: { errors: editErrors, isSubmitting: isEditing }
  } = useForm<UpdateFormData>({
    resolver: zodResolver(subjectUpdateSchema),
    defaultValues: { name: '' }
  })

  const onCreate = async (data: CreateFormData) => {
    setActionError(null)
    try {
      await subjectRepo.create({
        name: data.name,
        description: data.description ?? null
      })
      resetCreate()
    } catch (err) {
      if (err instanceof DuplicateNameError) {
        setActionError(`A subject named "${err.conflictingValue}" already exists.`)
      } else if (err instanceof ValidationError) {
        setActionError('Validation error occurred.')
      } else {
        setActionError(err instanceof Error ? err.message : String(err))
      }
    }
  }

  const startEditing = (sub: Subject) => {
    setActionError(null)
    setEditingId(sub.id)
    setEditValue('name', sub.name)
  }

  const cancelEditing = () => {
    setEditingId(null)
    resetEdit()
    setActionError(null)
  }

  const onEdit = async (data: UpdateFormData) => {
    if (editingId === null) return
    setActionError(null)
    try {
      await subjectRepo.update(editingId, data)
      setEditingId(null)
      resetEdit()
    } catch (err) {
      if (err instanceof DuplicateNameError) {
        setActionError(`A subject with the name "${err.conflictingValue}" already exists.`)
      } else if (err instanceof ValidationError) {
        setActionError('Validation error occurred.')
      } else {
        setActionError(err instanceof Error ? err.message : String(err))
      }
    }
  }

  const deletingSubject = subjects?.find((sub) => sub.id === deletingId) ?? null
  const deletingStats = deletingId != null
    ? (subjectStats?.[deletingId] || { topics: 0, questions: 0 })
    : { topics: 0, questions: 0 }

  const executeDelete = async () => {
    if (deletingId === null) return
    setIsSubmittingAction(true)
    setActionError(null)
    try {
      await subjectRepo.delete(deletingId)
      setDeletingId(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSubmittingAction(false)
    }
  }

  const isLoading = subjects === undefined

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Subjects"
        description="Organize your study library, then add topics and questions inside each subject."
      />

      {actionError && (
        <Alert variant="danger">
          {actionError}
        </Alert>
      )}

      <section className="rounded-lg border border-border-subtle bg-surface-raised p-4 sm:p-5" aria-labelledby="create-subject-heading">
        <h2 id="create-subject-heading" className="text-sm font-semibold text-text-main">Add a subject</h2>
        <form onSubmit={handleCreateSubmit(onCreate)} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Field
              id="create-name"
              label="New Subject Name"
              required
              error={createErrors.name?.message}
            >
              <Input
                {...registerCreate('name')}
                placeholder="e.g. Mathematics"
              />
            </Field>
          </div>
          <Button type="submit" disabled={isCreating} className="w-full sm:w-auto">
            {isCreating ? 'Creating...' : 'Create Subject'}
          </Button>
        </form>
      </section>

      <section aria-label="Subject list">
        {isLoading ? (
          <LoadingState compact label="Loading subjects…" />
        ) : subjects.length === 0 ? (
          <EmptyState
            title="No subjects found"
            description="Use the form above to create your first subject and begin building a focused question bank."
            icon={
              <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 19.5A2.5 2.5 0 016.5 17H20M4 4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15z" />
              </svg>
            }
          />
        ) : (
          <ul className="divide-y divide-border-subtle border-t border-border-subtle">
            {subjects.map((sub) => {
              const isEditingThis = editingId === sub.id
              const stats = subjectStats?.[sub.id] || { topics: 0, questions: 0 }

              return (
                <li key={sub.id} className="py-4">
                  {isEditingThis ? (
                    <form onSubmit={handleEditSubmit(onEdit)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="min-w-0 flex-1">
                        <Field
                          id={`edit-name-${sub.id}`}
                          label="Subject Name"
                          required
                          error={editErrors.name?.message}
                        >
                          <Input
                            {...registerEdit('name')}
                            autoFocus
                          />
                        </Field>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" onClick={cancelEditing} disabled={isEditing} variant="secondary">
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isEditing} variant="primary">
                          {isEditing ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <Link
                          to={`/subjects/${sub.id}`}
                          className="group inline-flex max-w-full items-center gap-1.5 rounded-sm text-lg font-semibold text-text-main transition-colors hover:text-primary-text focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                        >
                          <span className="truncate">{sub.name}</span>
                          <svg className="size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                        <p className="mt-1 text-sm text-text-muted">
                          {stats.topics} Topics · {stats.questions} Questions
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" onClick={() => startEditing(sub)} variant="secondary" size="sm">
                          Edit
                        </Button>
                        <Button
                          type="button"
                          onClick={() => {
                            setActionError(null)
                            setDeletingId(sub.id)
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
        )}
      </section>

      <ConfirmDialog
        open={deletingId !== null}
        title={deletingSubject ? `Delete Subject: ${deletingSubject.name}` : 'Delete Subject'}
        description={
          <>
            <p>Are you sure you want to delete this subject?</p>
            <p className="mt-2 font-semibold text-danger-text">
              This will permanently delete {deletingStats.topics} topic(s) and {deletingStats.questions} question(s). Historical quiz snapshots will be preserved.
            </p>
          </>
        }
        confirmLabel="Confirm Delete"
        tone="destructive"
        pending={isSubmittingAction}
        onConfirm={executeDelete}
        onCancel={() => {
          setDeletingId(null)
          setActionError(null)
        }}
      />
    </div>
  )
}
