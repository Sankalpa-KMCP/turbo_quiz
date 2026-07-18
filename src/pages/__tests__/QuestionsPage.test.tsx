import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { db } from '../../db/database'
import { SubjectRepository } from '../../db/repositories/SubjectRepository'
import { TopicRepository } from '../../db/repositories/TopicRepository'
import { QuestionRepository } from '../../db/repositories/QuestionRepository'
import QuestionsPage from '../QuestionsPage'

const subjectRepo = new SubjectRepository(db)
const topicRepo = new TopicRepository(db)
const questionRepo = new QuestionRepository(db)

const renderWithRouter = (initialUrl: string) => {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route path="/questions" element={<QuestionsPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('QuestionsPage', () => {
  beforeEach(async () => {
    await db.subjects.clear()
    await db.topics.clear()
    await db.questions.clear()
  })

  afterEach(async () => {
    await db.subjects.clear()
    await db.topics.clear()
    await db.questions.clear()
  })

  it('shows a loading state while subjects load without subjectId', async () => {
    renderWithRouter('/questions')
    expect(screen.getByText(/Loading subjects/i)).toBeInTheDocument()
  })

  it('guides users to create a subject when the library is empty', async () => {
    renderWithRouter('/questions')
    await waitFor(() => {
      expect(screen.getByText('Create a subject first')).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: /Create your first subject/i })).toHaveAttribute('href', '/subjects')
  })

  it('offers an inline subject picker when subjects exist and subjectId is missing', async () => {
    const biology = await subjectRepo.create({ name: 'Biology', description: null })
    const history = await subjectRepo.create({ name: 'History', description: null })

    renderWithRouter('/questions')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Select a subject/i })).toBeInTheDocument()
    })

    expect(screen.getByRole('link', { name: 'Biology' })).toHaveAttribute('href', `/questions?subjectId=${biology.id}`)
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('href', `/questions?subjectId=${history.id}`)
  })

  it('handles not found subject', async () => {
    renderWithRouter('/questions?subjectId=999')
    await waitFor(() => {
      expect(screen.getByText('Subject Not Found')).toBeInTheDocument()
    })
  })

  it('displays questions and applies text filter', async () => {
    const sub = await subjectRepo.create({ name: 'Mock', description: null })
    const topic = await topicRepo.create({ subjectId: sub.id, name: 'Rome' })

    await questionRepo.create({
      subjectId: sub.id,
      topicId: topic.id,
      questionText: 'Who was Caesar?',
      options: ['A', 'B'],
      correctOptionIndex: 0,
      difficulty: 'easy',
      explanation: null
    })

    await questionRepo.create({
      subjectId: sub.id,
      topicId: topic.id,
      questionText: 'When did Rome fall?',
      options: ['A', 'B'],
      correctOptionIndex: 0,
      difficulty: 'easy',
      explanation: null
    })

    renderWithRouter(`/questions?subjectId=${sub.id}`)

    await waitFor(() => {
      expect(screen.getByText('Who was Caesar?')).toBeInTheDocument()
      expect(screen.getByText('When did Rome fall?')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/Search questions/i)
    fireEvent.change(searchInput, { target: { value: 'Caesar' } })

    // Wait for debounce and re-render
    await waitFor(() => {
      expect(screen.getByText('Who was Caesar?')).toBeInTheDocument()
      expect(screen.queryByText('When did Rome fall?')).not.toBeInTheDocument()
    })
  })

  it('filters by topic and difficulty', async () => {
    const sub = await subjectRepo.create({ name: 'Mock', description: null })
    const topic1 = await topicRepo.create({ subjectId: sub.id, name: 'Biology' })
    const topic2 = await topicRepo.create({ subjectId: sub.id, name: 'Chemistry' })

    await questionRepo.create({
      subjectId: sub.id,
      topicId: topic1.id,
      questionText: 'Bio Easy',
      options: ['A', 'B'],
      correctOptionIndex: 0,
      difficulty: 'easy',
      explanation: null
    })

    await questionRepo.create({
      subjectId: sub.id,
      topicId: topic2.id,
      questionText: 'Chem Hard',
      options: ['A', 'B'],
      correctOptionIndex: 0,
      difficulty: 'easy',
      explanation: null
    })

    renderWithRouter(`/questions?subjectId=${sub.id}`)

    await waitFor(() => {
      expect(screen.getByText('Bio Easy')).toBeInTheDocument()
      expect(screen.getByText('Chem Hard')).toBeInTheDocument()
    })

    const topicSelect = screen.getByLabelText('Topic')
    fireEvent.change(topicSelect, { target: { value: topic1.id.toString() } })

    await waitFor(() => {
      expect(screen.getByText('Bio Easy')).toBeInTheDocument()
      expect(screen.queryByText('Chem Hard')).not.toBeInTheDocument()
    })

    const difficultySelect = screen.getByLabelText('Difficulty')
    fireEvent.change(difficultySelect, { target: { value: 'hard' } })

    // With topic=Biology and diff=Hard, there should be none
    await waitFor(() => {
      expect(screen.queryByText('Bio Easy')).not.toBeInTheDocument()
      expect(screen.getByText('No questions match your filters.')).toBeInTheDocument()
    })
  })

  it('toggles bookmarks', async () => {
    const sub = await subjectRepo.create({ name: 'Mock', description: null })
    const q1 = await questionRepo.create({
      subjectId: sub.id,
      topicId: null,
      questionText: 'Is 1+1=2?',
      options: ['Yes', 'No'],
      correctOptionIndex: 0,
      difficulty: 'easy',
      explanation: null
    })

    renderWithRouter(`/questions?subjectId=${sub.id}`)

    await waitFor(() => {
      expect(screen.getByText('Is 1+1=2?')).toBeInTheDocument()
    })

    const bookmarkBtn = screen.getByRole('button', { name: /Bookmark/i })
    fireEvent.click(bookmarkBtn)

    await waitFor(async () => {
      const updated = await questionRepo.getById(q1.id)
      expect(updated?.bookmarkStatus).toBe(1)
    })
  })
})
