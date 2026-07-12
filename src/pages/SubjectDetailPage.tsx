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

    // There isn't a direct "countUncategorized" method, but we can do it by querying all questions for subject
    // and subtracting the sum of topic counts, or just fetching the questions.
    // However, QuestionRepository.search supports topicFilter: { kind: 'uncategorized' }.
    // Let's just use countByTopic for each topic, and for uncategorized we could fetch them or compute.
    // Actually, countBySubject minus sum(topicCounts) might not be perfectly safe if some topics are orphaned,
    // but topics are strictly linked to subjects. Let's just do countBySubject and subtract the topic sums,
    // or fetch the questions to be 100% accurate.
    // Wait, the search method can return the array. Let's do `search` with uncategorized.
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
        <h1 className="text-2xl font-bold text-slate-100">Invalid Subject ID</h1>
        <p className="text-slate-400">The provided subject ID is malformed.</p>
        <Link to="/subjects" className="text-indigo-400 hover:underline">Back to Subjects</Link>
      </div>
    )
  }

  // Loading state
  if (subject === undefined) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="text-slate-400 text-sm">Loading subject...</div>
      </div>
    )
  }

  if (subject === null) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-slate-100">Subject Not Found</h1>
        <p className="text-slate-400">The subject you are looking for does not exist or has been deleted.</p>
        <Link to="/subjects" className="text-indigo-400 hover:underline">Back to Subjects</Link>
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

  const cancelTopicDelete = () => {
    setDeletingTopicId(null)
    setActionError(null)
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
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col gap-4 relative">
        <Link to="/subjects" className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center gap-1 w-fit">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Subjects
        </Link>

        {isEditingSubject ? (
          <form onSubmit={handleSubjectEditSubmit(onSubjectEdit)} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end mt-2">
            <div className="flex-1 w-full max-w-sm">
              <label htmlFor="edit-subject-name" className="sr-only">Subject Name</label>
              <input
                id="edit-subject-name"
                type="text"
                {...registerSubjectEdit('name')}
                className="w-full bg-slate-950 border border-indigo-500 rounded-xl px-4 py-2 text-slate-200 text-xl font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                autoFocus
              />
              {subjectEditErrors.name && (
                <p className="text-rose-400 text-xs mt-1">{subjectEditErrors.name.message}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelSubjectEdit}
                disabled={isSubjectEditing}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-sm cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubjectEditing}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-slate-100 font-bold rounded-xl text-sm cursor-pointer transition-colors"
              >
                {isSubjectEditing ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight sm:text-3xl">{subject.name}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                <span>{topics?.length || 0} Topics</span>
                <span>{stats?.total || 0} Questions</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={startSubjectEdit}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg text-xs cursor-pointer transition-colors"
              >
                Edit Subject Name
              </button>
              <Link
                to={`/questions/new?subjectId=${subject.id}`}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-slate-100 font-medium rounded-lg text-xs cursor-pointer transition-colors"
              >
                + New Question
              </Link>
            </div>
          </div>
        )}
      </div>

      {actionError && (
        <div role="alert" className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-4 py-3 rounded-xl text-sm">
          {actionError}
        </div>
      )}

      {/* Topics Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <h2 className="text-xl font-bold text-slate-200">Topics</h2>
          <Link to={`/questions?subjectId=${subject.id}`} className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
            View All Questions in Subject &rarr;
          </Link>
        </div>

        {/* Uncategorized Pseudo-Topic */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 sm:p-6 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-slate-300 italic">Uncategorized</h3>
            <p className="text-xs text-slate-500 mt-1">{stats?.uncategorized || 0} Questions</p>
          </div>
          <div className="flex gap-2">
             <Link
                to={`/questions?subjectId=${subject.id}&topicId=uncategorized`}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg text-xs cursor-pointer transition-colors"
              >
                View Questions
              </Link>
          </div>
        </div>

        {/* Topics List */}
        {topics?.map(t => {
          const isEditingThis = editingTopicId === t.id
          const isDeletingThis = deletingTopicId === t.id
          const qCount = stats?.topics[t.id] || 0

          return (
            <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 transition-all hover:border-slate-700">
              {isDeletingThis ? (
                <div
                  className="space-y-4 focus:outline-none"
                  aria-labelledby={`delete-topic-heading-${t.id}`}
                  tabIndex={-1}
                >
                  <div className="space-y-2">
                    <h3 id={`delete-topic-heading-${t.id}`} className="text-lg font-bold text-slate-100">
                      Delete Topic: {t.name}
                    </h3>
                    <p className="text-sm text-slate-400">
                      Are you sure you want to delete this topic?
                      <span className="block text-amber-400 font-semibold mt-1">
                        Any current questions linked to this topic will become Uncategorized under this subject. Historical quiz snapshots will be preserved.
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button
                      ref={cancelRef}
                      type="button"
                      onClick={cancelTopicDelete}
                      disabled={isSubmittingAction}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-sm cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={executeTopicDelete}
                      disabled={isSubmittingAction}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-slate-100 font-bold rounded-xl text-sm cursor-pointer transition-colors"
                    >
                      {isSubmittingAction ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                  </div>
                </div>
              ) : isEditingThis ? (
                <form onSubmit={handleTopicEditSubmit(onTopicEdit)} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                  <div className="flex-1 w-full">
                    <label htmlFor={`edit-topic-${t.id}`} className="sr-only">Topic Name</label>
                    <input
                      id={`edit-topic-${t.id}`}
                      type="text"
                      {...registerTopicEdit('name')}
                      className="w-full bg-slate-950 border border-indigo-500 rounded-xl px-4 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                      autoFocus
                    />
                    {topicEditErrors.name && (
                      <p className="text-rose-400 text-xs mt-1">{topicEditErrors.name.message}</p>
                    )}
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={cancelTopicEdit}
                      disabled={isTopicEditing}
                      className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-sm cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isTopicEditing}
                      className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-slate-100 font-bold rounded-xl text-sm cursor-pointer transition-colors"
                    >
                      {isTopicEditing ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-100">{t.name}</h3>
                    <p className="text-xs text-slate-400 mt-1">{qCount} Questions</p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      to={`/questions/new?subjectId=${subject.id}&topicId=${t.id}`}
                      className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 font-medium rounded-lg text-xs cursor-pointer transition-colors"
                    >
                      + New
                    </Link>
                    <Link
                      to={`/questions?subjectId=${subject.id}&topicId=${t.id}`}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg text-xs cursor-pointer transition-colors"
                    >
                      Questions
                    </Link>
                    <button
                      type="button"
                      onClick={() => startTopicEdit(t)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg text-xs cursor-pointer transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmTopicDelete(t.id)}
                      className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-medium rounded-lg text-xs cursor-pointer transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Create Topic Form */}
        <form onSubmit={handleTopicCreateSubmit(onTopicCreate)} className="bg-slate-900 border border-dashed border-slate-700 p-4 rounded-2xl flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex-1 w-full">
            <label htmlFor="create-topic-name" className="block text-sm font-medium text-slate-300 mb-1">
              New Topic Name
            </label>
            <input
              id="create-topic-name"
              type="text"
              {...registerTopicCreate('name')}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              placeholder="e.g. Algebra"
            />
            {topicCreateErrors.name && (
              <p className="text-rose-400 text-xs mt-1">{topicCreateErrors.name.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={isTopicCreating}
            className="w-full sm:w-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-slate-100 font-bold rounded-xl text-sm transition-colors cursor-pointer"
          >
            {isTopicCreating ? 'Creating...' : 'Create Topic'}
          </button>
        </form>
      </div>
    </div>
  )
}
