import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { SubjectRepository } from '../db/repositories/SubjectRepository'
import { TopicRepository } from '../db/repositories/TopicRepository'
import { QuestionRepository } from '../db/repositories/QuestionRepository'
import { useQuizSessionStore } from '../stores/quizSessionStore'

import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { buttonStyles } from '../components/ui/buttonStyles'
import { Select } from '../components/ui/Select'
import { Alert } from '../components/ui/Alert'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingState } from '../components/ui/LoadingState'
import { PageHeader } from '../components/ui/PageHeader'

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

  // Reset the store when we enter the setup page to clear past sessions
  useEffect(() => {
    resetSession()
  }, [resetSession])

  // Load all subjects alphabetically
  const subjectsQuery = useLiveQuery(() => subjectRepo.getAll())
  const subjects = subjectsQuery || []

  // Load topics for selected subject
  const topics = useLiveQuery(
    () => (selectedSubjectId ? topicRepo.getBySubject(selectedSubjectId) : Promise.resolve([])),
    [selectedSubjectId]
  ) || []

  // Compute eligible questions count
  const eligibleCount = useLiveQuery(
    async () => {
      if (!selectedSubjectId) return 0
      if (selectedTopicId !== null) {
        return await questionRepo.countByTopic(selectedTopicId)
      } else {
        return await questionRepo.countBySubject(selectedSubjectId)
      }
    },
    [selectedSubjectId, selectedTopicId]
  ) ?? 0

  const activeQuestionCount =
    questionCount !== 'all' && eligibleCount > 0 && questionCount > eligibleCount
      ? 'all'
      : questionCount

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSubjectId) {
      setErrorMsg('Please select a subject')
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
        questionCount: activeQuestionCount
      })
      await startSession()
    } catch {
      // Errors will be captured in the store state or thrown
    }
  }

  // Redirect to play page if store phase transitions to playing
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
      <div className="max-w-2xl mx-auto space-y-6">
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
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Configure Quiz"
        description="Choose what to study and how you want feedback delivered."
      />

      <Card className="p-6">
        <form onSubmit={handleStart} className="space-y-6">
          {/* Subject Select */}
          <div className="space-y-2">
            <label htmlFor="subject-select" className="block text-sm font-semibold text-text-main">
              Subject <span className="text-danger-text">*</span>
            </label>
            <Select
              id="subject-select"
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
          </div>

          {/* Topic Select */}
          <div className="space-y-2">
            <label htmlFor="topic-select" className="block text-sm font-semibold text-text-main">
              Topic
            </label>
            <Select
              id="topic-select"
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
          </div>

          {/* Mode fieldset */}
          <fieldset className="space-y-2 border-none p-0 m-0">
            <legend className="text-sm font-semibold text-text-main mb-2">Quiz Mode</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={`flex min-h-14 items-center gap-3 rounded-xl border p-3 text-sm text-text-main cursor-pointer transition-colors ${mode === 'practice' ? 'border-primary-base/60 bg-primary-bg' : 'border-border-subtle bg-surface-base hover:border-border-strong'}`}>
                <input
                  type="radio"
                  name="mode"
                  value="practice"
                  checked={mode === 'practice'}
                  onChange={() => setMode('practice')}
                  className="size-4 shrink-0 text-primary-base bg-surface-base border-border-strong focus:ring-primary-base cursor-pointer"
                />
                <span><strong className="block font-semibold">Practice</strong><span className="text-xs text-text-muted">Instant answer feedback</span></span>
              </label>
              <label className={`flex min-h-14 items-center gap-3 rounded-xl border p-3 text-sm text-text-main cursor-pointer transition-colors ${mode === 'exam' ? 'border-primary-base/60 bg-primary-bg' : 'border-border-subtle bg-surface-base hover:border-border-strong'}`}>
                <input
                  type="radio"
                  name="mode"
                  value="exam"
                  checked={mode === 'exam'}
                  onChange={() => setMode('exam')}
                  className="size-4 shrink-0 text-primary-base bg-surface-base border-border-strong focus:ring-primary-base cursor-pointer"
                />
                <span><strong className="block font-semibold">Exam</strong><span className="text-xs text-text-muted">Results shown at the end</span></span>
              </label>
            </div>
          </fieldset>

          {/* Question Count Select */}
          <div className="space-y-2">
            <label htmlFor="count-select" className="block text-sm font-semibold text-text-main">
              Number of Questions
            </label>
            <Select
              id="count-select"
              value={activeQuestionCount}
              onChange={(e) => setQuestionCount(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              disabled={!selectedSubjectId || eligibleCount === 0}
            >
              <option value="all">All Questions ({eligibleCount})</option>
              {countOptions.map((opt) => (
                <option key={opt} value={opt} disabled={opt > eligibleCount}>
                  {opt} Questions
                </option>
              ))}
            </Select>
          </div>

          {/* Live eligible questions count indicator */}
          {selectedSubjectId ? (
            <div className="text-sm text-text-muted" aria-live="polite">
              Available questions: <span className="font-semibold text-primary-text">{eligibleCount}</span>
            </div>
          ) : null}

          {selectedSubjectId && eligibleCount === 0 ? (
            <Alert variant="warning">
              <div>
                <span className="font-semibold">This selection has no questions yet.</span>{' '}
                <Link
                  to={`/questions/new?subjectId=${selectedSubjectId}${selectedTopicId !== null ? `&topicId=${selectedTopicId}` : ''}`}
                  className="font-bold underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                >
                  Add a question
                </Link>
                {' '}to unlock the quiz.
              </div>
            </Alert>
          ) : null}

          {/* Error display */}
          {(errorMsg || storeError) && (
            <Alert variant="danger" id="setup-error">
              {errorMsg || storeError}
            </Alert>
          )}

          {/* Start Button */}
          <Button
            type="submit"
            disabled={!selectedSubjectId || eligibleCount === 0 || storePhase === 'loading'}
            variant="primary"
            className="w-full py-3 font-bold"
          >
            {storePhase === 'loading' ? 'Loading questions...' : 'Start Quiz'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
