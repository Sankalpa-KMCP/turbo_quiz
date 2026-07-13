import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db/database'
import { QuizRepository } from '../db/repositories/QuizRepository'
import { SubjectRepository } from '../db/repositories/SubjectRepository'
import { computeDashboardMetrics } from '../utils/dashboardMetrics'
import { type QuizAttempt, type Subject } from '../types/db'

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
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
        <p className="text-slate-400 text-sm">Loading dashboard metrics...</p>
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md mx-auto text-center space-y-6">
        <div className="inline-flex p-3 bg-rose-500/10 rounded-full text-rose-400">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-slate-100">Database Connection Error</h2>
          <p className="text-sm text-slate-400">We encountered an issue reading your quiz history from the database.</p>
          <p className="text-xs text-slate-500 mt-2">Try refreshing the page or restarting the local database server.</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex w-full items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-slate-100 font-medium rounded-lg text-sm shadow transition-colors cursor-pointer"
        >
          Reload Dashboard
        </button>
      </div>
    )
  }

  const metrics = computeDashboardMetrics(attempts, subjects)
  const recentAttempts = attempts.slice(0, 5)

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header Panel */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight sm:text-3xl">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">
          Track your overall performance, strengths, and subject-level proficiency.
        </p>
      </div>

      {attempts.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-4">
          <div className="inline-flex p-4 bg-slate-800/50 rounded-full text-slate-500">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-200">No Analytics Yet</h2>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              Complete a quiz attempt first to see your performance metrics aggregated here.
            </p>
          </div>
          <Link
            to="/quiz/setup"
            className="inline-flex items-center justify-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-slate-100 font-bold rounded-xl text-sm transition-colors shadow-md cursor-pointer"
          >
            Start Your First Quiz
          </Link>
        </div>
      ) : (
        <>
          {/* Stats Deck Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">Completed Quizzes</span>
              <span className="text-3xl font-black text-slate-100">{metrics.totalAttempts}</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">Overall Accuracy</span>
              <span className="text-3xl font-black text-indigo-400">{metrics.overallAccuracy}%</span>
              <span className="text-[10px] text-slate-500 block">
                {metrics.totalCorrect} / {metrics.totalQuestionsPresented} Questions Included
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">Total Questions Included</span>
              <span className="text-3xl font-black text-slate-100">{metrics.totalQuestionsPresented}</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">Total Time Spent</span>
              <span className="text-3xl font-black text-slate-100">{formatTotalTime(metrics.totalTimeSpentSeconds)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Subject Level proficiency list */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6 lg:col-span-2">
              <h2 className="text-lg font-bold text-slate-200">Subject Proficiency</h2>
              <div className="space-y-4">
                {Object.values(metrics.subjectPerformance).map((subMetric, idx) => {
                  const acc = subMetric.accuracyPercentage
                  let accBarColor = 'bg-rose-500/80'
                  let accTextColor = 'text-rose-400'
                  if (acc >= 80) {
                    accBarColor = 'bg-emerald-500/80'
                    accTextColor = 'text-emerald-400'
                  } else if (acc >= 50) {
                    accBarColor = 'bg-amber-500/80'
                    accTextColor = 'text-amber-400'
                  }

                  return (
                    <div key={idx} className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-semibold text-slate-300">{subMetric.subjectName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">({subMetric.attemptsCount} attempts)</span>
                          <span className={`font-bold ${accTextColor}`}>{acc}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-850">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${accBarColor}`}
                          style={{ width: `${acc}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Mode comparisons */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6">
              <h2 className="text-lg font-bold text-slate-200">Modes Breakdown</h2>
              <div className="space-y-4">
                {/* Practice Mode Card */}
                <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 flex justify-between items-center">
                  <div className="space-y-1">
                    <span className="text-sm font-bold text-slate-300">Practice</span>
                    <span className="text-xs text-slate-500 block">
                      {metrics.practiceStats.attemptsCount} completions
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-slate-200 block">
                      {metrics.practiceStats.attemptsCount > 0 ? `${metrics.practiceStats.accuracyPercentage}%` : '-'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">Accuracy</span>
                  </div>
                </div>

                {/* Exam Mode Card */}
                <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 flex justify-between items-center">
                  <div className="space-y-1">
                    <span className="text-sm font-bold text-slate-300">Exam</span>
                    <span className="text-xs text-slate-500 block">
                      {metrics.examStats.attemptsCount} completions
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-slate-200 block">
                      {metrics.examStats.attemptsCount > 0 ? `${metrics.examStats.accuracyPercentage}%` : '-'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">Accuracy</span>
                  </div>
                </div>
                {/* Mistakes Mode Card */}
                <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 flex justify-between items-center">
                  <div className="space-y-1">
                    <span className="text-sm font-bold text-slate-300">Mistakes</span>
                    <span className="text-xs text-slate-500 block">
                      {metrics.mistakesStats.attemptsCount} completions
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-slate-200 block">
                      {metrics.mistakesStats.attemptsCount > 0 ? `${metrics.mistakesStats.accuracyPercentage}%` : '-'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">Accuracy</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent attempts */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-200">Recent Attempts</h2>
              <Link
                to="/history"
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
              >
                View Full History
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            <div className="divide-y divide-slate-850">
              {recentAttempts.map((attempt) => (
                <div key={attempt.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div>
                    <h3 className="font-semibold text-slate-200">{attempt.subjectNameSnap || 'Deleted Subject'}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
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
                      <span className="font-bold text-slate-200 block">
                        {attempt.correctAnswers} / {attempt.totalQuestions}
                      </span>
                      <span className="text-xs text-slate-500 block">{attempt.scorePercentage}% Score</span>
                    </div>
                    <Link
                      to={`/quiz/results/${attempt.id}`}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold rounded-xl text-xs transition-colors border border-slate-700 cursor-pointer"
                    >
                      Review
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
