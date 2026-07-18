import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../db/database'
import { QuizRepository } from '../db/repositories/QuizRepository'
import { SubjectRepository } from '../db/repositories/SubjectRepository'
import { TopicRepository } from '../db/repositories/TopicRepository'
import { useQuizSessionStore } from '../stores/quizSessionStore'

import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { buttonStyles } from '../components/ui/buttonStyles'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingState } from '../components/ui/LoadingState'
import { PageHeader } from '../components/ui/PageHeader'

const quizRepo = new QuizRepository(db)
const subjectRepo = new SubjectRepository(db)
const topicRepo = new TopicRepository(db)

interface GroupedMistakes {
  subjectId: number
  topicId: number | null
  subjectName: string
  topicName: string | null
  questionIds: number[]
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

        // Filter out deleted questions
        const activeMistakes = projections.filter((p) => p.answerAttempt.questionId !== null)

        const groups = new Map<string, GroupedMistakes>()
        let total = 0

        for (const p of activeMistakes) {
          const sId = p.parentAttempt.subjectId
          const tId = p.parentAttempt.topicId

          // If subjectId is null, the subject was deleted, so questions should have been deleted too.
          // We defensively skip it if it happens.
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
              questionIds: []
            })
          }

          const qId = p.answerAttempt.questionId!
          groups.get(key)!.questionIds.push(qId)
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
      retryQuestionIds: group.questionIds
    })
    await startSession()
    navigate('/quiz/play')
  }

  if (loading) {
    return <LoadingState label="Loading active mistakes…" />
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
          <h2 className="text-lg font-bold text-text-main">Failed to Load Mistakes</h2>
          <p className="text-sm text-text-muted">We encountered an issue reading your quiz mistakes from the database.</p>
        </div>
        <Button
          onClick={() => window.location.reload()}
          variant="primary"
          className="w-full"
        >
          Retry
        </Button>
      </Card>
    )
  }

  const uniqueSubjects = new Set(groupedMistakes.map(g => g.subjectId))

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <PageHeader
        title="Mistakes & Weaknesses"
        description="Review questions you missed or skipped, then retry focused groups until they are resolved."
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
        <div className="space-y-6">
          <Card className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6">
            <div>
              <h2 className="text-lg font-bold text-text-main">{totalMistakes} Active Mistake{totalMistakes !== 1 ? 's' : ''}</h2>
              <p className="text-sm text-text-muted">Questions that were answered incorrectly or skipped on your latest attempt.</p>
            </div>

            {uniqueSubjects.size === 1 && (
              <Button
                onClick={() => {
                  const allQuestionIds = groupedMistakes.flatMap(g => g.questionIds)
                  const first = groupedMistakes[0]
                  configureSetup({
                    subjectId: first.subjectId,
                    topicId: null,
                    mode: 'mistakes',
                    questionCount: 'all',
                    retryQuestionIds: allQuestionIds
                  })
                  startSession().then(() => {
                    navigate('/quiz/play')
                  })
                }}
                variant="primary"
                className="shrink-0 font-bold"
              >
                Retry All {totalMistakes}
              </Button>
            )}
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            {groupedMistakes.map((group) => (
              <Card key={`${group.subjectId}-${group.topicId}`} className="p-5 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="font-bold text-text-main">{group.subjectName}</h3>
                  <p className="text-sm text-text-muted font-medium">
                    {group.topicName ? group.topicName : 'Mixed / No Topic'}
                  </p>
                  <div className="mt-2.5">
                    <Badge variant="danger" className="font-semibold">
                      {group.questionIds.length} Mistake{group.questionIds.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </div>

                <Button
                  onClick={() => handleRetryGroup(group)}
                  variant="secondary"
                  className="w-full text-center"
                >
                  Retry Group
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
