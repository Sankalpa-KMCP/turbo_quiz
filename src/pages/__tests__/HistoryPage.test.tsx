import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { db } from '../../db/database'
import { QuizRepository } from '../../db/repositories/QuizRepository'
import { SubjectRepository } from '../../db/repositories/SubjectRepository'
import { TopicRepository } from '../../db/repositories/TopicRepository'
import HistoryPage from '../HistoryPage'

const quizRepo = new QuizRepository(db)
const subjectRepo = new SubjectRepository(db)
const topicRepo = new TopicRepository(db)

const mockAnswer = {
  questionId: 1,
  selectedOptionIndex: 0,
  timeTakenSeconds: 5,
  questionSnapshot: {
    questionText: 'Q',
    options: ['A', 'B'],
    correctOptionIndex: 0,
    explanation: null,
    difficulty: 'medium' as const
  }
}

describe('HistoryPage', () => {
  beforeEach(async () => {
    await db.subjects.clear()
    await db.topics.clear()
    await db.questions.clear()
    await db.quizAttempts.clear()
    await db.answerAttempts.clear()
    vi.restoreAllMocks()
  })

  afterEach(async () => {
    await db.subjects.clear()
    await db.topics.clear()
    await db.questions.clear()
    await db.quizAttempts.clear()
    await db.answerAttempts.clear()
    vi.restoreAllMocks()
  })

  it('renders overall empty state when no attempts exist', async () => {
    render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/No Past Attempts/i)).toBeInTheDocument()
      expect(screen.queryByLabelText(/^Subject$/i)).not.toBeInTheDocument()
    })
  })

  it('renders error state when database read fails', async () => {
    vi.spyOn(QuizRepository.prototype, 'getAllAttempts').mockRejectedValue(new Error('IndexedDB corrupt'))

    render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Database Connection Error/i)).toBeInTheDocument()
      expect(screen.queryByText(/IndexedDB corrupt/i)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reload History/i })).toBeInTheDocument()
    })
  })

  it('displays attempts newest-first using snapshot names even if deleted/renamed', async () => {
    const sub = await subjectRepo.create({ name: 'Mathematics', description: null })
    const topic = await topicRepo.create({ subjectId: sub.id, name: 'Algebra' })

    // Save attempt 1 (older)
    await quizRepo.save({
      subjectId: sub.id,
      topicId: null,
      subjectNameSnap: 'Math Old Name',
      topicNameSnap: null,
      mode: 'practice',
      startedAt: 1000,
      answers: [mockAnswer]
    })

    // Save attempt 2 (newer)
    await quizRepo.save({
      subjectId: sub.id,
      topicId: topic.id,
      subjectNameSnap: 'Mathematics',
      topicNameSnap: 'Algebra',
      mode: 'exam',
      startedAt: 2000,
      answers: [mockAnswer]
    })

    // Delete the subject
    await subjectRepo.delete(sub.id)

    render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.queryByText(/Loading quiz history/i)).not.toBeInTheDocument()
    })

    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(3)

    // Row 1 (Index 1) -> Mathematics (newer)
    expect(rows[1]).toHaveTextContent('Mathematics')
    expect(rows[1]).toHaveTextContent('Algebra')
    expect(rows[1]).toHaveTextContent('exam')

    // Row 2 (Index 2) -> Math Old Name (older)
    expect(rows[2]).toHaveTextContent('Math Old Name')
    expect(rows[2]).toHaveTextContent('practice')
  })

  it('supports filtering attempts by active Subject', async () => {
    const sub1 = await subjectRepo.create({ name: 'Biology', description: null })
    const sub2 = await subjectRepo.create({ name: 'Physics', description: null })

    // Save attempt for Biology
    await quizRepo.save({
      subjectId: sub1.id,
      topicId: null,
      subjectNameSnap: 'Biology',
      topicNameSnap: null,
      mode: 'practice',
      startedAt: 1000,
      answers: [mockAnswer]
    })

    // Save attempt for Physics
    await quizRepo.save({
      subjectId: sub2.id,
      topicId: null,
      subjectNameSnap: 'Physics',
      topicNameSnap: null,
      mode: 'exam',
      startedAt: 2000,
      answers: [mockAnswer]
    })

    render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>
    )

    // Both should be in dropdown AND in attempt list (so count > 1)
    await waitFor(() => {
      expect(screen.getAllByText('Biology').length).toBeGreaterThan(1)
      expect(screen.getAllByText('Physics').length).toBeGreaterThan(1)
    })

    const filter = screen.getByLabelText(/^Subject$/i)
    fireEvent.change(filter, { target: { value: String(sub1.id) } })

    // Physics should be filtered out (count === 1 for dropdown only)
    await waitFor(() => {
      expect(screen.getAllByText('Biology').length).toBeGreaterThan(1)
      expect(screen.getAllByText('Physics')).toHaveLength(1)
    })

    fireEvent.change(filter, { target: { value: String(sub2.id) } })

    // Biology should be filtered out (count === 1 for dropdown only)
    await waitFor(() => {
      expect(screen.getAllByText('Biology')).toHaveLength(1)
      expect(screen.getAllByText('Physics').length).toBeGreaterThan(1)
    })
  })

  it('renders filtered empty state when filter matches no attempts', async () => {
    const sub1 = await subjectRepo.create({ name: 'Biology', description: null })
    const sub2 = await subjectRepo.create({ name: 'Physics', description: null })

    await quizRepo.save({
      subjectId: sub1.id,
      topicId: null,
      subjectNameSnap: 'Biology',
      topicNameSnap: null,
      mode: 'practice',
      startedAt: 1000,
      answers: [mockAnswer]
    })

    render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('Biology').length).toBeGreaterThan(1)
    })

    const filter = screen.getByLabelText(/^Subject$/i)
    fireEvent.change(filter, { target: { value: String(sub2.id) } })

    await waitFor(() => {
      expect(screen.getByText(/No Attempts for this Subject/i)).toBeInTheDocument()
      // Biology is filtered out (dropdown only)
      expect(screen.getAllByText('Biology')).toHaveLength(1)
    })
  })

  it('renders link targeting /quiz/results/:attemptId', async () => {
    const sub = await subjectRepo.create({ name: 'Biology', description: null })
    const attempt = await quizRepo.save({
      subjectId: sub.id,
      topicId: null,
      subjectNameSnap: 'Biology',
      topicNameSnap: null,
      mode: 'practice',
      startedAt: 1000,
      answers: [mockAnswer]
    })

    render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      const links = screen.getAllByRole('link', { name: /Review/i })
      expect(links.length).toBeGreaterThan(0)
      for (const link of links) {
        expect(link).toHaveAttribute('href', `/quiz/results/${attempt.id}`)
      }
    })
  })
})
