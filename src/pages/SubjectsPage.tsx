import { useState, useRef, useEffect } from 'react'
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

import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Alert } from '../components/ui/Alert'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingState } from '../components/ui/LoadingState'
import { PageHeader } from '../components/ui/PageHeader'

const subjectRepo = new SubjectRepository(db)
const topicRepo = new TopicRepository(db)
const questionRepo = new QuestionRepository(db)

// Define inline create form schema (same as create)
type CreateFormData = z.infer<typeof subjectCreateSchema>
type UpdateFormData = z.infer<typeof subjectUpdateSchema>

export default function SubjectsPage() {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSubmittingAction, setIsSubmittingAction] = useState(false)

  const cancelRef = useRef<HTMLButtonElement>(null)

  const subjects = useLiveQuery(() => subjectRepo.getAll())

  // To display counts efficiently, we run the counts for each subject.
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
    resolver: zodResolver(subjectCreateSchema) ,
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
      const setActionErr = setActionError;
      if (err instanceof DuplicateNameError) {
        setActionErr(`A subject named "${err.conflictingValue}" already exists.`)
      } else if (err instanceof ValidationError) {
        setActionErr('Validation error occurred.')
      } else {
        setActionErr(err instanceof Error ? err.message : String(err))
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

  const confirmDelete = (id: number) => {
    setActionError(null)
    setDeletingId(id)
  }

  const cancelDelete = () => {
    setDeletingId(null)
    setActionError(null)
  }

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

  useEffect(() => {
    if (deletingId !== null && cancelRef.current) {
      cancelRef.current.focus()
    }
  }, [deletingId])

  const isLoading = subjects === undefined

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <PageHeader
        title="Subjects"
        description="Organize your study library, then add topics and questions inside each subject."
      />

      {actionError && (
        <Alert variant="danger">
          {actionError}
        </Alert>
      )}

      {/* Create Form */}
      <Card className="p-4">
        <form onSubmit={handleCreateSubmit(onCreate)} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex-1 w-full">
            <label htmlFor="create-name" className="block text-sm font-medium text-text-main mb-1">
              New Subject Name
            </label>
            <Input
              id="create-name"
              {...registerCreate('name')}
              hasError={!!createErrors.name}
              placeholder="e.g. Mathematics"
            />
            {createErrors.name && (
              <p className="text-danger-text text-xs mt-1">{createErrors.name.message}</p>
            )}
          </div>
          <Button
            type="submit"
            disabled={isCreating}
            className="w-full sm:w-auto"
          >
            {isCreating ? 'Creating...' : 'Create Subject'}
          </Button>
        </form>
      </Card>

      {/* List */}
      <div className="space-y-4">
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
          subjects.map((sub) => {
            const isEditingThis = editingId === sub.id
            const isDeletingThis = deletingId === sub.id
            const stats = subjectStats?.[sub.id] || { topics: 0, questions: 0 }

            return (
              <Card key={sub.id} className="p-4 sm:p-6 transition-all hover:border-border-strong">
                {isDeletingThis ? (
                  <div
                    role="dialog"
                    aria-modal="true"
                    className="space-y-4 focus:outline-none"
                    aria-labelledby={`delete-heading-${sub.id}`}
                    tabIndex={-1}
                  >
                    <div className="space-y-2">
                      <h3 id={`delete-heading-${sub.id}`} className="text-lg font-bold text-text-main">
                        Delete Subject: {sub.name}
                      </h3>
                      <p className="text-sm text-text-muted">
                        Are you sure you want to delete this subject?
                        <span className="block text-danger-text font-semibold mt-1">
                          This will permanently delete {stats.topics} topic(s) and {stats.questions} question(s). Historical quiz snapshots will be preserved.
                        </span>
                      </p>
                    </div>
                    <div className="flex gap-3 justify-end">
                      <Button
                        ref={cancelRef}
                        type="button"
                        onClick={cancelDelete}
                        disabled={isSubmittingAction}
                        variant="secondary"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={executeDelete}
                        disabled={isSubmittingAction}
                        variant="danger"
                      >
                        {isSubmittingAction ? 'Deleting...' : 'Confirm Delete'}
                      </Button>
                    </div>
                  </div>
                ) : isEditingThis ? (
                  <form onSubmit={handleEditSubmit(onEdit)} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                    <div className="flex-1 w-full">
                      <label htmlFor={`edit-name-${sub.id}`} className="sr-only">Subject Name</label>
                      <Input
                        id={`edit-name-${sub.id}`}
                        {...registerEdit('name')}
                        hasError={!!editErrors.name}
                        autoFocus
                      />
                      {editErrors.name && (
                        <p className="text-danger-text text-xs mt-1">{editErrors.name.message}</p>
                      )}
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button
                        type="button"
                        onClick={cancelEditing}
                        disabled={isEditing}
                        variant="secondary"
                        className="flex-1 sm:flex-none"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isEditing}
                        variant="primary"
                        className="flex-1 sm:flex-none"
                      >
                        {isEditing ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex-1">
                      <Link to={`/subjects/${sub.id}`} className="group">
                        <h2 className="text-xl font-bold text-text-main group-hover:text-primary-text transition-colors flex items-center gap-2">
                          {sub.name}
                          <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </h2>
                      </Link>
                      <div className="flex items-center gap-4 mt-2 text-xs font-medium text-text-muted">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          {stats.topics} Topics
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {stats.questions} Questions
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() => startEditing(sub)}
                        variant="secondary"
                        size="sm"
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        onClick={() => confirmDelete(sub.id)}
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
          })
        )}
      </div>
    </div>
  )
}
