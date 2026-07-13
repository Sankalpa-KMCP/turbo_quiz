import { render, screen, waitFor, within } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { db } from '../../db/database'
import { QuizRepository } from '../../db/repositories/QuizRepository'
import { SubjectRepository } from '../../db/repositories/SubjectRepository'
import Dashboard from '../Dashboard'

const quizRepo = new QuizRepository(db)
const subjectRepo = new SubjectRepository(db)

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

describe('Dashboard', () => {
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
        <Dashboard />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/No Analytics Yet/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /Start Your First Quiz/i })).toBeInTheDocument()
    })
  })

  it('renders error state when database read fails', async () => {
    vi.spyOn(QuizRepository.prototype, 'getAllAttempts').mockRejectedValue(new Error('IndexedDB blocked'))

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Database Connection Error/i)).toBeInTheDocument()
      expect(screen.queryByText(/IndexedDB blocked/i)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Reload Dashboard/i })).toBeInTheDocument()
    })
  })

  it('calculates and renders aggregates and subject breakdowns correctly', async () => {
    const sub1 = await subjectRepo.create({ name: 'Mathematics', description: null })
    const sub2 = await subjectRepo.create({ name: 'Biology', description: null })

    // Save a mix of attempts:
    // Math attempt 1: 8/10 correct, 120s, practice
    await quizRepo.save({
      subjectId: sub1.id,
      topicId: null,
      subjectNameSnap: 'Mathematics',
      topicNameSnap: null,
      mode: 'practice',
      startedAt: 1000,
      answers: Array.from({ length: 10 }).map((_, i) => ({
        questionId: i + 1,
        selectedOptionIndex: i < 8 ? 0 : 1,
        timeTakenSeconds: 12,
        questionSnapshot: {
          questionText: 'Q',
          options: ['A', 'B'],
          correctOptionIndex: 0,
          explanation: null,
          difficulty: 'medium'
        }
      }))
    })

    // Math attempt 2: 9/10 correct, 60s, exam
    await quizRepo.save({
      subjectId: sub1.id,
      topicId: null,
      subjectNameSnap: 'Mathematics',
      topicNameSnap: null,
      mode: 'exam',
      startedAt: 2000,
      answers: Array.from({ length: 10 }).map((_, i) => ({
        questionId: i + 11,
        selectedOptionIndex: i < 9 ? 0 : 1,
        timeTakenSeconds: 6,
        questionSnapshot: {
          questionText: 'Q',
          options: ['A', 'B'],
          correctOptionIndex: 0,
          explanation: null,
          difficulty: 'medium'
        }
      }))
    })

    // Biology attempt: 2/5 correct, 100s, practice
    await quizRepo.save({
      subjectId: sub2.id,
      topicId: null,
      subjectNameSnap: 'Biology',
      topicNameSnap: null,
      mode: 'practice',
      startedAt: 3000,
      answers: Array.from({ length: 5 }).map((_, i) => ({
        questionId: i + 21,
        selectedOptionIndex: i < 2 ? 0 : 1,
        timeTakenSeconds: 20,
        questionSnapshot: {
          questionText: 'Q',
          options: ['A', 'B'],
          correctOptionIndex: 0,
          explanation: null,
          difficulty: 'medium'
        }
      }))
    })

    // Delete Biology subject to confirm snapshot handling
    await subjectRepo.delete(sub2.id)

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.queryByText(/Loading dashboard metrics/i)).not.toBeInTheDocument()
    })

    // Completed Quizzes: 3
    expect(screen.getByText('Completed Quizzes').nextElementSibling).toHaveTextContent('3')

    // Overall Accuracy: (8+9+2) / (10+10+5) = 19 / 25 = 76%
    expect(screen.getByText('Overall Accuracy').nextElementSibling).toHaveTextContent('76%')
    expect(screen.getByText('19 / 25 Questions Included')).toBeInTheDocument()

    // Total Questions Included: 25
    expect(screen.getByText('Total Questions Included').nextElementSibling).toHaveTextContent('25')

    // Total Time: 120s + 60s + 100s = 280s = 4m 40s -> formatted as "4m" (floor or round minutes)
    expect(screen.getByText('Total Time Spent').nextElementSibling).toHaveTextContent('4m')

    // Subject Proficiency Cards
    // Math: 17/20 = 85% (active)
    expect(screen.getAllByText('Mathematics')[0]).toBeInTheDocument()
    expect(screen.getByText('85%')).toBeInTheDocument()

    // Biology was deleted, so it groups under "Deleted or unavailable subjects" with 40% (2/5)
    expect(screen.getAllByText('Deleted or unavailable subjects')[0]).toBeInTheDocument()
    expect(screen.getByText('40%')).toBeInTheDocument()
    const proficiencySection = screen.getByText('Subject Proficiency').closest('div')!
    expect(within(proficiencySection).queryByText('Biology')).not.toBeInTheDocument()

    // Modes Breakdown
    // Practice completions: 2 (Math 1, Bio). Accuracy: (8+2) / 15 = 10/15 = 67%
    expect(screen.getByText(/2 completions/i)).toBeInTheDocument()
    expect(screen.getByText('67%')).toBeInTheDocument()

    // Exam completions: 1 (Math 2). Accuracy: 9/10 = 90%
    expect(screen.getByText(/1 completions/i)).toBeInTheDocument()
    expect(screen.getByText('90%')).toBeInTheDocument()
  })

  it('limits recent attempts list to 5 items sorted descending', async () => {
    const sub = await subjectRepo.create({ name: 'Subject', description: null })

    // Save 6 attempts
    for (let i = 0; i < 6; i++) {
      await quizRepo.save({
        subjectId: sub.id,
        topicId: null,
        subjectNameSnap: `Subject Attempt ${i}`,
        topicNameSnap: null,
        mode: 'practice',
        startedAt: 1000 + i * 1000,
        answers: [mockAnswer]
      })
    }

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.queryByText(/Loading dashboard metrics/i)).not.toBeInTheDocument()
    })

    // Recent attempts list should display exactly 5 attempts
    expect(screen.getAllByText('Subject Attempt 5')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Subject Attempt 4')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Subject Attempt 3')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Subject Attempt 2')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Subject Attempt 1')[0]).toBeInTheDocument()
    expect(screen.queryByText('Subject Attempt 0')).not.toBeInTheDocument()
  })
})
