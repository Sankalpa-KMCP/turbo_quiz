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
      <div>
        <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight sm:text-3xl">Subjects</h1>
        <p className="text-slate-400 text-sm mt-1">
          Manage the subjects you want to practice.
        </p>
      </div>

      {actionError && (
        <div role="alert" className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-4 py-3 rounded-xl text-sm">
          {actionError}
        </div>
      )}

      {/* Create Form */}
      <form onSubmit={handleCreateSubmit(onCreate)} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        <div className="flex-1 w-full">
          <label htmlFor="create-name" className="block text-sm font-medium text-slate-300 mb-1">
            New Subject Name
          </label>
          <input
            id="create-name"
            type="text"
            {...registerCreate('name')}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            placeholder="e.g. Mathematics"
          />
          {createErrors.name && (
            <p className="text-rose-400 text-xs mt-1">{createErrors.name.message}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={isCreating}
          className="w-full sm:w-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-slate-100 font-bold rounded-xl text-sm transition-colors cursor-pointer"
        >
          {isCreating ? 'Creating...' : 'Create Subject'}
        </button>
      </form>

      {/* List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-slate-400 text-sm p-4 text-center">Loading subjects...</div>
        ) : subjects.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
            <p className="text-slate-400 text-sm">No subjects found. Create one to get started.</p>
          </div>
        ) : (
          subjects.map((sub) => {
            const isEditingThis = editingId === sub.id
            const isDeletingThis = deletingId === sub.id
            const stats = subjectStats?.[sub.id] || { topics: 0, questions: 0 }

            return (
              <div key={sub.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 transition-all hover:border-slate-700">
                {isDeletingThis ? (
                  <div
                    role="dialog"
                    aria-modal="true"
                    className="space-y-4 focus:outline-none"
                    aria-labelledby={`delete-heading-${sub.id}`}
                    tabIndex={-1}
                  >
                    <div className="space-y-2">
                      <h3 id={`delete-heading-${sub.id}`} className="text-lg font-bold text-slate-100">
                        Delete Subject: {sub.name}
                      </h3>
                      <p className="text-sm text-slate-400">
                        Are you sure you want to delete this subject?
                        <span className="block text-rose-400 font-semibold mt-1">
                          This will permanently delete {stats.topics} topic(s) and {stats.questions} question(s). Historical quiz snapshots will be preserved.
                        </span>
                      </p>
                    </div>
                    <div className="flex gap-3 justify-end">
                      <button
                        ref={cancelRef}
                        type="button"
                        onClick={cancelDelete}
                        disabled={isSubmittingAction}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-sm cursor-pointer transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={executeDelete}
                        disabled={isSubmittingAction}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-slate-100 font-bold rounded-xl text-sm cursor-pointer transition-colors"
                      >
                        {isSubmittingAction ? 'Deleting...' : 'Confirm Delete'}
                      </button>
                    </div>
                  </div>
                ) : isEditingThis ? (
                  <form onSubmit={handleEditSubmit(onEdit)} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                    <div className="flex-1 w-full">
                      <label htmlFor={`edit-name-${sub.id}`} className="sr-only">Subject Name</label>
                      <input
                        id={`edit-name-${sub.id}`}
                        type="text"
                        {...registerEdit('name')}
                        className="w-full bg-slate-950 border border-indigo-500 rounded-xl px-4 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                        autoFocus
                      />
                      {editErrors.name && (
                        <p className="text-rose-400 text-xs mt-1">{editErrors.name.message}</p>
                      )}
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={cancelEditing}
                        disabled={isEditing}
                        className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-sm cursor-pointer transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isEditing}
                        className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-slate-100 font-bold rounded-xl text-sm cursor-pointer transition-colors"
                      >
                        {isEditing ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex-1">
                      <Link to={`/subjects/${sub.id}`} className="group">
                        <h2 className="text-xl font-bold text-slate-100 group-hover:text-indigo-400 transition-colors flex items-center gap-2">
                          {sub.name}
                          <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </h2>
                      </Link>
                      <div className="flex items-center gap-4 mt-2 text-xs font-medium text-slate-500">
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
                      <button
                        type="button"
                        onClick={() => startEditing(sub)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg text-xs cursor-pointer transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmDelete(sub.id)}
                        className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-medium rounded-lg text-xs cursor-pointer transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
