import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { SubjectRepository } from '../db/repositories/SubjectRepository'
import { TopicRepository } from '../db/repositories/TopicRepository'
import { QuestionRepository } from '../db/repositories/QuestionRepository'
import { useQuizSessionStore } from '../stores/quizSessionStore'

const subjectRepo = new SubjectRepository(db)
const topicRepo = new TopicRepository(db)
const questionRepo = new QuestionRepository(db)

export default function QuizSetupPage() {
  const navigate = useNavigate()
  const configureSetup = useQuizSessionStore((s) => s.configureSetup)
  const startSession = useQuizSessionStore((s) => s.startSession)
  const storePhase = useQuizSessionStore((s) => s.phase)
  const storeError = useQuizSessionStore((s) => s.error)
  const resetSession = useQuizSessionStore((s) => s.resetSession)

  const [selectedSubjectId, setSelectedSubjectId] = useState<number | ''>('')
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null)
  const [mode, setMode] = useState<'practice' | 'exam'>('practice')
  const [questionCount, setQuestionCount] = useState<number | 'all'>('all')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Reset the store when we enter the setup page to clear past sessions
  useEffect(() => {
    resetSession()
  }, [resetSession])

  // Load all subjects alphabetically
  const subjects = useLiveQuery(() => subjectRepo.getAll()) || []

  // Load topics for selected subject
  const topics = useLiveQuery(
    () => (selectedSubjectId ? topicRepo.getBySubject(selectedSubjectId) : Promise.resolve([])),
    [selectedSubjectId]
  ) || []

  // Compute eligible questions count
  const eligibleCount = useLiveQuery(
    async () => {
      if (!selectedSubjectId) return 0
      if (selectedTopicId !== null) {
        return await questionRepo.countByTopic(selectedTopicId)
      } else {
        return await questionRepo.countBySubject(selectedSubjectId)
      }
    },
    [selectedSubjectId, selectedTopicId]
  ) ?? 0

  const activeQuestionCount =
    questionCount !== 'all' && eligibleCount > 0 && questionCount > eligibleCount
      ? 'all'
      : questionCount

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSubjectId) {
      setErrorMsg('Please select a subject')
      return
    }
    if (eligibleCount === 0) {
      setErrorMsg('Cannot start a quiz with 0 eligible questions')
      return
    }

    setErrorMsg(null)

    try {
      configureSetup({
        subjectId: selectedSubjectId,
        topicId: selectedTopicId,
        mode,
        questionCount: activeQuestionCount
      })
      await startSession()
    } catch {
      // Errors will be captured in the store state or thrown
    }
  }

  // Redirect to play page if store phase transitions to playing
  useEffect(() => {
    if (storePhase === 'playing') {
      navigate('/quiz/play')
    }
  }, [storePhase, navigate])

  const countOptions = [5, 10, 15, 20]

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight sm:text-3xl">Configure Quiz</h1>
        <p className="text-slate-400 text-sm mt-1">
          Select your subject, topic, and options to start practicing.
        </p>
      </div>

      <form onSubmit={handleStart} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6">
        {/* Subject Select */}
        <div className="space-y-2">
          <label htmlFor="subject-select" className="block text-sm font-semibold text-slate-200">
            Subject <span className="text-rose-500">*</span>
          </label>
          <select
            id="subject-select"
            value={selectedSubjectId}
            onChange={(e) => {
              setSelectedSubjectId(e.target.value ? Number(e.target.value) : '')
              setSelectedTopicId(null)
            }}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          >
            <option value="">Select a Subject</option>
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </div>

        {/* Topic Select */}
        <div className="space-y-2">
          <label htmlFor="topic-select" className="block text-sm font-semibold text-slate-200">
            Topic
          </label>
          <select
            id="topic-select"
            value={selectedTopicId === null ? '' : selectedTopicId}
            onChange={(e) => setSelectedTopicId(e.target.value ? Number(e.target.value) : null)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            disabled={!selectedSubjectId}
          >
            <option value="">All Topics</option>
            {topics.map((top) => (
              <option key={top.id} value={top.id}>
                {top.name}
              </option>
            ))}
          </select>
        </div>

        {/* Mode fieldset */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-slate-200">Quiz Mode</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="practice"
                checked={mode === 'practice'}
                onChange={() => setMode('practice')}
                className="accent-indigo-500 w-4 h-4"
              />
              Practice (Instant feedback)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="exam"
                checked={mode === 'exam'}
                onChange={() => setMode('exam')}
                className="accent-indigo-500 w-4 h-4"
              />
              Exam (Results at the end)
            </label>
          </div>
        </fieldset>

        {/* Question Count Select */}
        <div className="space-y-2">
          <label htmlFor="count-select" className="block text-sm font-semibold text-slate-200">
            Number of Questions
          </label>
          <select
            id="count-select"
            value={activeQuestionCount}
            onChange={(e) => setQuestionCount(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={!selectedSubjectId || eligibleCount === 0}
          >
            <option value="all">All Questions ({eligibleCount})</option>
            {countOptions.map((opt) => (
              <option key={opt} value={opt} disabled={opt > eligibleCount}>
                {opt} Questions
              </option>
            ))}
          </select>
        </div>

        {/* Live eligible questions count indicator */}
        {selectedSubjectId && (
          <div className="text-sm text-slate-400">
            Available questions: <span className="font-semibold text-indigo-400">{eligibleCount}</span>
          </div>
        )}

        {/* Error display */}
        {(errorMsg || storeError) && (
          <div role="alert" className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-4 py-3 rounded-xl text-sm">
            {errorMsg || storeError}
          </div>
        )}

        {/* Start Button */}
        <button
          type="submit"
          disabled={!selectedSubjectId || eligibleCount === 0 || storePhase === 'loading'}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-slate-100 font-bold rounded-xl transition-all cursor-pointer shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {storePhase === 'loading' ? 'Loading questions...' : 'Start Quiz'}
        </button>
      </form>
    </div>
  )
}
