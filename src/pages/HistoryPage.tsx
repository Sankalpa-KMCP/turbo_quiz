import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db/database'
import { QuizRepository } from '../db/repositories/QuizRepository'
import { SubjectRepository } from '../db/repositories/SubjectRepository'
import { type QuizAttempt, type Subject } from '../types/db'

import { Alert } from '../components/ui/Alert'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { buttonStyles } from '../components/ui/buttonStyles'
import { Select } from '../components/ui/Select'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingState } from '../components/ui/LoadingState'
import { PageHeader } from '../components/ui/PageHeader'
import { cn } from '../utils/cn'

const quizRepo = new QuizRepository(db)
const subjectRepo = new SubjectRepository(db)

export default function HistoryPage() {
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])

  useEffect(() => {
    let active = true
    const loadHistoryData = async () => {
      setHasError(false)
      try {
        const loadedSubjects = await subjectRepo.getAll()
        const loadedAttempts = selectedSubjectId !== null
          ? await quizRepo.getAttemptsBySubject(selectedSubjectId)
          : await quizRepo.getAllAttempts()

        if (active) {
          setSubjects(loadedSubjects)
          setAttempts(loadedAttempts)
          setLoading(false)
        }
      } catch (err) {
        console.error('Failed to load history data:', err)
        if (active) {
          setHasError(true)
          setLoading(false)
        }
      }
    }

    loadHistoryData()
    return () => {
      active = false
    }
  }, [selectedSubjectId])

  const formatDate = (timestamp: number) => {
    try {
      return new Date(timestamp).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return 'Unknown Date'
    }
  }

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const remainingSecs = Math.round(secs % 60)
    return `${mins}m ${remainingSecs}s`
  }

  if (loading) {
    return <LoadingState label="Loading quiz history…" />
  }

  if (hasError) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-4">
        <Alert variant="danger">
          <div className="space-y-2">
            <p className="font-semibold text-danger-text">Database Connection Error</p>
            <p>We encountered an issue reading your quiz history from the database.</p>
            <p className="text-xs opacity-90">
              Refresh the page and try again. TurboQuiz stores its data locally in this browser.
            </p>
          </div>
        </Alert>
        <Button onClick={() => window.location.reload()} variant="primary" className="w-full sm:w-auto">
          Reload History
        </Button>
      </div>
    )
  }

  const isOverallEmpty = selectedSubjectId === null && attempts.length === 0
  const isFilteredEmpty = selectedSubjectId !== null && attempts.length === 0

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title="Quiz History"
        description="Review completed sessions, compare scores, and open detailed scorecards."
        action={!isOverallEmpty ? (
          <div className="flex items-center gap-3">
            <label htmlFor="subject-filter" className="text-sm font-medium text-text-muted shrink-0">
              Subject
            </label>
            <Select
              id="subject-filter"
              value={selectedSubjectId === null ? '' : String(selectedSubjectId)}
              onChange={(e) => {
                const val = e.target.value
                setSelectedSubjectId(val === '' ? null : Number(val))
              }}
              className="w-48"
            >
              <option value="">All Subjects</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </Select>
          </div>
        ) : undefined}
      />

      {isOverallEmpty ? (
        <EmptyState
          title="No Past Attempts"
          description="Complete a quiz and its score, time, and question review will appear here."
          icon={
            <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          action={<Link to="/quiz/setup" className={buttonStyles({ variant: 'primary' })}>Start quiz</Link>}
        />
      ) : isFilteredEmpty ? (
        <EmptyState
          title="No Attempts for this Subject"
          description="Try choosing a different subject or start a new quiz attempt."
        />
      ) : (
        <>
          <div
            className="hidden overflow-x-auto md:block"
            tabIndex={0}
            role="region"
            aria-label="Quiz history table"
          >
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle text-xs font-semibold uppercase tracking-wider text-text-muted">
                  <th scope="col" className="py-3 pr-4 font-semibold">Quiz Info</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Mode</th>
                  <th scope="col" className="px-4 py-3 text-center font-semibold">Score</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Time Taken</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Date Completed</th>
                  <th scope="col" className="py-3 pl-4 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {attempts.map((attempt) => {
                  const hasPerfectScore = attempt.scorePercentage === 100
                  return (
                    <tr key={attempt.id} className="align-top">
                      <td className="py-4 pr-4">
                        <div className="font-medium text-text-main">
                          {attempt.subjectNameSnap || 'Deleted Subject'}
                        </div>
                        {attempt.topicNameSnap ? (
                          <div className="mt-0.5 text-xs text-text-muted">{attempt.topicNameSnap}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm font-medium capitalize text-text-main">{attempt.mode}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span
                          className={cn(
                            'text-base font-semibold',
                            hasPerfectScore ? 'text-primary-text' : 'text-text-main',
                          )}
                        >
                          {attempt.correctAnswers} / {attempt.totalQuestions}
                        </span>
                        <span className="mt-0.5 block text-xs text-text-muted">
                          {attempt.scorePercentage}%
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-text-main">
                        {formatDuration(attempt.timeTakenSeconds)}
                      </td>
                      <td className="px-4 py-4 text-sm text-text-muted whitespace-nowrap">
                        {formatDate(attempt.completedAt)}
                      </td>
                      <td className="py-4 pl-4 text-right">
                        <Link
                          to={`/quiz/results/${attempt.id}`}
                          className="inline-flex min-h-11 items-center justify-end text-sm font-semibold text-primary-text transition-colors hover:text-primary-hover focus:outline-none focus-visible:underline"
                        >
                          Review
                          <span className="sr-only">
                            {' '}
                            {attempt.subjectNameSnap || 'Deleted Subject'} attempt
                          </span>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-border-subtle border-t border-border-subtle md:hidden">
            {attempts.map((attempt) => (
              <li key={attempt.id} className="space-y-3 py-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-medium leading-tight text-text-main">
                      {attempt.subjectNameSnap || 'Deleted Subject'}
                    </h2>
                    {attempt.topicNameSnap ? (
                      <p className="mt-0.5 text-xs text-text-muted">{attempt.topicNameSnap}</p>
                    ) : null}
                  </div>
                  <Badge variant="default" className="capitalize">
                    {attempt.mode}
                  </Badge>
                </div>

                <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">Score</dt>
                    <dd className="mt-0.5 font-semibold text-text-main">
                      {attempt.correctAnswers}/{attempt.totalQuestions} ({attempt.scorePercentage}%)
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">Time</dt>
                    <dd className="mt-0.5 font-semibold text-text-main">
                      {formatDuration(attempt.timeTakenSeconds)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">Date</dt>
                    <dd className="mt-0.5 font-medium text-text-main">
                      {formatDate(attempt.completedAt)}
                    </dd>
                  </div>
                </dl>

                <Link
                  to={`/quiz/results/${attempt.id}`}
                  className={cn(buttonStyles({ variant: 'secondary', size: 'sm' }), 'w-full justify-center')}
                >
                  Review
                  <span className="sr-only">
                    {' '}
                    {attempt.subjectNameSnap || 'Deleted Subject'} attempt
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
