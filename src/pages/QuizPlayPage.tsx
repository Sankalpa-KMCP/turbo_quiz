import { useState, useEffect, useRef } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useQuizSessionStore } from '../stores/quizSessionStore'

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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Quiz Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 capitalize mb-2">
            {mode} Mode
          </span>
          <h1 className="text-xl font-bold text-slate-100">
            {subjectNameSnap}
            {topicNameSnap && <span className="text-slate-400 font-medium"> • {topicNameSnap}</span>}
          </h1>
        </div>
        <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl text-slate-200">
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-mono font-bold text-lg">{formatTime(elapsedSeconds)}</span>
        </div>
      </div>

      {/* Main Question view */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6">
        <div className="flex justify-between items-center text-sm text-slate-400 border-b border-slate-800 pb-4">
          <span>Question {currentIndex + 1} of {questions.length}</span>
          <span className="capitalize px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs">
            {currentQuestion.questionSnapshot.difficulty}
          </span>
        </div>

        {/* Question Text */}
        <h2 className="text-lg font-semibold text-slate-100 whitespace-pre-wrap">
          {currentQuestion.questionSnapshot.questionText}
        </h2>

        {/* Options */}
        <div className="space-y-3">
          {currentQuestion.questionSnapshot.options.map((option, idx) => {
            const isSelected = selectedIndex === idx
            const isCorrectAnswer = idx === currentQuestion.questionSnapshot.correctOptionIndex

            let optionStyle = 'bg-slate-800 hover:bg-slate-700/80 border-slate-700 text-slate-200'
            if (isSelected) {
              optionStyle = 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
            }

            // Feedback Mode
            if (showsFeedback && isAnswered) {
              if (isCorrectAnswer) {
                optionStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-medium'
              } else if (isSelected) {
                optionStyle = 'bg-rose-500/20 border-rose-500 text-rose-300'
              } else {
                optionStyle = 'bg-slate-800/50 border-slate-800 text-slate-500 opacity-60'
              }
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => selectAnswer(idx)}
                disabled={showsFeedback && isAnswered}
                className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer flex justify-between items-center ${optionStyle}`}
              >
                <span>{option}</span>
                {showsFeedback && isAnswered && (
                  <span>
                    {isCorrectAnswer && (
                      <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {isSelected && !isCorrectAnswer && (
                      <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
          <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl space-y-2 mt-4">
            <h4 className="text-sm font-semibold text-emerald-400">Explanation</h4>
            <p className="text-sm text-slate-300 whitespace-pre-wrap">
              {currentQuestion.questionSnapshot.explanation}
            </p>
          </div>
        )}
      </div>

      {/* Navigation and Actions or Inline Confirmation */}
      {showConfirm ? (
        <div
          role="dialog"
          aria-modal="true"
          className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 focus:outline-none"
          aria-labelledby="confirm-heading"
        >
          <div className="space-y-2">
            <h3 id="confirm-heading" className="text-lg font-bold text-slate-100">Finish Quiz</h3>
            <p className="text-sm text-slate-400">
              Are you sure you want to finish the quiz?
              {unansweredCount > 0 && (
                <span className="block text-amber-400 font-semibold mt-1">
                  You have {unansweredCount} unanswered question{unansweredCount > 1 ? 's' : ''}.
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              ref={cancelBtnRef}
              type="button"
              onClick={closeConfirm}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-sm cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmFinish}
              disabled={isSubmitting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-slate-100 font-bold rounded-xl text-sm cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Answers'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <button
            type="button"
            onClick={previousQuestion}
            disabled={currentIndex === 0}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
          >
            Previous
          </button>

          <div className="flex gap-2">
            {!isAnswered && (
              <button
                type="button"
                onClick={skipQuestion}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
              >
                Skip
              </button>
            )}

            {isLastQuestion ? (
              <button
                ref={finishTriggerRef}
                type="button"
                onClick={openConfirm}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-slate-100 font-bold rounded-xl text-sm transition-colors cursor-pointer"
              >
                Finish Quiz
              </button>
            ) : (
              <button
                type="button"
                onClick={nextQuestion}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-slate-100 font-bold rounded-xl text-sm transition-colors cursor-pointer"
              >
                Next
              </button>
            )}
          </div>
        </div>
      )}

      {/* Question Progress Navigator Grid */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">Question Navigator</h3>
        <div className="flex flex-wrap gap-2.5">
          {questions.map((q, idx) => {
            const ans = answers[q.questionId]
            const isCurrent = idx === currentIndex
            const isQAnswered = ans?.selectedOptionIndex !== null
            const isQSkipped = ans?.selectedOptionIndex === null && ans?.timeTakenSeconds > 0

            let style = 'bg-slate-800 text-slate-400 hover:bg-slate-700 border-slate-700'
            if (isCurrent) {
              style = 'bg-indigo-500/10 border-indigo-500 text-indigo-400 font-bold ring-2 ring-indigo-500/50'
            } else if (isQAnswered) {
              style = 'bg-indigo-600 text-slate-100 border-indigo-600'
            } else if (isQSkipped) {
              style = 'bg-slate-800 border-amber-500/50 text-amber-500'
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => goToQuestion(idx)}
                className={`w-10 h-10 rounded-xl border flex items-center justify-center text-sm font-semibold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${style}`}
              >
                {idx + 1}
              </button>
            )
          })}
        </div>
      </div>

      {/* Completion Error display */}
      {(submitError || storeError) && (
        <div role="alert" className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-4 py-3 rounded-xl text-sm">
          {submitError || storeError}
        </div>
      )}
    </div>
  )
}
