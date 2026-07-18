import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db/database'
import { QuizRepository } from '../db/repositories/QuizRepository'
import { SubjectRepository } from '../db/repositories/SubjectRepository'
import { computeDashboardMetrics } from '../utils/dashboardMetrics'
import { type QuizAttempt, type Subject } from '../types/db'

import { Button } from '../components/ui/Button'
import { buttonStyles } from '../components/ui/buttonStyles'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingState } from '../components/ui/LoadingState'
import { PageHeader } from '../components/ui/PageHeader'
import { Alert } from '../components/ui/Alert'

const quizRepo = new QuizRepository(db)
const subjectRepo = new SubjectRepository(db)

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])

  useEffect(() => {
    let active = true
    const loadDashboardData = async () => {
      setLoading(true)
      setHasError(false)
      try {
        const loadedSubjects = await subjectRepo.getAll()
        const loadedAttempts = await quizRepo.getAllAttempts()
        if (active) {
          setSubjects(loadedSubjects)
          setAttempts(loadedAttempts)
          setLoading(false)
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err)
        if (active) {
          setHasError(true)
          setLoading(false)
        }
      }
    }

    loadDashboardData()
    return () => {
      active = false
    }
  }, [])

  const formatTotalTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return <LoadingState label="Loading dashboard metrics…" />
  }

  if (hasError) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-8">
        <Alert variant="danger">
          <div className="space-y-2">
            <p className="font-semibold text-danger-text">Database Connection Error</p>
            <p>We encountered an issue reading your quiz history from the database.</p>
            <p className="text-xs opacity-90">Refresh the page and try again. TurboQuiz stores its data locally in this browser.</p>
          </div>
        </Alert>
        <Button onClick={() => window.location.reload()} variant="primary" className="w-full sm:w-auto">
          Reload Dashboard
        </Button>
      </div>
    )
  }

  const metrics = computeDashboardMetrics(attempts, subjects)
  const recentAttempts = attempts.slice(0, 5)

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <PageHeader
        title="Dashboard"
        description="Track your overall performance, strengths, and subject-level proficiency."
        action={attempts.length > 0 ? (
          <Link to="/quiz/setup" className={buttonStyles({ variant: 'primary' })}>
            Start a quiz
          </Link>
        ) : undefined}
      />

      {attempts.length === 0 ? (
        <EmptyState
          title={subjects.length === 0 ? 'Build your study library' : 'Ready for your first quiz'}
          description={subjects.length === 0
            ? 'Create a subject, add a few questions, then return here to begin tracking your progress.'
            : 'Your subjects are ready. Complete a quiz to unlock accuracy, time, and proficiency insights.'}
          icon={
            <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
          action={
            <Link
              to={subjects.length === 0 ? '/subjects' : '/quiz/setup'}
              className={buttonStyles({ variant: 'primary', size: 'lg' })}
            >
              {subjects.length === 0 ? 'Create your first subject' : 'Start your first quiz'}
            </Link>
          }
        />
      ) : (
        <>
          <section aria-label="Study summary">
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border-subtle bg-border-subtle sm:grid-cols-4">
              <div className="bg-surface-raised px-4 py-4 sm:px-5">
                <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">Completed Quizzes</dt>
                <dd className="mt-1 font-serif text-2xl font-semibold text-text-main">{metrics.totalAttempts}</dd>
              </div>
              <div className="bg-surface-raised px-4 py-4 sm:px-5">
                <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">Overall Accuracy</dt>
                <dd className="mt-1 font-serif text-2xl font-semibold text-primary-text">{metrics.overallAccuracy}%</dd>
                <dd className="mt-0.5 text-xs text-text-muted">
                  {metrics.totalCorrect} / {metrics.totalQuestionsPresented} Questions Included
                </dd>
              </div>
              <div className="bg-surface-raised px-4 py-4 sm:px-5">
                <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">Total Questions Included</dt>
                <dd className="mt-1 font-serif text-2xl font-semibold text-text-main">{metrics.totalQuestionsPresented}</dd>
              </div>
              <div className="bg-surface-raised px-4 py-4 sm:px-5">
                <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">Total Time Spent</dt>
                <dd className="mt-1 font-serif text-2xl font-semibold text-text-main">{formatTotalTime(metrics.totalTimeSpentSeconds)}</dd>
              </div>
            </dl>
          </section>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-5">
            <section className="space-y-4 lg:col-span-3">
              <h2 className="text-base font-semibold text-text-main">Subject Proficiency</h2>
              <ul className="divide-y divide-border-subtle border-t border-border-subtle">
                {Object.values(metrics.subjectPerformance).map((subMetric) => {
                  const acc = subMetric.accuracyPercentage
                  let accBarColor = 'bg-danger-text'
                  let accTextColor = 'text-danger-text'
                  if (acc >= 80) {
                    accBarColor = 'bg-success-text'
                    accTextColor = 'text-success-text'
                  } else if (acc >= 50) {
                    accBarColor = 'bg-warning-text'
                    accTextColor = 'text-warning-text'
                  }

                  return (
                    <li key={subMetric.subjectName} className="space-y-2 py-4">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-text-main">{subMetric.subjectName}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-text-muted">({subMetric.attemptsCount} attempts)</span>
                          <span className={`font-semibold ${accTextColor}`}>{acc}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-overlay">
                        <div
                          className={`h-full rounded-full ${accBarColor}`}
                          style={{ width: `${acc}%` }}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>

            <section className="space-y-4 lg:col-span-2">
              <h2 className="text-base font-semibold text-text-main">Modes Breakdown</h2>
              <ul className="divide-y divide-border-subtle border-t border-border-subtle">
                {[
                  { label: 'Practice', stats: metrics.practiceStats },
                  { label: 'Exam', stats: metrics.examStats },
                  { label: 'Mistakes', stats: metrics.mistakesStats },
                ].map((mode) => (
                  <li key={mode.label} className="flex items-center justify-between gap-4 py-3.5">
                    <div>
                      <p className="text-sm font-medium text-text-main">{mode.label}</p>
                      <p className="text-xs text-text-muted">
                        {mode.stats.attemptsCount} completions
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-text-main">
                        {mode.stats.attemptsCount > 0 ? `${mode.stats.accuracyPercentage}%` : '-'}
                      </p>
                      <p className="text-xs text-text-muted">Accuracy</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-text-main">Recent Attempts</h2>
              <Link
                to="/history"
                className="inline-flex min-h-9 items-center text-sm font-medium text-primary-text transition-colors hover:text-primary-hover focus:outline-none focus-visible:underline"
              >
                View Full History
              </Link>
            </div>

            <ul className="divide-y divide-border-subtle border-t border-border-subtle">
              {recentAttempts.map((attempt) => (
                <li key={attempt.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-medium text-text-main">{attempt.subjectNameSnap || 'Deleted Subject'}</h3>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
                      <span className="capitalize">{attempt.mode}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{formatDate(attempt.completedAt)}</span>
                      {attempt.topicNameSnap ? (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span>{attempt.topicNameSnap}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="text-left sm:text-right">
                      <p className="font-semibold text-text-main">
                        {attempt.correctAnswers} / {attempt.totalQuestions}
                      </p>
                      <p className="text-xs text-text-muted">{attempt.scorePercentage}% Score</p>
                    </div>
                    <Link
                      to={`/quiz/results/${attempt.id}`}
                      className={buttonStyles({ variant: 'secondary', size: 'sm' })}
                    >
                      Review
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
