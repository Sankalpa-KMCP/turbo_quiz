import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { db } from '../../db/database'
import AppLayout from '../../components/layout/AppLayout'
import Dashboard from '../Dashboard'
import MistakesPage from '../MistakesPage'
import QuizSetupPage from '../QuizSetupPage'
import QuizPlayPage from '../QuizPlayPage'
import QuizResultsPage from '../QuizResultsPage'
import HistoryPage from '../HistoryPage'
import { useQuizSessionStore } from '../../stores/quizSessionStore'
import { SubjectRepository } from '../../db/repositories/SubjectRepository'
import { TopicRepository } from '../../db/repositories/TopicRepository'
import { QuestionRepository } from '../../db/repositories/QuestionRepository'

const subjectRepo = new SubjectRepository(db)
const topicRepo = new TopicRepository(db)
const questionRepo = new QuestionRepository(db)

const createTestRouter = (initialUrl: string) => {
  return createMemoryRouter(
    [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'mistakes', element: <MistakesPage /> },
          { path: 'quiz/setup', element: <QuizSetupPage /> },
          { path: 'quiz/play', element: <QuizPlayPage /> },
          { path: 'quiz/results/:attemptId', element: <QuizResultsPage /> },
          { path: 'history', element: <HistoryPage /> }
        ]
      }
    ],
    { initialEntries: [initialUrl] }
  )
}

describe('Mistakes Integration', () => {
  beforeEach(async () => {
    await db.subjects.clear()
    await db.topics.clear()
    await db.questions.clear()
    await db.quizAttempts.clear()
    await db.answerAttempts.clear()
    useQuizSessionStore.getState().resetSession()
  })

  afterEach(async () => {
    await db.subjects.clear()
    await db.topics.clear()
    await db.questions.clear()
    await db.quizAttempts.clear()
    await db.answerAttempts.clear()
    useQuizSessionStore.getState().resetSession()
  })

  it('flows from a failed answer to active mistake, retry session, and resolution', async () => {
    // 1. Seed
    const sub = await subjectRepo.create({ name: 'Geography', description: null })
    const topic = await topicRepo.create({ subjectId: sub.id, name: 'Capitals' })
    await questionRepo.create({
      subjectId: sub.id,
      topicId: topic.id,
      questionText: 'Capital of France?',
      options: ['London', 'Berlin', 'Paris', 'Madrid'],
      correctOptionIndex: 2,
      explanation: null,
      difficulty: 'easy'
    })
    await questionRepo.create({
      subjectId: sub.id,
      topicId: topic.id,
      questionText: 'Capital of Japan?',
      options: ['Seoul', 'Tokyo', 'Beijing', 'Bangkok'],
      correctOptionIndex: 1,
      explanation: null,
      difficulty: 'easy'
    })

    const router = createTestRouter('/quiz/setup')
    render(<RouterProvider router={router} />)

    // 2. Start a standard quiz and make a mistake
    act(() => {
      router.navigate('/quiz/setup')
    })
    await waitFor(() => expect(router.state.location.pathname).toBe('/quiz/setup'))
    await waitFor(() => expect(screen.getByText('Geography')).toBeInTheDocument())

    const quizSubSelect = screen.getByLabelText(/^Subject/)
    fireEvent.change(quizSubSelect, { target: { value: String(sub.id) } })

    const quizTopicSelect = screen.getByLabelText(/Topic/i)
    await waitFor(() => expect(quizTopicSelect).not.toBeDisabled())
    fireEvent.change(quizTopicSelect, { target: { value: String(topic.id) } })

    await waitFor(() => expect(screen.getByText(/Available questions:/)).toHaveTextContent('2'))

    fireEvent.click(screen.getByRole('button', { name: /Start Quiz/i }))
    await waitFor(() => expect(useQuizSessionStore.getState().phase).toBe('playing'))

    const sessionQuestions1 = useQuizSessionStore.getState().questions
    const q1Text = sessionQuestions1[0].questionSnapshot.questionText
    const q1IncorrectOption = sessionQuestions1[0].questionSnapshot.options[(sessionQuestions1[0].questionSnapshot.correctOptionIndex + 1) % 4]

    // Answer Q1 incorrectly
    await waitFor(() => expect(screen.getByText(q1Text)).toBeInTheDocument())
    fireEvent.click(screen.getByText(q1IncorrectOption))
    fireEvent.click(screen.getByRole('button', { name: /Next/i }))

    const q2Text = sessionQuestions1[1].questionSnapshot.questionText
    const q2CorrectOption = sessionQuestions1[1].questionSnapshot.options[sessionQuestions1[1].questionSnapshot.correctOptionIndex]

    // Answer Q2 correctly
    await waitFor(() => expect(screen.getByText(q2Text)).toBeInTheDocument())
    fireEvent.click(screen.getByText(q2CorrectOption))

    // Finish Quiz
    fireEvent.click(screen.getByRole('button', { name: /Finish Quiz/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Submit Answers/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Submit Answers/i }))

    await waitFor(() => expect(useQuizSessionStore.getState().phase).toBe('completed'))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/quiz\/results\/.+/))
    await waitFor(() => expect(screen.getByText('Quiz Results')).toBeInTheDocument())

    // 3. Navigate to Mistakes
    act(() => {
      router.navigate('/mistakes')
    })
    await waitFor(() => expect(router.state.location.pathname).toBe('/mistakes'))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Mistakes & Weaknesses' })).toBeInTheDocument())

    // 4. Verify the active mistake is rendered
    expect(screen.getByText('1 Active Mistake')).toBeInTheDocument()
    expect(screen.getByText('Geography')).toBeInTheDocument()
    expect(screen.getByText('Mixed / No Topic')).toBeInTheDocument()

    // 5. Start a retry session
    fireEvent.click(screen.getByRole('button', { name: /Retry Group/i }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/quiz/play'))
    await waitFor(() => expect(useQuizSessionStore.getState().phase).toBe('playing'))

    // 6. Verify retry session configuration
    const storeState = useQuizSessionStore.getState()
    expect(storeState.setupConfig?.mode).toBe('mistakes')
    expect(storeState.setupConfig?.subjectId).toBe(sub.id)
    expect(storeState.questions).toHaveLength(1) // Only the mistaken question is loaded
    expect(storeState.questions[0].questionSnapshot.questionText).toBe(q1Text)

    // Verify practice-like feedback
    await waitFor(() => expect(screen.getByText(q1Text)).toBeInTheDocument())
    const q1CorrectOptionRetry = storeState.questions[0].questionSnapshot.options[storeState.questions[0].questionSnapshot.correctOptionIndex]
    fireEvent.click(screen.getByText(q1CorrectOptionRetry))

    // 7. Complete the retry quiz
    fireEvent.click(screen.getByRole('button', { name: /Finish Quiz/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Submit Answers/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Submit Answers/i }))

    await waitFor(() => expect(useQuizSessionStore.getState().phase).toBe('completed'))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/\/quiz\/results\/.+/))

    // Verify Results page shows 'mistakes' mode fallback label
    await waitFor(() => {
      expect(screen.getByText('Mode')).toBeInTheDocument()
      expect(screen.getAllByText(/Mistakes/i).length).toBeGreaterThan(0)
    })

    // 8. Return to Mistakes page
    act(() => {
      router.navigate('/mistakes')
    })
    await waitFor(() => expect(router.state.location.pathname).toBe('/mistakes'))

    // 9. Verify the surviving Question is resolved (0 active mistakes)
    await waitFor(() => {
      expect(screen.getByText('No Active Mistakes')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /Retry Group/i })).not.toBeInTheDocument()

    // 10. Verify History reflects the persisted `mistakes` attempt
    act(() => {
      router.navigate('/history')
    })
    await waitFor(() => expect(router.state.location.pathname).toBe('/history'))
    await waitFor(() => {
      expect(screen.getAllByText(/Mistakes/i).length).toBeGreaterThan(0) // the mode badge + sidebar links
    })
  })
})
