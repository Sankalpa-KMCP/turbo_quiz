import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { db } from '../../db/database'
import AppLayout from '../../components/layout/AppLayout'
import SubjectsPage from '../SubjectsPage'
import SubjectDetailPage from '../SubjectDetailPage'
import QuestionsPage from '../QuestionsPage'
import QuestionFormPage from '../QuestionFormPage'
import QuizSetupPage from '../QuizSetupPage'
import QuizPlayPage from '../QuizPlayPage'
import { useQuizSessionStore } from '../../stores/quizSessionStore'


const createTestRouter = (initialUrl: string) => {
  return createMemoryRouter(
    [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          { path: 'subjects', element: <SubjectsPage /> },
          { path: 'subjects/:subjectId', element: <SubjectDetailPage /> },
          { path: 'questions', element: <QuestionsPage /> },
          { path: 'questions/new', element: <QuestionFormPage /> },
          { path: 'quiz/setup', element: <QuizSetupPage /> },
          { path: 'quiz/play', element: <QuizPlayPage /> }
        ]
      }
    ],
    { initialEntries: [initialUrl] }
  )
}

describe('Content Integration (E2E Authoring)', () => {
  beforeEach(async () => {
    await db.subjects.clear()
    await db.topics.clear()
    await db.questions.clear()
    useQuizSessionStore.getState().resetSession()
  })

  afterEach(async () => {
    await db.subjects.clear()
    await db.topics.clear()
    await db.questions.clear()
    useQuizSessionStore.getState().resetSession()
  })

  it('allows user to create subject, topic, questions and start quiz', async () => {
    // 1. Visit Subjects Page
    const router = createTestRouter('/subjects')
    render(<RouterProvider router={router} />)

    // Create a Subject
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Subjects' })).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Mathematics/i), {
      target: { value: 'Biology' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create Subject' }))

    await waitFor(() => {
      expect(screen.getByText('Biology')).toBeInTheDocument()
    })

    // Navigate to Subject Detail
    fireEvent.click(screen.getByText('Biology'))

    // 2. Subject Detail Page - Create a Topic
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Biology' })).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Algebra/i), {
      target: { value: 'Cell Structure' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create Topic' }))

    await waitFor(() => {
      expect(screen.getByText('Cell Structure')).toBeInTheDocument()
    })

    // Click "Manage Questions" for the Subject
    fireEvent.click(screen.getByRole('link', { name: /View All Questions/i }))

    // 3. Questions Page
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Questions Bank' })).toBeInTheDocument()
    })

    // Click "Add Question"
    fireEvent.click(screen.getByRole('link', { name: /\+ Create Question/i }))

    // 4. Question Form Page - Categorized Question
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Create Question' })).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/Question Text/i), {
      target: { value: 'What is the powerhouse of the cell?' }
    })

    // Choose the newly created topic manually
    const topicSelect = screen.getByLabelText(/Topic/i)
    fireEvent.change(topicSelect, {
      target: { value: screen.getByText('Cell Structure').closest('option')?.value }
    })

    const options = screen.getAllByPlaceholderText(/Option \d/)
    fireEvent.change(options[0], { target: { value: 'Nucleus' } })
    fireEvent.change(options[1], { target: { value: 'Mitochondria' } })

    const optionRadios = screen.getAllByTitle('Mark as correct answer')
    fireEvent.click(optionRadios[1])

    fireEvent.click(screen.getByRole('button', { name: 'Create Question' }))

    // 5. Back to Questions Page
    await waitFor(() => {
      expect(screen.getByText('What is the powerhouse of the cell?')).toBeInTheDocument()
    })

    // 6. Create an Uncategorized Question
    fireEvent.click(screen.getByRole('link', { name: /\+ Create Question/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Create Question' })).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/Question Text/i), {
      target: { value: 'Is Biology a science?' }
    })

    const topicSelect2 = screen.getByLabelText(/Topic/i)
    // Select Uncategorized
    fireEvent.change(topicSelect2, {
      target: { value: 'null' }
    })

    const options2 = screen.getAllByPlaceholderText(/Option \d/)
    fireEvent.change(options2[0], { target: { value: 'Yes' } })
    fireEvent.change(options2[1], { target: { value: 'No' } })

    const radios2 = screen.getAllByTitle('Mark as correct answer')
    fireEvent.click(radios2[0])

    fireEvent.click(screen.getByRole('button', { name: 'Create Question' }))

    await waitFor(() => {
      expect(screen.getByText('Is Biology a science?')).toBeInTheDocument()
    })

    // 7. Verify reads from repository
    const questionsInDb = await db.questions.toArray()
    expect(questionsInDb).toHaveLength(2)
    const categorized = questionsInDb.find(q => q.topicId !== null)
    const uncategorized = questionsInDb.find(q => q.topicId === null)
    expect(categorized).toBeDefined()
    expect(uncategorized).toBeDefined()

    // 8. Render QuizSetupPage (we can navigate directly)
    act(() => {
      router.navigate('/quiz/setup')
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Configure Quiz' })).toBeInTheDocument()
    })

    // Wait for subjects to load in the select
    await waitFor(() => {
      expect(screen.getByText('Biology')).toBeInTheDocument()
    })

    const quizSubjectSelect = screen.getByLabelText(/Subject \*/i)
    fireEvent.change(quizSubjectSelect, { target: { value: screen.getByText('Biology').closest('option')?.value } })

    // Wait for "Available questions: 2" to indicate 2 questions total
    await waitFor(() => {
      expect(screen.getByText(/Available questions:/)).toHaveTextContent('2')
    })

    // Now select the specific topic (Cell Structure)
    const quizTopicSelect = screen.getByLabelText(/Topic/i)
    fireEvent.change(quizTopicSelect, {
      target: { value: screen.getByText('Cell Structure').closest('option')?.value }
    })

    // Now the eligible count should be 1
    await waitFor(() => {
      expect(screen.getByText(/Available questions:/)).toHaveTextContent('1')
    })

    // Let's select All Topics again to test the whole flow with both questions
    fireEvent.change(quizTopicSelect, {
      target: { value: '' } // All Topics has value ""
    })

    await waitFor(() => {
      expect(screen.getByText(/Available questions:/)).toHaveTextContent('2')
    })

    // Wait for start button to be enabled
    const startButton = screen.getByRole('button', { name: /Start Quiz/i })
    expect(startButton).not.toBeDisabled()

    // 9. Start Quiz
    fireEvent.click(startButton)

    // 10. Assert navigation to /quiz/play
    await waitFor(() => {
      // The session phase should be 'playing'
      expect(useQuizSessionStore.getState().phase).toBe('playing')
    })

    // Assert active session snapshots contain authored Question text
    const sessionConfig = useQuizSessionStore.getState().setupConfig
    const sessionQuestions = useQuizSessionStore.getState().questions
    expect(sessionConfig).not.toBeNull()
    expect(sessionQuestions).toHaveLength(2)

    const snapshotTexts = sessionQuestions.map(q => q.questionSnapshot.questionText)
    expect(snapshotTexts).toContain('What is the powerhouse of the cell?')
    expect(snapshotTexts).toContain('Is Biology a science?')
  })
})
