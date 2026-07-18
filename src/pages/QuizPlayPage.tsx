import { useState, useEffect, useRef } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useQuizSessionStore } from '../stores/quizSessionStore'

import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Alert } from '../components/ui/Alert'
import { Badge } from '../components/ui/Badge'
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
  const cancelBtnRef = useRef<HTMLButtonElement>(null)

  // Timer effect
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

  useEffect(() => {
    if (!showConfirm) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeConfirm()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [showConfirm])

  // Redirect to setup if no active playing session exists
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
    setShowConfirm(true)
    setTimeout(() => {
      cancelBtnRef.current?.focus()
    }, 0)
  }

  function closeConfirm() {
    setShowConfirm(false)
    setSubmitError(null)
    setTimeout(() => {
      finishTriggerRef.current?.focus()
    }, 0)
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
    (q) => answers[q.questionId]?.selectedOptionIndex === null
  ).length
  const progressPercentage = Math.round(((currentIndex + 1) / questions.length) * 100)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Quiz Header */}
      <Card className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-4 sm:p-6">
        <div>
          <Badge variant="primary" className="capitalize mb-2">
            {mode} Mode
          </Badge>
          <h1 className="text-xl font-bold text-text-main">
            {subjectNameSnap}
            {topicNameSnap && <span className="text-text-muted font-medium"> • {topicNameSnap}</span>}
          </h1>
        </div>
        <div className="flex min-h-11 items-center gap-2 bg-surface-overlay border border-border-strong px-4 py-2 rounded-xl text-text-main" aria-label={`Elapsed time ${formatTime(elapsedSeconds)}`}>
          <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-mono font-bold text-lg">{formatTime(elapsedSeconds)}</span>
        </div>
      </Card>

      {/* Main Question view */}
      <Card className="p-4 sm:p-6 space-y-6">
        <div className="flex justify-between items-center text-sm text-text-muted border-b border-border-subtle pb-4">
          <span>Question {currentIndex + 1} of {questions.length}</span>
          <span className="capitalize px-2 py-0.5 rounded bg-surface-overlay text-text-main text-xs">
            {currentQuestion.questionSnapshot.difficulty}
          </span>
        </div>

        <div className="space-y-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-overlay">
            <div
              className="h-full rounded-full bg-primary-base transition-[width]"
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

        {/* Question Text */}
        <h2 className="text-lg font-semibold text-text-main whitespace-pre-wrap">
          {currentQuestion.questionSnapshot.questionText}
        </h2>

        {/* Options */}
        <div className="space-y-3">
          {currentQuestion.questionSnapshot.options.map((option, idx) => {
            const isSelected = selectedIndex === idx
            const isCorrectAnswer = idx === currentQuestion.questionSnapshot.correctOptionIndex

            let optionStyle = 'bg-surface-raised hover:bg-surface-overlay/80 border-border-subtle text-text-main'
            if (isSelected) {
              optionStyle = 'bg-primary-base/10 border-primary-base text-primary-text'
            }

            // Feedback Mode
            if (showsFeedback && isAnswered) {
              if (isCorrectAnswer) {
                optionStyle = 'bg-success-bg border-success-border text-success-text font-medium'
              } else if (isSelected) {
                optionStyle = 'bg-danger-bg border-danger-border text-danger-text'
              } else {
                optionStyle = 'bg-surface-raised/50 border-border-subtle/50 text-text-muted/60 opacity-60'
              }
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => selectAnswer(idx)}
                disabled={showsFeedback && isAnswered}
                className={cn(
                  'w-full text-left p-4 rounded-xl border transition-all cursor-pointer flex justify-between items-center outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base',
                  optionStyle
                )}
                aria-pressed={isSelected}
              >
                <span>{option}</span>
                {showsFeedback && isAnswered && (
                  <span>
                    {isCorrectAnswer && (
                      <svg className="w-5 h-5 text-success-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {isSelected && !isCorrectAnswer && (
                      <svg className="w-5 h-5 text-danger-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Feedback Mode Explanation */}
        {showsFeedback && isAnswered && currentQuestion.questionSnapshot.explanation && (
          <div className="bg-success-bg/20 border border-success-border/30 p-4 rounded-xl space-y-2 mt-4">
            <h4 className="text-sm font-semibold text-success-text">Explanation</h4>
            <p className="text-sm text-text-main whitespace-pre-wrap">
              {currentQuestion.questionSnapshot.explanation}
            </p>
          </div>
        )}
      </Card>

      {/* Navigation and Actions or Inline Confirmation */}
      {showConfirm ? (
        <Card
          role="dialog"
          aria-modal="true"
          className="p-6 space-y-4 focus:outline-none border-primary-base/50 ring-2 ring-primary-base/20"
          aria-labelledby="confirm-heading"
        >
          <div className="space-y-2">
            <h3 id="confirm-heading" className="text-lg font-bold text-text-main">Finish Quiz</h3>
            <p className="text-sm text-text-muted">
              Are you sure you want to finish the quiz?
              {unansweredCount > 0 && (
                <span className="block text-warning-text font-semibold mt-1">
                  You have {unansweredCount} unanswered question{unansweredCount > 1 ? 's' : ''}.
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              ref={cancelBtnRef}
              onClick={closeConfirm}
              disabled={isSubmitting}
              variant="secondary"
              size="sm"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmFinish}
              disabled={isSubmitting}
              variant="primary"
              size="sm"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Answers'}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="flex flex-wrap justify-between items-center gap-3 p-3 sm:p-4">
          <Button
            onClick={previousQuestion}
            disabled={currentIndex === 0}
            variant="secondary"
            size="sm"
          >
            Previous
          </Button>

          <div className="flex gap-2">
            {!isAnswered && (
              <Button
                onClick={skipQuestion}
                variant="secondary"
                size="sm"
              >
                Skip
              </Button>
            )}

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
              <Button
                onClick={nextQuestion}
                variant="primary"
                size="sm"
              >
                Next
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Question Progress Navigator Grid */}
      <Card className="p-6 space-y-3">
        <h3 className="text-sm font-semibold text-text-main">Question Navigator</h3>
        <div className="flex flex-wrap gap-2.5">
          {questions.map((q, idx) => {
            const ans = answers[q.questionId]
            const isCurrent = idx === currentIndex
            const isQAnswered = ans?.selectedOptionIndex !== null
            const isQSkipped = ans?.selectedOptionIndex === null && ans?.timeTakenSeconds > 0

            let style = 'bg-surface-raised text-text-muted hover:bg-surface-overlay border-border-subtle'
            if (isCurrent) {
              style = 'bg-primary-base/10 border-primary-base text-primary-text font-bold ring-2 ring-primary-base/50'
            } else if (isQAnswered) {
              style = 'bg-primary-base text-text-inverse border-primary-base'
            } else if (isQSkipped) {
              style = 'bg-surface-raised border-warning-border/50 text-warning-text'
            }

            return (
              <Button
                key={idx}
                onClick={() => goToQuestion(idx)}
                variant="ghost"
                className={cn(
                  'size-11 rounded-xl border flex items-center justify-center text-sm font-semibold transition-all p-0 shadow-none',
                  style
                )}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {idx + 1}
              </Button>
            )
          })}
        </div>
      </Card>

      {/* Completion Error display */}
      {(submitError || storeError) && (
        <Alert variant="danger">
          {submitError || storeError}
        </Alert>
      )}
    </div>
  )
}
