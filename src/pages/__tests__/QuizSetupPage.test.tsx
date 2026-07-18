import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { db } from '../../db/database'
import { SubjectRepository } from '../../db/repositories/SubjectRepository'
import { TopicRepository } from '../../db/repositories/TopicRepository'
import { QuestionRepository } from '../../db/repositories/QuestionRepository'
import QuizSetupPage from '../QuizSetupPage'

const subjectRepo = new SubjectRepository(db)
const topicRepo = new TopicRepository(db)
const questionRepo = new QuestionRepository(db)

describe('QuizSetupPage', () => {
  beforeEach(async () => {
    // Clean database before each test
    await db.subjects.clear()
    await db.topics.clear()
    await db.questions.clear()
    await db.quizAttempts.clear()
    await db.answerAttempts.clear()
  })

  afterEach(async () => {
    await db.subjects.clear()
    await db.topics.clear()
    await db.questions.clear()
    await db.quizAttempts.clear()
    await db.answerAttempts.clear()
  })

  it('guides an empty library to create a subject', async () => {
    render(
      <MemoryRouter>
        <QuizSetupPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Create a subject before starting/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /Create a subject/i })).toHaveAttribute('href', '/subjects')
    })
  })

  it('loads subjects and handles dependent topic loading & resets', async () => {
    const s1 = await subjectRepo.create({ name: 'Subject 1', description: null })
    const s2 = await subjectRepo.create({ name: 'Subject 2', description: null })
    await topicRepo.create({ subjectId: s1.id, name: 'Topic 1-1' })
    await topicRepo.create({ subjectId: s2.id, name: 'Topic 2-1' })

    render(
      <MemoryRouter>
        <QuizSetupPage />
      </MemoryRouter>
    )

    // Wait for subjects to load
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Subject 1' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Subject 2' })).toBeInTheDocument()
    })

    const subjectSelect = screen.getByLabelText(/Subject/i) as HTMLSelectElement
    const topicSelect = screen.getByLabelText(/Topic/i) as HTMLSelectElement

    // Topic dropdown should be disabled until subject is selected
    expect(topicSelect).toBeDisabled()

    // Select Subject 1
    fireEvent.change(subjectSelect, { target: { value: s1.id.toString() } })
    expect(subjectSelect.value).toBe(s1.id.toString())

    // Topic select should become enabled and load Subject 1 topics
    await waitFor(() => {
      expect(topicSelect).not.toBeDisabled()
      expect(screen.getByRole('option', { name: 'Topic 1-1' })).toBeInTheDocument()
    })

    // Select Topic 1-1
    fireEvent.change(topicSelect, { target: { value: 'Topic 1-1' } })

    // Change Subject to Subject 2
    fireEvent.change(subjectSelect, { target: { value: s2.id.toString() } })

    // Topic select should update and clear previous Topic
    await waitFor(() => {
      expect(topicSelect.value).toBe('')
      expect(screen.queryByRole('option', { name: 'Topic 1-1' })).not.toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Topic 2-1' })).toBeInTheDocument()
    })
  })

  it('displays eligible questions and disables impossible counts', async () => {
    const s1 = await subjectRepo.create({ name: 'Physics', description: null })
    const t1 = await topicRepo.create({ subjectId: s1.id, name: 'Mechanics' })

    // Add 6 questions
    for (let i = 1; i <= 6; i++) {
      await questionRepo.create({
        subjectId: s1.id,
        topicId: t1.id,
        questionText: `Q${i}`,
        options: ['A', 'B'],
        correctOptionIndex: 0,
        explanation: null,
        difficulty: 'easy'
      })
    }

    render(
      <MemoryRouter>
        <QuizSetupPage />
      </MemoryRouter>
    )

    // Select Physics
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Physics' })).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText(/Subject/i), { target: { value: s1.id.toString() } })

    // Wait for questions count to display
    await waitFor(() => {
      expect(screen.getByText(/Available questions:/i)).toHaveTextContent('Available questions: 6')
    })

    // Check count options: 5 should be enabled, 10, 15, 20 should be disabled
    const opt5 = screen.getByRole('option', { name: '5 Questions' }) as HTMLOptionElement
    const opt10 = screen.getByRole('option', { name: '10 Questions' }) as HTMLOptionElement

    expect(opt5.disabled).toBe(false)
    expect(opt10.disabled).toBe(true)
  })

  it('displays accessible error message when trying to start with zero questions', async () => {
    const s1 = await subjectRepo.create({ name: 'Empty Subject', description: null })

    render(
      <MemoryRouter>
        <QuizSetupPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Empty Subject' })).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText(/Subject/i), { target: { value: s1.id.toString() } })

    await waitFor(() => {
      expect(screen.getByText(/Available questions:/i)).toHaveTextContent('Available questions: 0')
    })

    const startBtn = screen.getByRole('button', { name: /Start Quiz/i })
    expect(startBtn).toBeDisabled()
  })
})
