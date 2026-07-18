import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { db } from '../../db/database'
import { SubjectRepository } from '../../db/repositories/SubjectRepository'
import { TopicRepository } from '../../db/repositories/TopicRepository'
import { QuestionRepository } from '../../db/repositories/QuestionRepository'
import SubjectsPage from '../SubjectsPage'

const subjectRepo = new SubjectRepository(db)
const topicRepo = new TopicRepository(db)
const questionRepo = new QuestionRepository(db)

describe('SubjectsPage', () => {
  beforeEach(async () => {
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

  it('renders loading state then empty state', async () => {
    render(
      <MemoryRouter>
        <SubjectsPage />
      </MemoryRouter>
    )
    // Dexie react hooks might be so fast it skips loading in jsdom,
    // but empty state should appear.
    await waitFor(() => {
      expect(screen.getByText(/No subjects found/i)).toBeInTheDocument()
    })
  })

  it('allows creating a new subject', async () => {
    render(
      <MemoryRouter>
        <SubjectsPage />
      </MemoryRouter>
    )

    const input = screen.getByLabelText(/New Subject Name/i)
    const button = screen.getByRole('button', { name: /Create Subject/i })

    fireEvent.change(input, { target: { value: 'Mathematics' } })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText('Mathematics')).toBeInTheDocument()
    })

    const subjects = await subjectRepo.getAll()
    expect(subjects).toHaveLength(1)
    expect(subjects[0].name).toBe('Mathematics')
  })

  it('displays duplicate name errors', async () => {
    await subjectRepo.create({ name: 'Physics', description: null })

    render(
      <MemoryRouter>
        <SubjectsPage />
      </MemoryRouter>
    )

    const input = screen.getByLabelText(/New Subject Name/i)
    const button = screen.getByRole('button', { name: /Create Subject/i })

    fireEvent.change(input, { target: { value: 'Physics' } })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/already exists/i)
    })
  })

  it('allows renaming a subject', async () => {
    const sub = await subjectRepo.create({ name: 'Old Name', description: null })

    render(
      <MemoryRouter>
        <SubjectsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Old Name')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Edit/i }))

    const editInput = await screen.findByRole('textbox', { name: /^Subject Name/ })
    fireEvent.change(editInput, { target: { value: 'New Name' } })

    fireEvent.click(screen.getByRole('button', { name: /Save/i }))

    await waitFor(() => {
      expect(screen.getByText('New Name')).toBeInTheDocument()
      expect(screen.queryByText('Old Name')).not.toBeInTheDocument()
    })

    const updated = await subjectRepo.getById(sub.id)
    expect(updated?.name).toBe('New Name')
  })

  it('allows canceling a rename', async () => {
    await subjectRepo.create({ name: 'Unchanged', description: null })

    render(
      <MemoryRouter>
        <SubjectsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Unchanged')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Edit/i }))

    const editInput = await screen.findByRole('textbox', { name: /^Subject Name/ })
    fireEvent.change(editInput, { target: { value: 'Changed' } })

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))

    await waitFor(() => {
      expect(screen.getByText('Unchanged')).toBeInTheDocument()
      expect(screen.queryByText('Changed')).not.toBeInTheDocument()
    })
  })

  it('shows exact deletion warning and processes deletion', async () => {
    const sub = await subjectRepo.create({ name: 'To Delete', description: null })
    const topic = await topicRepo.create({ subjectId: sub.id, name: 'Topic 1' })
    await questionRepo.create({
      subjectId: sub.id,
      topicId: topic.id,
      questionText: 'Q1',
      options: ['A', 'B'],
      correctOptionIndex: 0,
      difficulty: 'easy',
      explanation: null
    })

    render(
      <MemoryRouter>
        <SubjectsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('To Delete')).toBeInTheDocument()
      // Counts should be 1 topic, 1 question
      expect(screen.getByText(/1 Topics/i)).toBeInTheDocument()
      expect(screen.getByText(/1 Questions/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Delete/i }))

    // Deletion warning should appear
    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to delete this subject\?/i)).toBeInTheDocument()
      expect(screen.getByText(/1 topic\(s\) and 1 question\(s\)/i)).toBeInTheDocument()
    })

    // Confirm deletion
    fireEvent.click(screen.getByRole('button', { name: /Confirm Delete/i }))

    await waitFor(() => {
      expect(screen.queryByText('To Delete')).not.toBeInTheDocument()
    })

    // Verify cascaded via repository
    const subjects = await subjectRepo.getAll()
    expect(subjects).toHaveLength(0)

    const topics = await topicRepo.getBySubject(sub.id)
    expect(topics).toHaveLength(0)
  })
})
