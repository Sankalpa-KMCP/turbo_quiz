import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../db/database'
import { QuizRepository } from '../db/repositories/QuizRepository'
import { SubjectRepository } from '../db/repositories/SubjectRepository'
import { TopicRepository } from '../db/repositories/TopicRepository'
import { useQuizSessionStore } from '../stores/quizSessionStore'

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
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
        <p className="text-slate-400 text-sm">Loading active mistakes...</p>
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md mx-auto text-center space-y-6">
        <div className="text-rose-400">Failed to load mistakes.</div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-slate-100 rounded-lg text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  const uniqueSubjects = new Set(groupedMistakes.map(g => g.subjectId))

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight sm:text-3xl">Mistakes & Weaknesses</h1>
        <p className="text-slate-400 text-sm mt-1 max-w-2xl">
          Review your weak spots. We track questions you've missed or skipped in recent attempts so you can retry them and master the material.
        </p>
      </div>

      {totalMistakes === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-4">
          <div className="inline-flex p-4 bg-emerald-500/10 rounded-full text-emerald-400">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-200">No Active Mistakes</h2>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              Great job! You either haven't made any mistakes recently, or you've successfully resolved them all.
            </p>
          </div>
          <Link
            to="/quiz/setup"
            className="inline-flex px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-slate-100 font-bold rounded-xl text-sm transition-colors shadow-md"
          >
            Practice More
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
            <div>
              <h2 className="text-lg font-bold text-slate-200">{totalMistakes} Active Mistake{totalMistakes !== 1 ? 's' : ''}</h2>
              <p className="text-sm text-slate-400">Questions that were answered incorrectly or skipped on your latest attempt.</p>
            </div>

            {uniqueSubjects.size === 1 && (
              <button
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
                className="shrink-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-slate-100 font-bold rounded-lg text-sm transition-colors shadow"
              >
                Retry All {totalMistakes}
              </button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {groupedMistakes.map((group) => (
              <div key={`${group.subjectId}-${group.topicId}`} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="font-bold text-slate-200">{group.subjectName}</h3>
                  <p className="text-sm text-slate-400 font-medium">
                    {group.topicName ? group.topicName : 'Mixed / No Topic'}
                  </p>
                  <p className="text-xs text-rose-400 mt-2 font-semibold bg-rose-500/10 inline-block px-2 py-1 rounded">
                    {group.questionIds.length} Mistake{group.questionIds.length !== 1 ? 's' : ''}
                  </p>
                </div>

                <button
                  onClick={() => handleRetryGroup(group)}
                  className="w-full text-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-sm transition-colors border border-slate-700"
                >
                  Retry Group
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
