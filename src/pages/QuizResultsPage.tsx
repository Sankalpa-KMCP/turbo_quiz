import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { db } from '../db/database'
import { QuizRepository } from '../db/repositories/QuizRepository'
import { type QuizAttempt, type AnswerAttempt } from '../types/db'

export default function QuizResultsPage() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const parsedId = Number(attemptId)
  const isIdInvalid = !attemptId || isNaN(parsedId) || parsedId <= 0

  const [loading, setLoading] = useState(!isIdInvalid)
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null)
  const [answers, setAnswers] = useState<AnswerAttempt[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(
    isIdInvalid ? 'Invalid or malformed Attempt ID.' : null
  )

  useEffect(() => {
    if (isIdInvalid) return

    let active = true
    const loadAttemptData = async () => {
      try {
        const quizRepo = new QuizRepository(db)
        const loadedAttempt = await quizRepo.getAttemptById(parsedId)
        if (!loadedAttempt) {
          if (active) {
            setErrorMsg(`Quiz attempt with ID ${parsedId} was not found.`)
            setLoading(false)
          }
          return
        }

        const loadedAnswers = await quizRepo.getAnswersForAttempt(parsedId)
        if (active) {
          setAttempt(loadedAttempt)
          setAnswers(loadedAnswers)
          setLoading(false)
        }
      } catch (err) {
        if (active) {
          setErrorMsg(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
      }
    }

    loadAttemptData()
    return () => {
      active = false
    }
  }, [attemptId, parsedId, isIdInvalid])

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const remainingSecs = Math.round(secs % 60)
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
        <p className="text-slate-400 text-sm">Loading quiz results...</p>
      </div>
    )
  }

  if (errorMsg || !attempt) {
    return (
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md mx-auto text-center space-y-6">
        <div className="inline-flex p-3 bg-rose-500/10 rounded-full text-rose-400">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-slate-100">Unable to Load Results</h2>
          <p className="text-sm text-slate-400">{errorMsg || 'Something went wrong.'}</p>
        </div>
        <Link
          to="/quiz/setup"
          className="inline-flex w-full items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-slate-100 font-medium rounded-lg text-sm shadow transition-colors cursor-pointer"
        >
          Back to Setup
        </Link>
      </div>
    )
  }

  const isPerfect = attempt.scorePercentage === 100

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Score Summary Card */}
      <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-2xl space-y-6 relative overflow-hidden">
        {isPerfect && (
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-bl-full flex items-center justify-center text-indigo-400 font-bold">
            Perfect!
          </div>
        )}

        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight sm:text-3xl">Quiz Results</h1>
          <p className="text-slate-400 text-sm">
            {attempt.subjectNameSnap}
            {attempt.topicNameSnap && <span className="text-slate-400 font-medium"> • {attempt.topicNameSnap}</span>}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/40 p-4 rounded-xl text-center space-y-1 border border-slate-800">
            <span className="text-xs text-slate-400 font-semibold block uppercase tracking-wider">Score</span>
            <span className="text-2xl font-black text-indigo-400">{attempt.scorePercentage}%</span>
          </div>

          <div className="bg-slate-800/40 p-4 rounded-xl text-center space-y-1 border border-slate-800">
            <span className="text-xs text-slate-400 font-semibold block uppercase tracking-wider">Correct</span>
            <span className="text-2xl font-bold text-slate-200">
              {attempt.correctAnswers} / {attempt.totalQuestions}
            </span>
          </div>

          <div className="bg-slate-800/40 p-4 rounded-xl text-center space-y-1 border border-slate-800">
            <span className="text-xs text-slate-400 font-semibold block uppercase tracking-wider">Time Taken</span>
            <span className="text-2xl font-bold text-slate-200">{formatTime(attempt.timeTakenSeconds)}</span>
          </div>

          <div className="bg-slate-800/40 p-4 rounded-xl text-center space-y-1 border border-slate-800">
            <span className="text-xs text-slate-400 font-semibold block uppercase tracking-wider">Mode</span>
            <span className="text-2xl font-bold text-slate-200 capitalize">{attempt.mode}</span>
          </div>
        </div>
      </div>

      {/* Answers Review list */}
      <div className="space-y-6">
        <h2 className="text-lg font-bold text-slate-200 px-1">Review Questions</h2>

        {answers.map((ans, idx) => {
          const snap = ans.questionSnapshot
          const selectedIdx = ans.selectedOptionIndex
          const correctIdx = snap.correctOptionIndex
          const isCorrect = ans.isCorrect

          return (
            <div
              key={ans.id || idx}
              className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4"
            >
              <div className="flex justify-between items-center text-sm border-b border-slate-800 pb-3">
                <span className="font-semibold text-slate-300">Question {idx + 1}</span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-xs font-mono">{ans.timeTakenSeconds.toFixed(1)}s</span>
                  <span className="capitalize px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs">
                    {snap.difficulty}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      isCorrect
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {isCorrect ? 'Correct' : selectedIdx === null ? 'Skipped' : 'Incorrect'}
                  </span>
                </div>
              </div>

              {/* Question Text */}
              <h3 className="text-slate-100 font-semibold whitespace-pre-wrap">{snap.questionText}</h3>

              {/* Options */}
              <div className="space-y-2">
                {snap.options.map((opt, optIdx) => {
                  const isUserSelection = selectedIdx === optIdx
                  const isCorrectAnswer = optIdx === correctIdx

                  let optStyle = 'bg-slate-800/40 border-slate-850 text-slate-400'

                  if (isCorrectAnswer) {
                    optStyle = 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                  } else if (isUserSelection) {
                    optStyle = 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                  }

                  return (
                    <div
                      key={optIdx}
                      className={`p-3 rounded-lg border text-sm flex justify-between items-center ${optStyle}`}
                    >
                      <span>{opt}</span>
                      <div className="flex items-center gap-1">
                        {isCorrectAnswer && (
                          <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">
                            Correct Answer
                          </span>
                        )}
                        {isUserSelection && !isCorrectAnswer && (
                          <span className="text-rose-400 text-xs font-bold uppercase tracking-wider">
                            Your Choice
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Explanation */}
              {snap.explanation && (
                <div className="bg-slate-850/30 p-4 rounded-xl space-y-1.5 border border-slate-850">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Explanation</h4>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{snap.explanation}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Navigation actions */}
      <div className="flex flex-col sm:flex-row gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <Link
          to="/quiz/setup"
          className="flex-1 text-center py-3 bg-indigo-600 hover:bg-indigo-500 text-slate-100 font-bold rounded-xl transition-all cursor-pointer shadow-md"
        >
          Start Another Quiz
        </Link>
        <Link
          to="/history"
          className="flex-1 text-center py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl transition-all cursor-pointer border border-slate-700"
        >
          View History
        </Link>
        <Link
          to="/"
          className="flex-1 text-center py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl transition-all cursor-pointer border border-slate-700"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
