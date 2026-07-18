import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db/database'
import { QuizRepository } from '../db/repositories/QuizRepository'
import { SubjectRepository } from '../db/repositories/SubjectRepository'
import { type QuizAttempt, type Subject } from '../types/db'

import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { buttonStyles } from '../components/ui/buttonStyles'
import { Select } from '../components/ui/Select'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingState } from '../components/ui/LoadingState'
import { PageHeader } from '../components/ui/PageHeader'

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

  // Safe formatting helpers
  const formatDate = (timestamp: number) => {
    try {
      return new Date(timestamp).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
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
      <Card className="p-8 max-w-md mx-auto text-center space-y-6">
        <div className="inline-flex p-3 bg-danger-bg rounded-full text-danger-text">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-text-main">Database Connection Error</h2>
          <p className="text-sm text-text-muted">We encountered an issue reading your quiz history from the database.</p>
          <p className="text-xs text-text-muted mt-2">Refresh the page and try again. TurboQuiz stores its data locally in this browser.</p>
        </div>
        <Button
          onClick={() => window.location.reload()}
          variant="primary"
          className="w-full"
        >
          Reload History
        </Button>
      </Card>
    )
  }

  const isOverallEmpty = selectedSubjectId === null && attempts.length === 0
  const isFilteredEmpty = selectedSubjectId !== null && attempts.length === 0

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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
        <Card className="p-10 text-center space-y-2">
          <h2 className="text-lg font-bold text-text-main">No Attempts for this Subject</h2>
          <p className="text-sm text-text-muted">
            Try choosing a different subject or start a new quiz attempt.
          </p>
        </Card>
      ) : (
        /* History Grid & Responsive Table */
        <Card className="overflow-hidden p-0 border-border-subtle">
          {/* Desktop Table View */}
          <div
            className="hidden md:block overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label="Quiz history table"
          >
            <table className="w-full min-w-[768px] text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle text-xs text-text-muted font-semibold uppercase tracking-wider bg-surface-raised/60">
                  <th className="p-4 pl-6">Quiz Info</th>
                  <th className="p-4">Mode</th>
                  <th className="p-4 text-center">Score</th>
                  <th className="p-4">Time Taken</th>
                  <th className="p-4">Date Completed</th>
                  <th className="p-4 pr-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {attempts.map((attempt) => {
                  const hasPerfectScore = attempt.scorePercentage === 100
                  return (
                    <tr key={attempt.id} className="hover:bg-surface-overlay/20 transition-colors">
                      <td className="p-4 pl-6">
                        <div className="font-semibold text-text-main">
                          {attempt.subjectNameSnap || 'Deleted Subject'}
                        </div>
                        {attempt.topicNameSnap && (
                          <div className="text-xs text-text-muted">{attempt.topicNameSnap}</div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="capitalize text-text-main text-sm font-medium">{attempt.mode}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`text-base font-bold ${hasPerfectScore ? 'text-primary-text' : 'text-text-main'}`}>
                          {attempt.correctAnswers} / {attempt.totalQuestions}
                        </span>
                        <span className="block text-xs text-text-muted">{attempt.scorePercentage}%</span>
                      </td>
                      <td className="p-4 text-text-main text-sm font-medium">
                        {formatDuration(attempt.timeTakenSeconds)}
                      </td>
                      <td className="p-4 text-text-muted text-sm">
                        {formatDate(attempt.completedAt)}
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <Link
                          to={`/quiz/results/${attempt.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-primary-text hover:text-primary-hover transition-colors focus:outline-none focus:underline"
                          title="Review attempt scorecard"
                        >
                          Review
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="md:hidden divide-y divide-border-subtle">
            {attempts.map((attempt) => (
              <div key={attempt.id} className="p-5 space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h2 className="font-bold text-text-main leading-tight">
                      {attempt.subjectNameSnap || 'Deleted Subject'}
                    </h2>
                    {attempt.topicNameSnap && (
                      <p className="text-xs text-text-muted mt-0.5">{attempt.topicNameSnap}</p>
                    )}
                  </div>
                  <Badge variant="default" className="capitalize">
                    {attempt.mode}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-surface-base/40 p-2 rounded-lg border border-border-subtle">
                    <span className="block text-text-muted font-semibold uppercase tracking-wider mb-1">Score</span>
                    <span className="font-bold text-text-main">
                      {attempt.correctAnswers}/{attempt.totalQuestions} ({attempt.scorePercentage}%)
                    </span>
                  </div>
                  <div className="bg-surface-base/40 p-2 rounded-lg border border-border-subtle">
                    <span className="block text-text-muted font-semibold uppercase tracking-wider mb-1">Time</span>
                    <span className="font-bold text-text-main">{formatDuration(attempt.timeTakenSeconds)}</span>
                  </div>
                  <div className="bg-surface-base/40 p-2 rounded-lg border border-border-subtle">
                    <span className="block text-text-muted font-semibold uppercase tracking-wider mb-1">Date</span>
                    <span className="font-bold text-text-muted">
                      {new Date(attempt.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <Link
                    to={`/quiz/results/${attempt.id}`}
                    className="inline-flex min-h-11 w-full sm:w-auto justify-center items-center gap-1.5 px-4 py-2 bg-surface-overlay hover:bg-border-strong text-text-main font-bold rounded-xl text-xs transition-colors border border-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
                  >
                    View Scorecard
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
