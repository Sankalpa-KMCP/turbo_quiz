import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { db } from '../db/database'
import { QuizRepository } from '../db/repositories/QuizRepository'
import { type QuizAttempt, type AnswerAttempt } from '../types/db'

import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'

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
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-base"></div>
        <p className="text-text-muted text-sm">Loading quiz results...</p>
      </div>
    )
  }

  if (errorMsg || !attempt) {
    return (
      <Card className="p-8 max-w-md mx-auto text-center space-y-6">
        <div className="inline-flex p-3 bg-danger-bg rounded-full text-danger-text">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-text-main">Unable to Load Results</h2>
          <p className="text-sm text-text-muted">{errorMsg || 'Something went wrong.'}</p>
        </div>
        <Link
          to="/quiz/setup"
          className="inline-flex w-full items-center justify-center px-4 py-2 bg-primary-base hover:bg-primary-hover text-text-inverse font-medium rounded-xl text-sm shadow transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2 focus:ring-offset-surface-base"
        >
          Back to Setup
        </Link>
      </Card>
    )
  }

  const isPerfect = attempt.scorePercentage === 100

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Score Summary Card */}
      <Card className="p-6 sm:p-8 space-y-6 relative overflow-hidden">
        {isPerfect && (
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary-base/10 rounded-bl-full flex items-center justify-center text-primary-text font-bold">
            Perfect!
          </div>
        )}

        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-text-main tracking-tight sm:text-3xl">Quiz Results</h1>
          <p className="text-text-muted text-sm">
            {attempt.subjectNameSnap}
            {attempt.topicNameSnap && <span className="text-text-muted font-medium"> • {attempt.topicNameSnap}</span>}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface-overlay p-4 rounded-xl text-center space-y-1 border border-border-subtle">
            <span className="text-xs text-text-muted font-semibold block uppercase tracking-wider">Score</span>
            <span className="text-2xl font-bold text-primary-text">{attempt.scorePercentage}%</span>
          </div>

          <div className="bg-surface-overlay p-4 rounded-xl text-center space-y-1 border border-border-subtle">
            <span className="text-xs text-text-muted font-semibold block uppercase tracking-wider">Correct</span>
            <span className="text-2xl font-bold text-text-main">
              {attempt.correctAnswers} / {attempt.totalQuestions}
            </span>
          </div>

          <div className="bg-surface-overlay p-4 rounded-xl text-center space-y-1 border border-border-subtle">
            <span className="text-xs text-text-muted font-semibold block uppercase tracking-wider">Time Taken</span>
            <span className="text-2xl font-bold text-text-main">{formatTime(attempt.timeTakenSeconds)}</span>
          </div>

          <div className="bg-surface-overlay p-4 rounded-xl text-center space-y-1 border border-border-subtle">
            <span className="text-xs text-text-muted font-semibold block uppercase tracking-wider">Mode</span>
            <span className="text-2xl font-bold text-text-main capitalize">{attempt.mode}</span>
          </div>
        </div>
      </Card>

      {/* Answers Review list */}
      <div className="space-y-6">
        <h2 className="text-lg font-bold text-text-main px-1">Review Questions</h2>

        {answers.map((ans, idx) => {
          const snap = ans.questionSnapshot
          const selectedIdx = ans.selectedOptionIndex
          const correctIdx = snap.correctOptionIndex
          const isCorrect = ans.isCorrect

          return (
            <Card
              key={ans.id || idx}
              className="p-6 space-y-4"
            >
              <div className="flex justify-between items-center text-sm border-b border-border-subtle pb-3">
                <span className="font-semibold text-text-main">Question {idx + 1}</span>
                <div className="flex items-center gap-3">
                  <span className="text-text-muted text-xs font-mono">{ans.timeTakenSeconds.toFixed(1)}s</span>
                  <span className="capitalize px-2 py-0.5 rounded bg-surface-overlay text-text-main text-xs">
                    {snap.difficulty}
                  </span>
                  <Badge variant={isCorrect ? 'success' : (selectedIdx === null ? 'warning' : 'danger')}>
                    {isCorrect ? 'Correct' : selectedIdx === null ? 'Skipped' : 'Incorrect'}
                  </Badge>
                </div>
              </div>

              {/* Question Text */}
              <h3 className="text-text-main font-semibold whitespace-pre-wrap">{snap.questionText}</h3>

              {/* Options */}
              <div className="space-y-2">
                {snap.options.map((opt, optIdx) => {
                  const isUserSelection = selectedIdx === optIdx
                  const isCorrectAnswer = optIdx === correctIdx

                  let optStyle = 'bg-surface-base border-border-subtle text-text-muted'

                  if (isCorrectAnswer) {
                    optStyle = 'bg-success-bg border-success-border text-success-text'
                  } else if (isUserSelection) {
                    optStyle = 'bg-danger-bg border-danger-border text-danger-text'
                  }

                  return (
                    <div
                      key={optIdx}
                      className={`p-3 rounded-lg border text-sm flex justify-between items-center ${optStyle}`}
                    >
                      <span>{opt}</span>
                      <div className="flex items-center gap-1">
                        {isCorrectAnswer && (
                          <span className="text-success-text text-xs font-bold uppercase tracking-wider">
                            Correct Answer
                          </span>
                        )}
                        {isUserSelection && !isCorrectAnswer && (
                          <span className="text-danger-text text-xs font-bold uppercase tracking-wider">
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
                <div className="bg-success-bg/10 p-4 rounded-xl space-y-1.5 border border-success-border/20">
                  <h4 className="text-xs font-bold text-success-text uppercase tracking-wider">Explanation</h4>
                  <p className="text-sm text-text-main whitespace-pre-wrap">{snap.explanation}</p>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Navigation actions */}
      <Card className="flex flex-col sm:flex-row gap-4 p-6">
        <Link
          to="/quiz/setup"
          className="flex-1 text-center py-3 bg-primary-base hover:bg-primary-hover text-text-inverse font-bold rounded-xl transition-all cursor-pointer shadow-md focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2 focus:ring-offset-surface-base"
        >
          Start Another Quiz
        </Link>
        <Link
          to="/history"
          className="flex-1 text-center py-3 bg-surface-overlay hover:bg-border-strong text-text-main font-semibold rounded-xl transition-all cursor-pointer border border-border-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
        >
          View History
        </Link>
        <Link
          to="/"
          className="flex-1 text-center py-3 bg-surface-overlay hover:bg-border-strong text-text-main font-semibold rounded-xl transition-all cursor-pointer border border-border-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
        >
          Back to Dashboard
        </Link>
      </Card>
    </div>
  )
}
