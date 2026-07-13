import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import MistakesPage from '../MistakesPage'
import { useQuizSessionStore } from '../../stores/quizSessionStore'

// Mock the repositories
const { mockGetMistakeProjections, mockSubjectGetAll, mockTopicGetAll } = vi.hoisted(() => ({
  mockGetMistakeProjections: vi.fn(),
  mockSubjectGetAll: vi.fn(),
  mockTopicGetAll: vi.fn()
}))

vi.mock('../../db/repositories/QuizRepository', () => ({
  QuizRepository: class {
    getMistakeProjections = mockGetMistakeProjections
  }
}))

vi.mock('../../db/repositories/SubjectRepository', () => ({
  SubjectRepository: class {
    getAll = mockSubjectGetAll
  }
}))

vi.mock('../../db/repositories/TopicRepository', () => ({
  TopicRepository: class {
    getAll = mockTopicGetAll
  }
}))

// Mock useQuizSessionStore
vi.mock('../../stores/quizSessionStore', () => ({
  useQuizSessionStore: vi.fn()
}))

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual as Record<string, unknown>,
    useNavigate: () => mockNavigate
  }
})

describe('MistakesPage', () => {
  let mockConfigureSetup: unknown
  let mockStartSession: unknown

  beforeEach(() => {
    vi.clearAllMocks()

    mockConfigureSetup = vi.fn()
    mockStartSession = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useQuizSessionStore).mockImplementation((selector: unknown) => {
      const state = { configureSetup: mockConfigureSetup, startSession: mockStartSession }
      return (selector as (state: unknown) => unknown)(state)
    })
  })

  it('renders empty state when no mistakes', async () => {
    mockGetMistakeProjections.mockResolvedValue([])
    mockSubjectGetAll.mockResolvedValue([])
    mockTopicGetAll.mockResolvedValue([])

    render(
      <MemoryRouter>
        <MistakesPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/No Active Mistakes/i)).toBeInTheDocument()
    })
  })

  it('renders grouped mistakes and handles Retry Group', async () => {
    mockSubjectGetAll.mockResolvedValue([{ id: 1, name: 'Math', normalizedName: 'math', description: null, createdAt: 1, updatedAt: 1 }])
    mockTopicGetAll.mockResolvedValue([{ id: 10, subjectId: 1, name: 'Algebra', normalizedName: 'algebra', createdAt: 1 }])

    mockGetMistakeProjections.mockResolvedValue([
      {
        parentAttempt: { subjectId: 1, topicId: 10, subjectNameSnap: 'Math', topicNameSnap: 'Algebra' },
        answerAttempt: { questionId: 100 }
      },
      {
        parentAttempt: { subjectId: 1, topicId: null, subjectNameSnap: 'Math', topicNameSnap: null },
        answerAttempt: { questionId: 101 }
      }
    ])

    render(
      <MemoryRouter>
        <MistakesPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/2 Active Mistakes/i)).toBeInTheDocument()
    })

    // Expect groups
    expect(screen.getAllByText('Math')).toHaveLength(2)
    expect(screen.getByText('Algebra')).toBeInTheDocument()
    expect(screen.getByText('Mixed / No Topic')).toBeInTheDocument()

    // Retry specific group (Math / Algebra)
    const retryButtons = screen.getAllByRole('button', { name: /Retry Group/i })
    fireEvent.click(retryButtons[1]) // Second group is Math / Algebra because null topics sort first

    await waitFor(() => {
      expect(mockConfigureSetup).toHaveBeenCalledWith({
        subjectId: 1,
        topicId: 10,
        mode: 'mistakes',
        questionCount: 'all',
        retryQuestionIds: [100]
      })
      expect(mockStartSession).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/quiz/play')
    })
  })

  it('renders Retry All button when only one subject exists', async () => {
    mockSubjectGetAll.mockResolvedValue([{ id: 1, name: 'Math', normalizedName: 'math', description: null, createdAt: 1, updatedAt: 1 }])
    mockTopicGetAll.mockResolvedValue([])

    mockGetMistakeProjections.mockResolvedValue([
      {
        parentAttempt: { subjectId: 1, topicId: 10, subjectNameSnap: 'Math', topicNameSnap: 'Algebra' },
        answerAttempt: { questionId: 100 }
      },
      {
        parentAttempt: { subjectId: 1, topicId: null, subjectNameSnap: 'Math', topicNameSnap: null },
        answerAttempt: { questionId: 101 }
      }
    ])

    render(
      <MemoryRouter>
        <MistakesPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Retry All 2/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Retry All 2/i }))

    await waitFor(() => {
      expect(mockConfigureSetup).toHaveBeenCalledWith({
        subjectId: 1,
        topicId: null,
        mode: 'mistakes',
        questionCount: 'all',
        retryQuestionIds: [101, 100] // Mixed topic sorts first due to topicName === null
      })
      expect(mockStartSession).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/quiz/play')
    })
  })

  it('does not render Retry All button when multiple subjects exist', async () => {
    mockSubjectGetAll.mockResolvedValue([])
    mockTopicGetAll.mockResolvedValue([])

    mockGetMistakeProjections.mockResolvedValue([
      {
        parentAttempt: { subjectId: 1, topicId: null, subjectNameSnap: 'Math', topicNameSnap: null },
        answerAttempt: { questionId: 100 }
      },
      {
        parentAttempt: { subjectId: 2, topicId: null, subjectNameSnap: 'Bio', topicNameSnap: null },
        answerAttempt: { questionId: 200 }
      }
    ])

    render(
      <MemoryRouter>
        <MistakesPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/2 Active Mistakes/i)).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: /Retry All/i })).not.toBeInTheDocument()
  })
})
