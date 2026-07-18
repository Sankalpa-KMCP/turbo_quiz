import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { SubjectRepository } from '../db/repositories/SubjectRepository'
import { TopicRepository } from '../db/repositories/TopicRepository'
import { QuestionRepository } from '../db/repositories/QuestionRepository'
import { useQuizSessionStore } from '../stores/quizSessionStore'

import { Button } from '../components/ui/Button'
import { buttonStyles } from '../components/ui/buttonStyles'
import { Select } from '../components/ui/Select'
import { Alert } from '../components/ui/Alert'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingState } from '../components/ui/LoadingState'
import { PageHeader } from '../components/ui/PageHeader'
import { Field } from '../components/ui/Field'
import { cn } from '../utils/cn'

const subjectRepo = new SubjectRepository(db)
const topicRepo = new TopicRepository(db)
const questionRepo = new QuestionRepository(db)

export default function QuizSetupPage() {
  const navigate = useNavigate()
  const configureSetup = useQuizSessionStore((s) => s.configureSetup)
  const startSession = useQuizSessionStore((s) => s.startSession)
  const storePhase = useQuizSessionStore((s) => s.phase)
  const storeError = useQuizSessionStore((s) => s.error)
  const resetSession = useQuizSessionStore((s) => s.resetSession)

  const [selectedSubjectId, setSelectedSubjectId] = useState<number | ''>('')
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null)
  const [mode, setMode] = useState<'practice' | 'exam'>('practice')
  const [questionCount, setQuestionCount] = useState<number | 'all'>('all')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    resetSession()
  }, [resetSession])

  const subjectsQuery = useLiveQuery(() => subjectRepo.getAll())
  const subjects = subjectsQuery || []

  const topicsQuery = useLiveQuery(
    () => (selectedSubjectId ? topicRepo.getBySubject(selectedSubjectId) : Promise.resolve([])),
    [selectedSubjectId],
  )
  const topics = topicsQuery ?? []

  const eligibilitySelectionKey = selectedSubjectId
    ? `${selectedSubjectId}:${selectedTopicId ?? 'all'}`
    : 'none'

  const eligibleCountQuery = useLiveQuery(
    async () => {
      if (!selectedSubjectId) {
        return { key: 'none' as const, count: 0 }
      }
      const count = selectedTopicId !== null
        ? await questionRepo.countByTopic(selectedTopicId)
        : await questionRepo.countBySubject(selectedSubjectId)
      return {
        key: `${selectedSubjectId}:${selectedTopicId ?? 'all'}`,
        count,
      }
    },
    [selectedSubjectId, selectedTopicId],
  )

  const eligibleCountResolved =
    eligibleCountQuery !== undefined && eligibleCountQuery.key === eligibilitySelectionKey
  const eligibleCountPending = Boolean(selectedSubjectId) && !eligibleCountResolved
  const eligibleCount = eligibleCountResolved ? eligibleCountQuery.count : 0

  const activeQuestionCount =
    questionCount !== 'all' && eligibleCount > 0 && questionCount > eligibleCount
      ? 'all'
      : questionCount

  const selectedSubject = subjects.find((sub) => sub.id === selectedSubjectId)
  const selectedTopic = topics.find((top) => top.id === selectedTopicId)

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSubjectId) {
      setErrorMsg('Please select a subject')
      return
    }
    if (eligibleCountPending) {
      return
    }
    if (eligibleCount === 0) {
      setErrorMsg('Cannot start a quiz with 0 eligible questions')
      return
    }

    setErrorMsg(null)

    try {
      configureSetup({
        subjectId: selectedSubjectId,
        topicId: selectedTopicId,
        mode,
        questionCount: activeQuestionCount,
      })
      await startSession()
    } catch {
      // Errors are captured in the store state
    }
  }

  useEffect(() => {
    if (storePhase === 'playing') {
      navigate('/quiz/play')
    }
  }, [storePhase, navigate])

  const countOptions = [5, 10, 15, 20]

  if (subjectsQuery === undefined) {
    return <LoadingState label="Loading quiz setup…" />
  }

  if (subjects.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Configure Quiz"
          description="Choose what to study and how you want feedback delivered."
        />
        <EmptyState
          title="Create a subject before starting"
          description="Quizzes draw from the questions in your subject library. Create a subject and add questions first."
          icon={
            <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.75 11.17l-3.2-2.13A1 1 0 0010 9.87v4.26a1 1 0 001.55.83l3.2-2.13a1 1 0 000-1.66z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          action={<Link to="/subjects" className={buttonStyles({ variant: 'primary' })}>Create a subject</Link>}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title="Configure Quiz"
        description="Choose what to study and how you want feedback delivered."
      />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.9fr)] lg:items-start">
        <form onSubmit={handleStart} className="space-y-8">
          <section className="space-y-5" aria-labelledby="setup-scope-heading">
            <div className="border-b border-border-subtle pb-3">
              <h2 id="setup-scope-heading" className="text-base font-semibold text-text-main">
                Study scope
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                Pick the subject and optional topic that will supply the question set.
              </p>
            </div>

            <Field
              id="subject-select"
              label="Subject"
              required
              error={errorMsg && !selectedSubjectId ? errorMsg : undefined}
            >
              <Select
                value={selectedSubjectId}
                onChange={(e) => {
                  setSelectedSubjectId(e.target.value ? Number(e.target.value) : '')
                  setSelectedTopicId(null)
                }}
                required
                hasError={!!errorMsg && !selectedSubjectId}
                aria-describedby={(errorMsg || storeError) ? 'setup-error' : undefined}
              >
                <option value="">Select a Subject</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              id="topic-select"
              label="Topic"
              optional
              helperText={!selectedSubjectId ? 'Select a subject to choose a topic.' : undefined}
            >
              <Select
                value={selectedTopicId === null ? '' : selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value ? Number(e.target.value) : null)}
                disabled={!selectedSubjectId}
              >
                <option value="">All Topics</option>
                {topics.map((top) => (
                  <option key={top.id} value={top.id}>
                    {top.name}
                  </option>
                ))}
              </Select>
            </Field>
          </section>

          <section className="space-y-5" aria-labelledby="setup-mode-heading">
            <div className="border-b border-border-subtle pb-3">
              <h2 id="setup-mode-heading" className="text-base font-semibold text-text-main">
                Session options
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                Practice reveals feedback immediately. Exam waits until you finish.
              </p>
            </div>

            <fieldset className="m-0 space-y-3 border-none p-0">
              <legend className="text-sm font-medium text-text-main">Quiz Mode</legend>
              <div
                className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                role="presentation"
              >
                {(
                  [
                    {
                      value: 'practice' as const,
                      title: 'Practice',
                      description: 'Instant answer feedback',
                    },
                    {
                      value: 'exam' as const,
                      title: 'Exam',
                      description: 'Results shown at the end',
                    },
                  ]
                ).map((option) => {
                  const checked = mode === option.value
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        'relative flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition-colors',
                        'focus-within:ring-2 focus-within:ring-border-focus focus-within:ring-offset-2 focus-within:ring-offset-surface-base',
                        checked
                          ? 'border-primary-base bg-primary-bg'
                          : 'border-border-subtle bg-surface-raised hover:border-border-strong hover:bg-surface-overlay',
                      )}
                    >
                      <input
                        type="radio"
                        name="mode"
                        value={option.value}
                        checked={checked}
                        onChange={() => setMode(option.value)}
                        className="mt-1 size-4 shrink-0 border-border-strong text-primary-base focus:ring-border-focus"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-text-main">
                          {option.title}
                          {checked ? (
                            <span className="sr-only"> (selected)</span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-xs text-text-muted">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <Field
              id="count-select"
              label="Number of Questions"
              helperText={
                !selectedSubjectId
                  ? undefined
                  : eligibleCountPending
                    ? 'Checking how many questions are available for this selection…'
                    : `Up to ${eligibleCount} eligible question${eligibleCount === 1 ? '' : 's'} for this selection.`
              }
            >
              <Select
                value={activeQuestionCount}
                onChange={(e) => setQuestionCount(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                disabled={!selectedSubjectId || eligibleCountPending || eligibleCount === 0}
                aria-busy={eligibleCountPending || undefined}
              >
                <option value="all">
                  {eligibleCountPending
                    ? 'All Questions (…)'
                    : `All Questions (${eligibleCount})`}
                </option>
                {countOptions.map((opt) => (
                  <option key={opt} value={opt} disabled={eligibleCountPending || opt > eligibleCount}>
                    {opt} Questions
                  </option>
                ))}
              </Select>
            </Field>
          </section>

          {selectedSubjectId ? (
            <p className="text-sm text-text-muted" aria-live="polite">
              {eligibleCountPending ? (
                'Checking available questions…'
              ) : (
                <>
                  Available questions:{' '}
                  <span className="font-semibold text-primary-text">{eligibleCount}</span>
                </>
              )}
            </p>
          ) : null}

          {selectedSubjectId && !eligibleCountPending && eligibleCount === 0 ? (
            <Alert variant="warning">
              <div>
                <span className="font-semibold">This selection has no questions yet.</span>{' '}
                <Link
                  to={`/questions/new?subjectId=${selectedSubjectId}${selectedTopicId !== null ? `&topicId=${selectedTopicId}` : ''}`}
                  className="font-semibold underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                >
                  Add a question
                </Link>
                {' '}to unlock the quiz.
              </div>
            </Alert>
          ) : null}

          {(errorMsg || storeError) && (
            <Alert variant="danger" id="setup-error">
              {errorMsg || storeError}
            </Alert>
          )}

          <div className="flex flex-col gap-3 border-t border-border-subtle pt-6 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="submit"
              disabled={
                !selectedSubjectId
                || eligibleCountPending
                || eligibleCount === 0
                || storePhase === 'loading'
              }
              variant="primary"
              className="w-full sm:w-auto sm:min-w-44"
            >
              {storePhase === 'loading' ? 'Loading questions…' : 'Start Quiz'}
            </Button>
          </div>
        </form>

        <aside
          className="rounded-lg border border-border-subtle bg-surface-raised p-5 lg:sticky lg:top-6"
          aria-labelledby="session-summary-heading"
        >
          <h2 id="session-summary-heading" className="font-serif text-lg font-semibold tracking-tight text-text-main">
            Session summary
          </h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div className="border-b border-border-subtle pb-3">
              <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">Subject</dt>
              <dd className="mt-1 font-medium text-text-main">
                {selectedSubject?.name ?? 'Not selected'}
              </dd>
            </div>
            <div className="border-b border-border-subtle pb-3">
              <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">Topic</dt>
              <dd className="mt-1 font-medium text-text-main">
                {!selectedSubjectId
                  ? '—'
                  : selectedTopic?.name ?? 'All topics'}
              </dd>
            </div>
            <div className="border-b border-border-subtle pb-3">
              <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">Mode</dt>
              <dd className="mt-1 font-medium capitalize text-text-main">{mode}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">Questions</dt>
              <dd className="mt-1 font-medium text-text-main">
                {!selectedSubjectId
                  ? '—'
                  : eligibleCountPending
                    ? 'Checking…'
                    : activeQuestionCount === 'all'
                      ? `All (${eligibleCount})`
                      : `${activeQuestionCount} of ${eligibleCount}`}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  )
}
