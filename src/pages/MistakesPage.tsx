import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../db/database'
import { QuizRepository } from '../db/repositories/QuizRepository'
import { SubjectRepository } from '../db/repositories/SubjectRepository'
import { TopicRepository } from '../db/repositories/TopicRepository'
import { useQuizSessionStore } from '../stores/quizSessionStore'
import { type AnswerAttempt } from '../types/db'

import { Alert } from '../components/ui/Alert'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { buttonStyles } from '../components/ui/buttonStyles'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingState } from '../components/ui/LoadingState'
import { PageHeader } from '../components/ui/PageHeader'

const quizRepo = new QuizRepository(db)
const subjectRepo = new SubjectRepository(db)
const topicRepo = new TopicRepository(db)

interface MistakeItem {
  questionId: number
  answerAttempt: AnswerAttempt
  wasSkipped: boolean
}

interface GroupedMistakes {
  subjectId: number
  topicId: number | null
  subjectName: string
  topicName: string | null
  questionIds: number[]
  items: MistakeItem[]
}

function topicFallbackLabel(topicName: string | null): string {
  return topicName ?? 'No specific topic'
}

export default function MistakesPage() {
  const navigate = useNavigate()
  const configureSetup = useQuizSessionStore((s) => s.configureSetup)
  const startSession = useQuizSessionStore((s) => s.startSession)

  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [groupedMistakes, setGroupedMistakes] = useState<GroupedMistakes[]>([])
  const [totalMistakes, setTotalMistakes] = useState(0)

  useEffect(() => {
    let active = true

    async function loadMistakes() {
      try {
        const projections = await quizRepo.getMistakeProjections()
        const subjects = await subjectRepo.getAll()
        const topics = await topicRepo.getAll()

        if (!active) return

        const subjectMap = new Map(subjects.map((s) => [s.id, s.name]))
        const topicMap = new Map(topics.map((t) => [t.id, t.name]))

        const activeMistakes = projections.filter((p) => p.answerAttempt.questionId !== null)

        const groups = new Map<string, GroupedMistakes>()
        let total = 0

        for (const p of activeMistakes) {
          const sId = p.parentAttempt.subjectId
          const tId = p.parentAttempt.topicId

          if (sId === null) continue

          const key = `${sId}-${tId === null ? 'null' : tId}`

          if (!groups.has(key)) {
            groups.set(key, {
              subjectId: sId,
              topicId: tId,
              subjectName: subjectMap.get(sId) || p.parentAttempt.subjectNameSnap || 'Unknown Subject',
              topicName: tId !== null
                ? (topicMap.get(tId) || p.parentAttempt.topicNameSnap || 'Unknown Topic')
                : null,
              questionIds: [],
              items: [],
            })
          }

          const qId = p.answerAttempt.questionId!
          const group = groups.get(key)!
          group.questionIds.push(qId)
          group.items.push({
            questionId: qId,
            answerAttempt: p.answerAttempt,
            wasSkipped: p.wasSkipped,
          })
          total++
        }

        const sortedGroups = Array.from(groups.values()).sort((a, b) => {
          if (a.subjectName !== b.subjectName) return a.subjectName.localeCompare(b.subjectName)
          if (a.topicName === null && b.topicName !== null) return -1
          if (a.topicName !== null && b.topicName === null) return 1
          if (a.topicName && b.topicName) return a.topicName.localeCompare(b.topicName)
          return 0
        })

        setGroupedMistakes(sortedGroups)
        setTotalMistakes(total)
        setLoading(false)
      } catch (err) {
        console.error('Failed to load mistakes:', err)
        if (active) {
          setHasError(true)
          setLoading(false)
        }
      }
    }

    loadMistakes()
    return () => { active = false }
  }, [])

  const handleRetryGroup = async (group: GroupedMistakes) => {
    configureSetup({
      subjectId: group.subjectId,
      topicId: group.topicId,
      mode: 'mistakes',
      questionCount: 'all',
      retryQuestionIds: group.questionIds,
    })
    await startSession()
    navigate('/quiz/play')
  }

  const handleRetryAll = async () => {
    const allQuestionIds = groupedMistakes.flatMap((g) => g.questionIds)
    const first = groupedMistakes[0]
    configureSetup({
      subjectId: first.subjectId,
      topicId: null,
      mode: 'mistakes',
      questionCount: 'all',
      retryQuestionIds: allQuestionIds,
    })
    await startSession()
    navigate('/quiz/play')
  }

  if (loading) {
    return <LoadingState label="Loading active mistakes…" />
  }

  if (hasError) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-4">
        <Alert variant="danger">
          <div className="space-y-2">
            <p className="font-semibold text-danger-text">Failed to Load Mistakes</p>
            <p>We encountered an issue reading your quiz mistakes from the database.</p>
          </div>
        </Alert>
        <Button onClick={() => window.location.reload()} variant="primary" className="w-full sm:w-auto">
          Retry
        </Button>
      </div>
    )
  }

  const uniqueSubjects = new Set(groupedMistakes.map((g) => g.subjectId))

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        title="Mistakes & Weaknesses"
        description="Review questions you missed or skipped, then retry focused groups until they are resolved."
        action={
          totalMistakes > 0 && uniqueSubjects.size === 1 ? (
            <Button onClick={handleRetryAll} variant="primary">
              Retry All {totalMistakes}
            </Button>
          ) : undefined
        }
      />

      {totalMistakes === 0 ? (
        <EmptyState
          tone="success"
          title="No Active Mistakes"
          description="You have no unresolved mistakes. Keep practicing to reinforce what you know."
          icon={
            <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          action={<Link to="/quiz/setup" className={buttonStyles({ variant: 'primary' })}>Practice more</Link>}
        />
      ) : (
        <div className="space-y-10">
          <section aria-label="Mistakes summary" className="border-b border-border-subtle pb-5">
            <h2 className="text-base font-semibold text-text-main">
              {totalMistakes} Active Mistake{totalMistakes !== 1 ? 's' : ''}
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Questions that were answered incorrectly or skipped on your latest attempt for each item.
            </p>
          </section>

          {groupedMistakes.map((group) => (
            <section
              key={`${group.subjectId}-${group.topicId}`}
              className="space-y-4"
              aria-labelledby={`mistake-group-${group.subjectId}-${group.topicId ?? 'none'}`}
            >
              <div className="flex flex-col gap-3 border-b border-border-subtle pb-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <h2
                    id={`mistake-group-${group.subjectId}-${group.topicId ?? 'none'}`}
                    className="text-base font-semibold text-text-main"
                  >
                    {group.subjectName}
                  </h2>
                  <p className="mt-0.5 text-sm text-text-muted">
                    <span>{topicFallbackLabel(group.topicName)}</span>
                    <span aria-hidden="true"> · </span>
                    <span>
                      {group.questionIds.length} mistake{group.questionIds.length !== 1 ? 's' : ''}
                    </span>
                  </p>
                </div>
                <Button
                  onClick={() => handleRetryGroup(group)}
                  variant="secondary"
                  size="sm"
                  className="w-full shrink-0 sm:w-auto"
                  aria-label={`Retry group: ${group.subjectName}, ${topicFallbackLabel(group.topicName)}`}
                >
                  Retry Group
                </Button>
              </div>

              <ul className="divide-y divide-border-subtle border-t border-border-subtle">
                {group.items.map((item) => {
                  const snap = item.answerAttempt.questionSnapshot
                  const selectedIdx = item.answerAttempt.selectedOptionIndex
                  const correctIdx = snap.correctOptionIndex
                  const chosenText = item.wasSkipped || selectedIdx === null
                    ? null
                    : snap.options[selectedIdx]
                  const correctText = snap.options[correctIdx]

                  return (
                    <li key={item.questionId} className="space-y-3 py-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 font-serif text-base font-semibold leading-relaxed tracking-tight text-text-main whitespace-pre-wrap">
                          {snap.questionText}
                        </p>
                        <Badge variant={item.wasSkipped ? 'warning' : 'danger'}>
                          {item.wasSkipped ? 'Skipped' : 'Incorrect'}
                        </Badge>
                      </div>

                      <dl className="space-y-2 text-sm">
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">
                            Your answer
                          </dt>
                          <dd className="mt-0.5 text-danger-text">
                            {chosenText ?? 'No answer selected'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">
                            Correct answer
                          </dt>
                          <dd className="mt-0.5 text-success-text">{correctText}</dd>
                        </div>
                      </dl>

                      {snap.explanation ? (
                        <div className="rounded-lg border border-border-subtle bg-surface-raised px-3 py-2.5">
                          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                            Explanation
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-text-main whitespace-pre-wrap">
                            {snap.explanation}
                          </p>
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
