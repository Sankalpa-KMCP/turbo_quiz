import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { db } from '../../db/database'
import AppLayout from '../../components/layout/AppLayout'
import Dashboard from '../Dashboard'
import SubjectsPage from '../SubjectsPage'
import SubjectDetailPage from '../SubjectDetailPage'
import QuestionsPage from '../QuestionsPage'
import QuestionFormPage from '../QuestionFormPage'
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
          { path: 'subjects', element: <SubjectsPage /> },
          { path: 'subjects/:subjectId', element: <SubjectDetailPage /> },
          { path: 'questions', element: <QuestionsPage /> },
          { path: 'questions/new', element: <QuestionFormPage /> },
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

describe('History and Dashboard Integration', () => {
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

  it('flows from completing a quiz to history dashboard and results view', async () => {
    // 1. Direct Repository-based database seeding (bypasses slow UI-based creation)
    const sub = await subjectRepo.create({ name: 'Biology', description: null })
    const topic = await topicRepo.create({ subjectId: sub.id, name: 'Cells' })
    await questionRepo.create({
      subjectId: sub.id,
      topicId: topic.id,
      questionText: 'Powerhouse?',
      options: ['Mito', 'Ribosome', 'Vacuole', 'Nucleus'],
      correctOptionIndex: 0,
      explanation: null,
      difficulty: 'medium'
    })
    await questionRepo.create({
      subjectId: sub.id,
      topicId: topic.id,
      questionText: 'Brain?',
      options: ['Nucleus', 'Cytoplasm', 'Membrane', 'Wall'],
      correctOptionIndex: 0,
      explanation: null,
      difficulty: 'medium'
    })

    const router = createTestRouter('/quiz/setup')
    render(<RouterProvider router={router} />)

    // 2. Start and Complete Quiz
    act(() => {
      router.navigate('/quiz/setup')
    })
    await waitFor(() => expect(router.state.location.pathname).toBe('/quiz/setup'))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Configure Quiz' })).toBeInTheDocument())

    // Wait for subjects to load in the select
    await waitFor(() => {
      expect(screen.getByText('Biology')).toBeInTheDocument()
    })

    const quizSubSelect = screen.getByLabelText(/^Subject/)
    fireEvent.change(quizSubSelect, { target: { value: String(sub.id) } })
    await waitFor(() => expect(screen.getByText(/Available questions:/)).toHaveTextContent('2'))

    const startButton = screen.getByRole('button', { name: /Start Quiz/i })
    fireEvent.click(startButton)

    // Wait strictly for the store to transition to playing phase (indicates DB query finished)
    await waitFor(() => expect(useQuizSessionStore.getState().phase).toBe('playing'))

    const sessionQuestions = useQuizSessionStore.getState().questions
    const q1Text = sessionQuestions[0].questionSnapshot.questionText
    const q1CorrectOption = sessionQuestions[0].questionSnapshot.options[sessionQuestions[0].questionSnapshot.correctOptionIndex]

    const q2Text = sessionQuestions[1].questionSnapshot.questionText
    const q2IncorrectOption = sessionQuestions[1].questionSnapshot.options[(sessionQuestions[1].questionSnapshot.correctOptionIndex + 1) % 4]

    // Verify navigating to play page
    await waitFor(() => {
      expect(screen.getByText(q1Text)).toBeInTheDocument()
    })

    // Answer Q1 correctly
    fireEvent.click(screen.getByText(q1CorrectOption))

    // Go to next question
    fireEvent.click(screen.getByRole('button', { name: /Next/i }))

    // Wait for Q2 to render
    await waitFor(() => {
      expect(screen.getByText(q2Text)).toBeInTheDocument()
    })

    // Answer Q2 incorrectly
    fireEvent.click(screen.getByText(q2IncorrectOption))

    // Complete quiz
    fireEvent.click(screen.getByRole('button', { name: /Finish Quiz/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Submit Answers/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Submit Answers/i }))

    // Wait strictly for the store to transition to completed phase (indicates DB save finished)
    await waitFor(() => expect(useQuizSessionStore.getState().phase).toBe('completed'))

    // Verify navigating to results
    await waitFor(() => {
      expect(screen.getByText(/Score/i)).toBeInTheDocument()
      expect(screen.getByText('50%')).toBeInTheDocument()
    })

    // 3. Navigate to History
    act(() => {
      router.navigate('/history')
    })
    await waitFor(() => expect(router.state.location.pathname).toBe('/history'))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Quiz History' })).toBeInTheDocument()
    })

    // Confirm historical item exists in the list
    expect(screen.getAllByText('Biology')[0]).toBeInTheDocument()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()

    // 4. Navigate to Dashboard
    act(() => {
      router.navigate('/')
    })
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    })

    // Confirm aggregated counts on Dashboard
    expect(screen.getByText('Completed Quizzes').nextElementSibling).toHaveTextContent('1')
    expect(screen.getByText('Overall Accuracy').nextElementSibling).toHaveTextContent('50%')
    expect(screen.getByText('Total Questions Included').nextElementSibling).toHaveTextContent('2')

    // Confirm recent attempts displays this attempt
    expect(screen.getAllByText('Biology')[0]).toBeInTheDocument()
    expect(screen.getByText('50% Score')).toBeInTheDocument()
  })
})
