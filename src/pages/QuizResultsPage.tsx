import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { db } from '../db/database'
import { QuizRepository } from '../db/repositories/QuizRepository'
import { type QuizAttempt, type AnswerAttempt } from '../types/db'

import { Badge } from '../components/ui/Badge'
import { Alert } from '../components/ui/Alert'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingState } from '../components/ui/LoadingState'
import { PageHeader } from '../components/ui/PageHeader'
import { buttonStyles } from '../components/ui/buttonStyles'
import { cn } from '../utils/cn'

export default function QuizResultsPage() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const parsedId = Number(attemptId)
  const isIdInvalid = !attemptId || isNaN(parsedId) || parsedId <= 0

  const [loading, setLoading] = useState(!isIdInvalid)
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null)
  const [answers, setAnswers] = useState<AnswerAttempt[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(
    isIdInvalid ? 'Invalid or malformed Attempt ID.' : null,
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
  }

  if (loading) {
    return <LoadingState label="Loading quiz results…" />
  }

  if (errorMsg || !attempt) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-4">
        <EmptyState
          title="Unable to Load Results"
          description={errorMsg || 'Something went wrong.'}
          icon={
            <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
          action={
            <Link to="/quiz/setup" className={buttonStyles({ variant: 'primary' })}>
              Back to Setup
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <PageHeader
        title="Quiz Results"
        description={
          <>
            {attempt.subjectNameSnap}
            {attempt.topicNameSnap ? (
              <span>
                {' '}
                · {attempt.topicNameSnap}
              </span>
            ) : null}
          </>
        }
      />

      <section aria-label="Result summary">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border-subtle bg-border-subtle sm:grid-cols-4">
          <div className="bg-surface-raised px-4 py-4 sm:px-5">
            <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">Score</dt>
            <dd className="mt-1 font-serif text-2xl font-semibold text-primary-text">
              {attempt.scorePercentage}%
            </dd>
          </div>
          <div className="bg-surface-raised px-4 py-4 sm:px-5">
            <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">Correct</dt>
            <dd className="mt-1 font-serif text-2xl font-semibold text-text-main">
              {attempt.correctAnswers} / {attempt.totalQuestions}
            </dd>
          </div>
          <div className="bg-surface-raised px-4 py-4 sm:px-5">
            <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">Time Taken</dt>
            <dd className="mt-1 font-serif text-2xl font-semibold text-text-main">
              {formatTime(attempt.timeTakenSeconds)}
            </dd>
          </div>
          <div className="bg-surface-raised px-4 py-4 sm:px-5">
            <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">Mode</dt>
            <dd className="mt-1 font-serif text-2xl font-semibold capitalize text-text-main">
              {attempt.mode}
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-4" aria-labelledby="review-heading">
        <div className="border-b border-border-subtle pb-3">
          <h2 id="review-heading" className="text-base font-semibold text-text-main">
            Review Questions
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Compare your choices with the correct answers and explanations.
          </p>
        </div>

        <ul className="divide-y divide-border-subtle border-t border-border-subtle">
          {answers.map((ans, idx) => {
            const snap = ans.questionSnapshot
            const selectedIdx = ans.selectedOptionIndex
            const correctIdx = snap.correctOptionIndex
            const isCorrect = ans.isCorrect
            const resultLabel = isCorrect ? 'Correct' : selectedIdx === null ? 'Skipped' : 'Incorrect'

            return (
              <li key={ans.id || idx} className="space-y-4 py-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-text-main">
                    Question {idx + 1}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-text-muted">
                      {ans.timeTakenSeconds.toFixed(1)}s
                    </span>
                    <span className="rounded-md border border-border-subtle bg-surface-overlay px-2 py-0.5 text-xs capitalize text-text-main">
                      {snap.difficulty}
                    </span>
                    <Badge
                      variant={isCorrect ? 'success' : selectedIdx === null ? 'warning' : 'danger'}
                    >
                      {resultLabel}
                    </Badge>
                  </div>
                </div>

                <p className="font-serif text-base font-semibold leading-relaxed tracking-tight text-text-main whitespace-pre-wrap">
                  {snap.questionText}
                </p>

                <ul className="space-y-2" aria-label={`Options for question ${idx + 1}`}>
                  {snap.options.map((opt, optIdx) => {
                    const isUserSelection = selectedIdx === optIdx
                    const isCorrectAnswer = optIdx === correctIdx

                    return (
                      <li
                        key={optIdx}
                        className={cn(
                          'flex items-start justify-between gap-3 rounded-lg border px-3 py-3 text-sm',
                          isCorrectAnswer
                            ? 'border-success-border bg-success-bg text-success-text'
                            : isUserSelection
                              ? 'border-danger-border bg-danger-bg text-danger-text'
                              : 'border-border-subtle bg-surface-raised text-text-muted',
                        )}
                      >
                        <span className="min-w-0 flex-1 whitespace-pre-wrap leading-relaxed">{opt}</span>
                        <span className="shrink-0 text-xs font-semibold uppercase tracking-wider">
                          {isCorrectAnswer ? 'Correct Answer' : null}
                          {isUserSelection && !isCorrectAnswer ? 'Your Choice' : null}
                        </span>
                      </li>
                    )
                  })}
                </ul>

                {snap.explanation ? (
                  <div className="rounded-lg border border-border-subtle bg-surface-raised px-4 py-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Explanation
                    </h4>
                    <p className="mt-1.5 text-sm leading-relaxed text-text-main whitespace-pre-wrap">
                      {snap.explanation}
                    </p>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>

      {attempt.scorePercentage === 100 ? (
        <Alert variant="success">Every answer in this attempt was correct.</Alert>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-border-subtle pt-6 sm:flex-row sm:flex-wrap">
        <Link
          to="/quiz/setup"
          className={cn(buttonStyles({ variant: 'primary' }), 'w-full sm:w-auto')}
        >
          Start Another Quiz
        </Link>
        <Link
          to="/history"
          className={cn(buttonStyles({ variant: 'secondary' }), 'w-full sm:w-auto')}
        >
          View History
        </Link>
        <Link
          to="/"
          className={cn(buttonStyles({ variant: 'ghost' }), 'w-full sm:w-auto')}
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
