import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db/database'
import { QuizRepository } from '../db/repositories/QuizRepository'
import { SubjectRepository } from '../db/repositories/SubjectRepository'
import { type QuizAttempt, type Subject } from '../types/db'

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
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
        <p className="text-slate-400 text-sm">Loading quiz history...</p>
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
          Reload History
        </button>
      </div>
    )
  }

  const isOverallEmpty = selectedSubjectId === null && attempts.length === 0
  const isFilteredEmpty = selectedSubjectId !== null && attempts.length === 0

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight sm:text-3xl">Quiz History</h1>
          <p className="text-slate-400 text-sm mt-1">
            Review your past quiz performances and access full scorecards.
          </p>
        </div>

        {/* Subject Filter (accessible labelled dropdown) */}
        {!isOverallEmpty && (
          <div className="flex items-center gap-3">
            <label htmlFor="subject-filter" className="text-sm font-medium text-slate-300 shrink-0">
              Filter by Subject:
            </label>
            <select
              id="subject-filter"
              value={selectedSubjectId === null ? '' : String(selectedSubjectId)}
              onChange={(e) => {
                const val = e.target.value
                setSelectedSubjectId(val === '' ? null : Number(val))
              }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            >
              <option value="">All Subjects</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isOverallEmpty ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-4">
          <div className="inline-flex p-4 bg-slate-800/50 rounded-full text-slate-500">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-200">No Past Attempts</h2>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              You haven't completed any quizzes yet. Start a quiz and your attempts will show up here.
            </p>
          </div>
          <Link
            to="/quiz/setup"
            className="inline-flex items-center justify-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-slate-100 font-bold rounded-xl text-sm transition-colors shadow-md cursor-pointer"
          >
            Start Quiz
          </Link>
        </div>
      ) : isFilteredEmpty ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-2">
          <h2 className="text-lg font-bold text-slate-200">No Attempts for this Subject</h2>
          <p className="text-sm text-slate-400">
            Try choosing a different subject or start a new quiz attempt.
          </p>
        </div>
      ) : (
        /* History Grid & Responsive Table */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400 font-semibold uppercase tracking-wider bg-slate-900/60">
                  <th className="p-4 pl-6">Quiz Info</th>
                  <th className="p-4">Mode</th>
                  <th className="p-4 text-center">Score</th>
                  <th className="p-4">Time Taken</th>
                  <th className="p-4">Date Completed</th>
                  <th className="p-4 pr-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {attempts.map((attempt) => {
                  const hasPerfectScore = attempt.scorePercentage === 100
                  return (
                    <tr key={attempt.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="p-4 pl-6">
                        <div className="font-semibold text-slate-200">
                          {attempt.subjectNameSnap || 'Deleted Subject'}
                        </div>
                        {attempt.topicNameSnap && (
                          <div className="text-xs text-slate-500">{attempt.topicNameSnap}</div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="capitalize text-slate-300 text-sm font-medium">{attempt.mode}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`text-base font-bold ${hasPerfectScore ? 'text-indigo-400' : 'text-slate-200'}`}>
                          {attempt.correctAnswers} / {attempt.totalQuestions}
                        </span>
                        <span className="block text-xs text-slate-500">{attempt.scorePercentage}%</span>
                      </td>
                      <td className="p-4 text-slate-300 text-sm font-medium">
                        {formatDuration(attempt.timeTakenSeconds)}
                      </td>
                      <td className="p-4 text-slate-400 text-sm">
                        {formatDate(attempt.completedAt)}
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <Link
                          to={`/quiz/results/${attempt.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
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
          <div className="md:hidden divide-y divide-slate-850">
            {attempts.map((attempt) => (
              <div key={attempt.id} className="p-5 space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h2 className="font-bold text-slate-200 leading-tight">
                      {attempt.subjectNameSnap || 'Deleted Subject'}
                    </h2>
                    {attempt.topicNameSnap && (
                      <p className="text-xs text-slate-500 mt-0.5">{attempt.topicNameSnap}</p>
                    )}
                  </div>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs font-mono capitalize">
                    {attempt.mode}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-950/40 p-2 rounded-lg">
                    <span className="block text-slate-500 font-semibold uppercase tracking-wider mb-1">Score</span>
                    <span className="font-bold text-slate-200">
                      {attempt.correctAnswers}/{attempt.totalQuestions} ({attempt.scorePercentage}%)
                    </span>
                  </div>
                  <div className="bg-slate-950/40 p-2 rounded-lg">
                    <span className="block text-slate-500 font-semibold uppercase tracking-wider mb-1">Time</span>
                    <span className="font-bold text-slate-200">{formatDuration(attempt.timeTakenSeconds)}</span>
                  </div>
                  <div className="bg-slate-950/40 p-2 rounded-lg">
                    <span className="block text-slate-500 font-semibold uppercase tracking-wider mb-1">Date</span>
                    <span className="font-bold text-slate-300">
                      {new Date(attempt.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <Link
                    to={`/quiz/results/${attempt.id}`}
                    className="inline-flex w-full sm:w-auto justify-center items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold rounded-xl text-xs transition-colors border border-slate-700"
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
        </div>
      )}
    </div>
  )
}
