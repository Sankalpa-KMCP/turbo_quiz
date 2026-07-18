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

import { Select } from '../components/ui/Select'
import { Input } from '../components/ui/Input'
import { buttonStyles } from '../components/ui/buttonStyles'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingState } from '../components/ui/LoadingState'
import { PageHeader } from '../components/ui/PageHeader'

const subjectRepo = new SubjectRepository(db)
const topicRepo = new TopicRepository(db)
const questionRepo = new QuestionRepository(db)

export default function QuestionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const subjectIdParam = searchParams.get('subjectId')
  const parsedSubjectId = Number(subjectIdParam)
  const isValidSubjectId = !isNaN(parsedSubjectId) && parsedSubjectId > 0 && Number.isInteger(parsedSubjectId)

  const topicIdParam = searchParams.get('topicId')
  const difficultyParam = searchParams.get('difficulty') as Difficulty | null
  const bookmarkParam = searchParams.get('bookmark')
  const rawSearchText = searchParams.get('q') || ''

  const [searchText, setSearchText] = useState(rawSearchText)
  const debouncedSearchText = useDebounce(searchText, 300)

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

  const allSubjects = useLiveQuery(() => subjectRepo.getAll(), [])

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
    if (allSubjects === undefined) {
      return <LoadingState label="Loading subjects…" />
    }

    if (allSubjects.length === 0) {
      return (
        <div className="mx-auto max-w-3xl space-y-6">
          <PageHeader
            title="Questions Bank"
            description="Questions are organized inside subjects so your practice sessions stay focused."
          />
          <EmptyState
            title="Create a subject first"
            description="Add a subject to your library, then return here to browse and manage its questions."
            icon={
              <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            }
            action={<Link to="/subjects" className={buttonStyles({ variant: 'primary' })}>Create your first subject</Link>}
          />
        </div>
      )
    }

    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Questions Bank"
          description="Choose a subject to browse, search, create, and edit questions in its bank."
        />
        <section className="rounded-lg border border-border-subtle bg-surface-raised p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-text-main">Select a subject</h2>
          <p className="mt-1 text-sm text-text-muted">
            Questions stay scoped to one subject so practice sessions remain focused.
          </p>
          <ul className="mt-4 divide-y divide-border-subtle border-t border-border-subtle">
            {allSubjects.map((item) => (
              <li key={item.id}>
                <Link
                  to={`/questions?subjectId=${item.id}`}
                  className="flex min-h-11 items-center justify-between gap-3 py-3 text-sm font-medium text-text-main transition-colors hover:text-primary-text focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                >
                  <span>{item.name}</span>
                  <svg className="w-4 h-4 shrink-0 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    )
  }

  if (subject === undefined) {
    return <LoadingState label="Loading question bank…" />
  }

  if (subject === null) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="font-serif text-2xl font-semibold text-text-main">Subject Not Found</h1>
        <p className="text-text-muted">The subject you are looking for does not exist.</p>
        <Link to="/subjects" className="text-primary-text hover:underline">Go to Subjects</Link>
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
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Questions Bank"
        description={`${questions?.length || 0} question${questions?.length === 1 ? '' : 's'} found in ${subject.name}`}
        eyebrow={
          <Link
            to={`/subjects/${subject.id}`}
            className="inline-flex min-h-9 items-center gap-1 rounded-sm text-sm font-medium text-primary-text transition-colors hover:text-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to {subject.name}
          </Link>
        }
        action={
          <Link
            to={`/questions/new?subjectId=${subject.id}${topicIdParam && topicIdParam !== 'uncategorized' ? `&topicId=${topicIdParam}` : ''}`}
            className={buttonStyles({ variant: 'primary' })}
          >
            + Create Question
          </Link>
        }
      />

      <section
        aria-label="Question filters"
        className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-raised p-3 sm:p-4"
      >
        <div className="w-full">
          <label htmlFor="search-q" className="sr-only">Search text</label>
          <Input
            id="search-q"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Search questions..."
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="filter-topic" className="sr-only">Topic</label>
            <Select
              id="filter-topic"
              value={topicIdParam || ''}
              onChange={e => handleFilterChange('topicId', e.target.value)}
            >
              <option value="">All Topics</option>
              <option value="uncategorized">Uncategorized</option>
              {topics?.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="filter-difficulty" className="sr-only">Difficulty</label>
            <Select
              id="filter-difficulty"
              value={difficultyParam || ''}
              onChange={e => handleFilterChange('difficulty', e.target.value)}
            >
              <option value="">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </Select>
          </div>
          <div>
            <label htmlFor="filter-bookmark" className="sr-only">Bookmarks</label>
            <Select
              id="filter-bookmark"
              value={bookmarkParam || ''}
              onChange={e => handleFilterChange('bookmark', e.target.value)}
            >
              <option value="">All Questions</option>
              <option value="1">Bookmarked</option>
            </Select>
          </div>
        </div>
      </section>

      {questions === undefined ? (
        <LoadingState compact label="Loading questions…" />
      ) : questions.length === 0 ? (
        <EmptyState
          title="No questions match your filters."
          description="Clear or adjust the filters above, or create a new question in this subject."
          icon={
            <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 4a7 7 0 105.3 11.6L21 20.3M11 8v3m0 3h.01" />
            </svg>
          }
        />
      ) : (
        <ul className="divide-y divide-border-subtle border-t border-border-subtle">
          {questions.map(q => {
            const t = topics?.find(topic => topic.id === q.topicId)
            const topicName = t ? t.name : 'Uncategorized'
            const bookmarked = q.bookmarkStatus === 1

            return (
              <li key={q.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-text-muted">
                    <span>{topicName}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="capitalize">{q.difficulty}</span>
                    {bookmarked ? (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span>Bookmarked</span>
                      </>
                    ) : null}
                  </p>
                  <h3 className="mt-1 text-base font-medium leading-6 text-text-main whitespace-pre-wrap break-words">
                    {q.questionText}
                  </h3>
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    title={bookmarked ? 'Remove Bookmark' : 'Bookmark'}
                    aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark question'}
                    aria-pressed={bookmarked}
                    onClick={() => toggleBookmark(q.id, q.bookmarkStatus)}
                    className="inline-flex size-11 items-center justify-center rounded-lg border border-border-subtle bg-surface-raised text-text-main transition-colors hover:bg-surface-overlay focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus cursor-pointer"
                  >
                    <svg
                      className={`h-5 w-5 ${bookmarked ? 'fill-warning-text text-warning-text' : 'fill-none stroke-current'}`}
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </button>
                  <Link
                    to={`/questions/${q.id}/edit`}
                    className="inline-flex size-11 items-center justify-center rounded-lg border border-border-subtle bg-surface-raised text-text-main transition-colors hover:bg-surface-overlay focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                    title="Edit Question"
                    aria-label="Edit Question"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
