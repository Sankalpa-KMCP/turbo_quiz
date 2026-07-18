import { useState, useEffect, useRef } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useQuizSessionStore } from '../stores/quizSessionStore'

import { Button } from '../components/ui/Button'
import { Alert } from '../components/ui/Alert'
import { Badge } from '../components/ui/Badge'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { cn } from '../utils/cn'

export default function QuizPlayPage() {
  const navigate = useNavigate()
  const phase = useQuizSessionStore((s) => s.phase)
  const setupConfig = useQuizSessionStore((s) => s.setupConfig)
  const subjectNameSnap = useQuizSessionStore((s) => s.subjectNameSnap)
  const topicNameSnap = useQuizSessionStore((s) => s.topicNameSnap)
  const questions = useQuizSessionStore((s) => s.questions)
  const currentIndex = useQuizSessionStore((s) => s.currentIndex)
  const answers = useQuizSessionStore((s) => s.answers)
  const sessionStartedAt = useQuizSessionStore((s) => s.sessionStartedAt)
  const storeError = useQuizSessionStore((s) => s.error)

  const selectAnswer = useQuizSessionStore((s) => s.selectAnswer)
  const skipQuestion = useQuizSessionStore((s) => s.skipQuestion)
  const nextQuestion = useQuizSessionStore((s) => s.nextQuestion)
  const previousQuestion = useQuizSessionStore((s) => s.previousQuestion)
  const goToQuestion = useQuizSessionStore((s) => s.goToQuestion)
  const completeQuiz = useQuizSessionStore((s) => s.completeQuiz)

  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const finishTriggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (phase !== 'playing' || !sessionStartedAt) return
    const update = () => {
      const totalMs = Date.now() - sessionStartedAt
      setElapsedSeconds(Math.max(0, Math.floor(totalMs / 1000)))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [phase, sessionStartedAt])

  if (phase !== 'playing' && phase !== 'completing' && phase !== 'completed') {
    return <Navigate to="/quiz/setup" replace />
  }

  const currentQuestion = questions[currentIndex]
  if (!currentQuestion) return null

  const currentAnswer = answers[currentQuestion.questionId]
  const isAnswered = currentAnswer?.selectedOptionIndex !== null
  const selectedIndex = currentAnswer?.selectedOptionIndex ?? null

  const isLastQuestion = currentIndex === questions.length - 1
  const mode = setupConfig?.mode ?? 'practice'
  const showsFeedback = mode === 'practice' || mode === 'mistakes'

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const remainingSecs = secs % 60
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`
  }

  function openConfirm() {
    setSubmitError(null)
    // Ensure the Finish control owns focus before the dialog opens so
    // ConfirmDialog can restore it on cancel/Escape (jsdom clicks do not focus).
    finishTriggerRef.current?.focus()
    setShowConfirm(true)
  }

  function closeConfirm() {
    setShowConfirm(false)
    setSubmitError(null)
  }

  async function confirmFinish() {
    if (isSubmitting || phase === 'completing') return
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const attemptId = await completeQuiz()
      setShowConfirm(false)
      navigate(`/quiz/results/${attemptId}`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err))
      setIsSubmitting(false)
    }
  }

  const unansweredCount = questions.filter(
    (q) => answers[q.questionId]?.selectedOptionIndex === null,
  ).length
  const answeredCount = questions.length - unansweredCount
  const progressPercentage = Math.round(((currentIndex + 1) / questions.length) * 100)
  const isCorrectSelection =
    isAnswered && selectedIndex === currentQuestion.questionSnapshot.correctOptionIndex

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-4 border-b border-border-subtle pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <Badge variant="primary" className="capitalize">
              {mode} Mode
            </Badge>
            <h1 className="font-serif text-xl font-semibold tracking-tight text-text-main sm:text-2xl">
              {subjectNameSnap}
              {topicNameSnap ? (
                <span className="font-sans text-base font-medium text-text-muted">
                  {' '}
                  · {topicNameSnap}
                </span>
              ) : null}
            </h1>
          </div>
          <p
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-subtle bg-surface-raised px-3 font-mono text-base font-semibold text-text-main"
            aria-label={`Elapsed time ${formatTime(elapsedSeconds)}`}
          >
            <svg className="size-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span aria-hidden="true">{formatTime(elapsedSeconds)}</span>
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-text-muted">
            <p>
              Question{' '}
              <span className="font-semibold text-text-main">
                {currentIndex + 1}
              </span>{' '}
              of {questions.length}
              <span aria-hidden="true"> · </span>
              <span className="capitalize">{currentQuestion.questionSnapshot.difficulty}</span>
            </p>
            <p>
              {answeredCount} answered
              <span aria-hidden="true"> · </span>
              {unansweredCount} remaining
            </p>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-overlay">
            <div
              className="h-full rounded-full bg-primary-base transition-[width] motion-reduce:transition-none"
              style={{ width: `${progressPercentage}%` }}
              role="progressbar"
              aria-label="Quiz progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPercentage}
            />
          </div>
          <p className="sr-only">{progressPercentage}% through this quiz</p>
        </div>
      </header>

      <section className="space-y-6" aria-labelledby="current-question-heading">
        <h2
          id="current-question-heading"
          className="font-serif text-lg font-semibold leading-relaxed tracking-tight text-text-main whitespace-pre-wrap sm:text-xl"
        >
          {currentQuestion.questionSnapshot.questionText}
        </h2>

        <div className="space-y-2" role="group" aria-label="Answer options">
          {currentQuestion.questionSnapshot.options.map((option, idx) => {
            const isSelected = selectedIndex === idx
            const isCorrectAnswer = idx === currentQuestion.questionSnapshot.correctOptionIndex
            const feedbackActive = showsFeedback && isAnswered

            let optionStyle =
              'border-border-subtle bg-surface-raised text-text-main hover:border-border-strong hover:bg-surface-overlay'
            let statusLabel: string | null = null

            if (isSelected && !feedbackActive) {
              optionStyle = 'border-primary-base bg-primary-bg text-primary-text'
              statusLabel = 'Selected'
            }

            if (feedbackActive) {
              if (isCorrectAnswer) {
                optionStyle = 'border-success-border bg-success-bg text-success-text'
                statusLabel = 'Correct answer'
              } else if (isSelected) {
                optionStyle = 'border-danger-border bg-danger-bg text-danger-text'
                statusLabel = 'Your answer'
              } else {
                optionStyle = 'border-border-subtle/70 bg-surface-raised text-text-muted opacity-70'
              }
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => selectAnswer(idx)}
                disabled={showsFeedback && isAnswered}
                className={cn(
                  'flex w-full min-h-14 items-start justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors',
                  'outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base',
                  'disabled:cursor-default',
                  optionStyle,
                )}
                aria-pressed={isSelected}
              >
                <span className="min-w-0 flex-1 whitespace-pre-wrap leading-relaxed">{option}</span>
                {statusLabel ? (
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-wider">
                    {statusLabel}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        {showsFeedback && isAnswered ? (
          <div className="space-y-3" aria-live="polite">
            <Alert variant={isCorrectSelection ? 'success' : 'danger'}>
              {isCorrectSelection ? 'Correct.' : 'Incorrect.'}
            </Alert>
            {currentQuestion.questionSnapshot.explanation ? (
              <div className="rounded-lg border border-border-subtle bg-surface-raised px-4 py-3">
                <h3 className="text-sm font-semibold text-text-main">Explanation</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-text-main whitespace-pre-wrap">
                  {currentQuestion.questionSnapshot.explanation}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-5">
        <Button
          onClick={previousQuestion}
          disabled={currentIndex === 0}
          variant="secondary"
          size="sm"
        >
          Previous
        </Button>

        <div className="flex flex-wrap gap-2">
          {!isAnswered ? (
            <Button onClick={skipQuestion} variant="secondary" size="sm">
              Skip
            </Button>
          ) : null}

          {isLastQuestion ? (
            <Button
              ref={finishTriggerRef}
              onClick={openConfirm}
              variant="primary"
              size="sm"
            >
              Finish Quiz
            </Button>
          ) : (
            <Button onClick={nextQuestion} variant="primary" size="sm">
              Next
            </Button>
          )}
        </div>
      </div>

      <nav className="space-y-3 border-t border-border-subtle pt-5" aria-label="Question navigator">
        <h3 className="text-sm font-semibold text-text-main">Question Navigator</h3>
        <ul className="flex flex-wrap gap-2">
          {questions.map((q, idx) => {
            const ans = answers[q.questionId]
            const isCurrent = idx === currentIndex
            const isQAnswered = ans?.selectedOptionIndex !== null
            const isQSkipped = ans?.selectedOptionIndex === null && ans?.timeTakenSeconds > 0

            let style = 'border-border-subtle bg-surface-raised text-text-muted hover:bg-surface-overlay'
            let stateLabel = 'unanswered'
            if (isCurrent) {
              style = 'border-primary-base bg-primary-bg text-primary-text ring-2 ring-primary-base/40'
              stateLabel = 'current'
            } else if (isQAnswered) {
              style = 'border-primary-base bg-primary-base text-text-inverse'
              stateLabel = 'answered'
            } else if (isQSkipped) {
              style = 'border-warning-border bg-warning-bg text-warning-text'
              stateLabel = 'skipped'
            }

            return (
              <li key={q.questionId}>
                <Button
                  onClick={() => goToQuestion(idx)}
                  variant="ghost"
                  className={cn(
                    'size-11 rounded-lg border p-0 text-sm font-semibold shadow-none',
                    style,
                  )}
                  aria-label={`Question ${idx + 1}, ${stateLabel}`}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <span aria-hidden="true">{idx + 1}</span>
                </Button>
              </li>
            )
          })}
        </ul>
      </nav>

      {(submitError || storeError) && (
        <Alert variant="danger">
          {submitError || storeError}
        </Alert>
      )}

      <ConfirmDialog
        open={showConfirm}
        title="Finish Quiz"
        description={
          <>
            <p>Are you sure you want to finish the quiz?</p>
            {unansweredCount > 0 ? (
              <p className="mt-2 font-semibold text-warning-text">
                You have {unansweredCount} unanswered question{unansweredCount > 1 ? 's' : ''}.
              </p>
            ) : null}
          </>
        }
        confirmLabel="Submit Answers"
        cancelLabel="Cancel"
        pending={isSubmitting || phase === 'completing'}
        onConfirm={confirmFinish}
        onCancel={closeConfirm}
      />
    </div>
  )
}
