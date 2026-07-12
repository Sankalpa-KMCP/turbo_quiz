import { useState, useMemo, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { SubjectRepository } from '../db/repositories/SubjectRepository'
import { TopicRepository } from '../db/repositories/TopicRepository'
import { QuestionRepository } from '../db/repositories/QuestionRepository'
import type { TopicFilter } from '../db/repositories/QuestionRepository'
import type { BookmarkStatus, Difficulty } from '../types/db'
import { useDebounce } from '../utils/useDebounce'

const subjectRepo = new SubjectRepository(db)
const topicRepo = new TopicRepository(db)
const questionRepo = new QuestionRepository(db)

export default function QuestionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const subjectIdParam = searchParams.get('subjectId')
  const parsedSubjectId = Number(subjectIdParam)
  const isValidSubjectId = !isNaN(parsedSubjectId) && parsedSubjectId > 0 && Number.isInteger(parsedSubjectId)

  const topicIdParam = searchParams.get('topicId') // 'uncategorized', number, or null
  const difficultyParam = searchParams.get('difficulty') as Difficulty | null
  const bookmarkParam = searchParams.get('bookmark') // '1' or null
  const rawSearchText = searchParams.get('q') || ''

  const [searchText, setSearchText] = useState(rawSearchText)
  const debouncedSearchText = useDebounce(searchText, 300)

  // Update URL on debounced search text change
  useEffect(() => {
    if (debouncedSearchText !== rawSearchText) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        if (debouncedSearchText) {
          next.set('q', debouncedSearchText)
        } else {
          next.delete('q')
        }
        return next
      }, { replace: true })
    }
  }, [debouncedSearchText, rawSearchText, setSearchParams])

  const subject = useLiveQuery(
    () => (isValidSubjectId ? subjectRepo.getById(parsedSubjectId).then(s => s ?? null) : Promise.resolve(null)),
    [isValidSubjectId, parsedSubjectId]
  )

  const topics = useLiveQuery(
    () => (isValidSubjectId && subject ? topicRepo.getBySubject(parsedSubjectId) : Promise.resolve([])),
    [isValidSubjectId, subject, parsedSubjectId]
  )

  const topicFilter: TopicFilter = useMemo(() => {
    if (!topicIdParam) return { kind: 'all' }
    if (topicIdParam === 'uncategorized') return { kind: 'uncategorized' }
    const tId = Number(topicIdParam)
    if (!isNaN(tId) && tId > 0 && Number.isInteger(tId)) return { kind: 'topic', topicId: tId }
    return { kind: 'all' }
  }, [topicIdParam])

  const questions = useLiveQuery(async () => {
    if (!isValidSubjectId || !subject) return []
    return await questionRepo.search({
      subjectId: parsedSubjectId,
      topicFilter,
      difficulty: difficultyParam || undefined,
      bookmarkStatus: bookmarkParam === '1' ? 1 : undefined,
      searchText: debouncedSearchText || undefined
    })
  }, [isValidSubjectId, subject, parsedSubjectId, topicFilter, difficultyParam, bookmarkParam, debouncedSearchText])

  const toggleBookmark = async (id: number, currentStatus: BookmarkStatus) => {
    try {
      await questionRepo.update(id, { bookmarkStatus: currentStatus === 1 ? 0 : 1 })
    } catch (err) {
      console.error('Failed to toggle bookmark', err)
    }
  }

  if (!isValidSubjectId) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-slate-100">Invalid Subject ID</h1>
        <p className="text-slate-400">Questions must be viewed within a valid subject.</p>
        <Link to="/subjects" className="text-indigo-400 hover:underline">Go to Subjects</Link>
      </div>
    )
  }

  if (subject === undefined) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="text-slate-400 text-sm">Loading...</div>
      </div>
    )
  }

  if (subject === null) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-slate-100">Subject Not Found</h1>
        <p className="text-slate-400">The subject you are looking for does not exist.</p>
        <Link to="/subjects" className="text-indigo-400 hover:underline">Go to Subjects</Link>
      </div>
    )
  }

  const handleFilterChange = (key: string, value: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) {
        next.set(key, value)
      } else {
        next.delete(key)
      }
      return next
    }, { replace: true })
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link to={`/subjects/${subject.id}`} className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center gap-1 mb-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to {subject.name}
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight sm:text-3xl">Questions Bank</h1>
          <p className="text-slate-400 text-sm mt-1">{questions?.length || 0} Questions Found</p>
        </div>
        <Link
          to={`/questions/new?subjectId=${subject.id}${topicIdParam && topicIdParam !== 'uncategorized' ? `&topicId=${topicIdParam}` : ''}`}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-slate-100 font-bold rounded-xl text-sm cursor-pointer transition-colors whitespace-nowrap"
        >
          + Create Question
        </Link>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row gap-4">
        <div className="flex-1 w-full relative">
          <label htmlFor="search-q" className="sr-only">Search text</label>
          <input
            id="search-q"
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Search questions..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[120px]">
            <label htmlFor="filter-topic" className="sr-only">Topic</label>
            <select
              id="filter-topic"
              value={topicIdParam || ''}
              onChange={e => handleFilterChange('topicId', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            >
              <option value="">All Topics</option>
              <option value="uncategorized">Uncategorized</option>
              {topics?.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[110px]">
            <label htmlFor="filter-difficulty" className="sr-only">Difficulty</label>
            <select
              id="filter-difficulty"
              value={difficultyParam || ''}
              onChange={e => handleFilterChange('difficulty', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            >
              <option value="">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div className="flex-1 min-w-[110px]">
            <label htmlFor="filter-bookmark" className="sr-only">Bookmarks</label>
            <select
              id="filter-bookmark"
              value={bookmarkParam || ''}
              onChange={e => handleFilterChange('bookmark', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            >
              <option value="">All Questions</option>
              <option value="1">Bookmarked</option>
            </select>
          </div>
        </div>
      </div>

      {/* List */}
      {questions === undefined ? (
        <div className="text-center py-12 text-slate-500">Loading questions...</div>
      ) : questions.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center">
          <p className="text-slate-400 text-lg">No questions match your filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map(q => {
            const t = topics?.find(t => t.id === q.topicId)
            const topicName = t ? t.name : 'Uncategorized'

            return (
              <div key={q.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 transition-all hover:border-slate-700 flex flex-col sm:flex-row gap-4 sm:items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="px-2 py-0.5 bg-slate-800 rounded text-xs font-semibold text-slate-300">
                      {topicName}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                      q.difficulty === 'easy' ? 'bg-emerald-500/10 text-emerald-400' :
                      q.difficulty === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-rose-500/10 text-rose-400'
                    }`}>
                      {q.difficulty}
                    </span>
                  </div>
                  <h3 className="text-lg font-medium text-slate-100 whitespace-pre-wrap">{q.questionText}</h3>
                </div>

                <div className="flex sm:flex-col gap-2 shrink-0">
                  <button
                    type="button"
                    title={q.bookmarkStatus === 1 ? "Remove Bookmark" : "Bookmark"}
                    onClick={() => toggleBookmark(q.id, q.bookmarkStatus)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer transition-colors group flex items-center justify-center"
                  >
                    <svg
                      className={`w-5 h-5 ${q.bookmarkStatus === 1 ? 'fill-amber-400 text-amber-400' : 'fill-none stroke-current group-hover:text-amber-400 group-hover:stroke-current'}`}
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </button>
                  <Link
                    to={`/questions/${q.id}/edit`}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer transition-colors flex items-center justify-center"
                    title="Edit Question"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
