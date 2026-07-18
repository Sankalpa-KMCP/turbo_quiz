import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db/database'
import { QuizRepository } from '../db/repositories/QuizRepository'
import { SubjectRepository } from '../db/repositories/SubjectRepository'
import { computeDashboardMetrics } from '../utils/dashboardMetrics'
import { type QuizAttempt, type Subject } from '../types/db'

import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { buttonStyles } from '../components/ui/buttonStyles'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingState } from '../components/ui/LoadingState'
import { PageHeader } from '../components/ui/PageHeader'

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

  // Format total seconds into human readable duration
  const formatTotalTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  // Format simple date
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
          Reload Dashboard
        </Button>
      </Card>
    )
  }

  const metrics = computeDashboardMetrics(attempts, subjects)
  const recentAttempts = attempts.slice(0, 5)

  return (
    <div className="max-w-6xl mx-auto space-y-8">
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
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
          {/* Stats Deck Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card className="p-5 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted block">Completed Quizzes</span>
              <span className="text-3xl font-bold text-text-main">{metrics.totalAttempts}</span>
            </Card>

            <Card className="p-5 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted block">Overall Accuracy</span>
              <span className="text-3xl font-bold text-primary-text">{metrics.overallAccuracy}%</span>
              <span className="text-[10px] text-text-muted block">
                {metrics.totalCorrect} / {metrics.totalQuestionsPresented} Questions Included
              </span>
            </Card>

            <Card className="p-5 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted block">Total Questions Included</span>
              <span className="text-3xl font-bold text-text-main">{metrics.totalQuestionsPresented}</span>
            </Card>

            <Card className="p-5 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted block">Total Time Spent</span>
              <span className="text-3xl font-bold text-text-main">{formatTotalTime(metrics.totalTimeSpentSeconds)}</span>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Subject Level proficiency list */}
            <Card className="p-6 space-y-6 lg:col-span-2">
              <h2 className="text-lg font-bold text-text-main">Subject Proficiency</h2>
              <div className="space-y-4">
                {Object.values(metrics.subjectPerformance).map((subMetric, idx) => {
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
                    <div key={idx} className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-semibold text-text-main">{subMetric.subjectName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-text-muted">({subMetric.attemptsCount} attempts)</span>
                          <span className={`font-bold ${accTextColor}`}>{acc}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-surface-base h-2.5 rounded-full overflow-hidden border border-border-subtle">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${accBarColor}`}
                          style={{ width: `${acc}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* Mode comparisons */}
            <Card className="p-6 space-y-6">
              <h2 className="text-lg font-bold text-text-main">Modes Breakdown</h2>
              <div className="space-y-4">
                {/* Practice Mode Card */}
                <div className="bg-surface-raised p-4 rounded-xl border border-border-subtle flex justify-between items-center">
                  <div className="space-y-1">
                    <span className="text-sm font-bold text-text-main">Practice</span>
                    <span className="text-xs text-text-muted block">
                      {metrics.practiceStats.attemptsCount} completions
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold text-text-main block">
                      {metrics.practiceStats.attemptsCount > 0 ? `${metrics.practiceStats.accuracyPercentage}%` : '-'}
                    </span>
                    <span className="text-[10px] text-text-muted block">Accuracy</span>
                  </div>
                </div>

                {/* Exam Mode Card */}
                <div className="bg-surface-raised p-4 rounded-xl border border-border-subtle flex justify-between items-center">
                  <div className="space-y-1">
                    <span className="text-sm font-bold text-text-main">Exam</span>
                    <span className="text-xs text-text-muted block">
                      {metrics.examStats.attemptsCount} completions
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold text-text-main block">
                      {metrics.examStats.attemptsCount > 0 ? `${metrics.examStats.accuracyPercentage}%` : '-'}
                    </span>
                    <span className="text-[10px] text-text-muted block">Accuracy</span>
                  </div>
                </div>
                {/* Mistakes Mode Card */}
                <div className="bg-surface-raised p-4 rounded-xl border border-border-subtle flex justify-between items-center">
                  <div className="space-y-1">
                    <span className="text-sm font-bold text-text-main">Mistakes</span>
                    <span className="text-xs text-text-muted block">
                      {metrics.mistakesStats.attemptsCount} completions
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold text-text-main block">
                      {metrics.mistakesStats.attemptsCount > 0 ? `${metrics.mistakesStats.accuracyPercentage}%` : '-'}
                    </span>
                    <span className="text-[10px] text-text-muted block">Accuracy</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Recent attempts */}
          <Card className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-text-main">Recent Attempts</h2>
              <Link
                to="/history"
                className="text-xs font-bold text-primary-text hover:text-primary-hover transition-colors flex items-center gap-1 focus:outline-none focus:underline"
              >
                View Full History
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            <div className="divide-y divide-border-subtle">
              {recentAttempts.map((attempt) => (
                <div key={attempt.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div>
                    <h3 className="font-semibold text-text-main">{attempt.subjectNameSnap || 'Deleted Subject'}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted mt-1">
                      <span className="capitalize">{attempt.mode}</span>
                      <span>•</span>
                      <span>{formatDate(attempt.completedAt)}</span>
                      {attempt.topicNameSnap && (
                        <>
                          <span>•</span>
                          <span>{attempt.topicNameSnap}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-6">
                    <div className="text-left sm:text-right">
                      <span className="font-bold text-text-main block">
                        {attempt.correctAnswers} / {attempt.totalQuestions}
                      </span>
                      <span className="text-xs text-text-muted block">{attempt.scorePercentage}% Score</span>
                    </div>
                    <Link
                      to={`/quiz/results/${attempt.id}`}
                      className="inline-flex min-h-11 items-center px-3.5 py-1.5 bg-surface-overlay hover:bg-border-strong text-text-main font-bold rounded-xl text-xs transition-colors border border-border-strong cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
                    >
                      Review
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
