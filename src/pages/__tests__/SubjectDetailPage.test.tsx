import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { db } from '../../db/database'
import { SubjectRepository } from '../../db/repositories/SubjectRepository'
import { TopicRepository } from '../../db/repositories/TopicRepository'
import { QuestionRepository } from '../../db/repositories/QuestionRepository'
import SubjectDetailPage from '../SubjectDetailPage'

const subjectRepo = new SubjectRepository(db)
const topicRepo = new TopicRepository(db)
const questionRepo = new QuestionRepository(db)

const renderWithRouter = (subjectId: string) => {
  return render(
    <MemoryRouter initialEntries={[`/subjects/${subjectId}`]}>
      <Routes>
        <Route path="/subjects/:subjectId" element={<SubjectDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('SubjectDetailPage', () => {
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

  it('handles malformed ID', () => {
    renderWithRouter('abc')
    expect(screen.getByText('Invalid Subject ID')).toBeInTheDocument()
  })

  it('handles missing subject', async () => {
    renderWithRouter('999')
    await waitFor(() => {
      expect(screen.getByText('Subject Not Found')).toBeInTheDocument()
    })
  })

  it('renders subject and handles rename', async () => {
    const sub = await subjectRepo.create({ name: 'Mock', description: null })

    renderWithRouter(sub.id.toString())

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Mock' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Edit Subject Name/i }))

    const input = await screen.findByRole('textbox', { name: /^Subject Name/ })
    fireEvent.change(input, { target: { value: 'Advanced Science' } })
    fireEvent.click(screen.getByRole('button', { name: /Save/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Advanced Science' })).toBeInTheDocument()
    })

    const updated = await subjectRepo.getById(sub.id)
    expect(updated?.name).toBe('Advanced Science')
  })

  it('allows creating, renaming, and deleting topics', async () => {
    const sub = await subjectRepo.create({ name: 'Mock', description: null })

    renderWithRouter(sub.id.toString())

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Mock' })).toBeInTheDocument()
    })

    // Create topic
    const createInput = screen.getByLabelText(/New Topic Name/i)
    fireEvent.change(createInput, { target: { value: 'Algebra' } })
    fireEvent.click(screen.getByRole('button', { name: /Create Topic/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Algebra' })).toBeInTheDocument()
    })

    const topics = await topicRepo.getBySubject(sub.id)
    expect(topics).toHaveLength(1)

    // Rename topic
    // There are multiple edit buttons (subject, topic). We can scope to the topic block
    // but right now it's the only one with just "Edit"
    const editBtns = screen.getAllByRole('button', { name: 'Edit' })
    fireEvent.click(editBtns[0])

    const editInput = await screen.findByRole('textbox', { name: /^Topic Name/ })
    fireEvent.change(editInput, { target: { value: 'Linear Algebra' } })
    fireEvent.click(screen.getByRole('button', { name: /Save/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Linear Algebra' })).toBeInTheDocument()
    })

    // Delete topic
    fireEvent.click(screen.getByRole('button', { name: /Delete/i }))
    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to delete this topic\?/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Confirm Delete/i }))

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Linear Algebra' })).not.toBeInTheDocument()
    })

    const remaining = await topicRepo.getBySubject(sub.id)
    expect(remaining).toHaveLength(0)
  })

  it('displays accurate question counts', async () => {
    const sub = await subjectRepo.create({ name: 'Mock', description: null })
    const topic = await topicRepo.create({ subjectId: sub.id, name: 'Ancient' })

    await questionRepo.create({
      subjectId: sub.id,
      topicId: topic.id,
      questionText: 'Q1',
      options: ['A', 'B'],
      correctOptionIndex: 0,
      difficulty: 'easy',
      explanation: null
    })

    // Uncategorized
    await questionRepo.create({
      subjectId: sub.id,
      topicId: null,
      questionText: 'Q2',
      options: ['A', 'B'],
      correctOptionIndex: 0,
      difficulty: 'easy',
      explanation: null
    })

    renderWithRouter(sub.id.toString())

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Mock' })).toBeInTheDocument()

      // Total should be 2, uncategorized 1, topic 1
      expect(screen.getByText(/2 Questions/i)).toBeInTheDocument() // Subject header

      // Uncategorized count
      const uncatBlock = screen.getByText('Uncategorized').parentElement
      expect(within(uncatBlock!).getByText(/1 Questions/i)).toBeInTheDocument()

      // Topic count
      const topicBlock = screen.getByRole('heading', { name: 'Ancient' }).parentElement
      expect(within(topicBlock!).getByText(/1 Questions/i)).toBeInTheDocument()
    })
  })

  it('provides an accessible delete-topic dialog with focus management and Escape key support', async () => {
    const sub = await subjectRepo.create({ name: 'Mock', description: null })
    await topicRepo.create({ subjectId: sub.id, name: 'Accessibility Test Topic' })

    renderWithRouter(sub.id.toString())

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Accessibility Test Topic' })).toBeInTheDocument()
    })

    const deleteBtn = screen.getByRole('button', { name: /Delete/i })
    deleteBtn.focus() // Ensure it is the active element before clicking
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      // Verify dialog semantics
      const dialog = screen.getByRole('dialog', { name: 'Delete Topic: Accessibility Test Topic' })
      expect(dialog).toBeInTheDocument()
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAttribute('aria-describedby')
    })

    const dialog = screen.getByRole('dialog')

    // Test Escape key
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    // Focus restoration is deferred by setTimeout, wait for it
    await waitFor(() => {
      const newDeleteBtn = screen.getByRole('button', { name: /Delete/i })
      expect(document.activeElement).toBe(newDeleteBtn)
    })

    // Test Cancel button
    const restoredDeleteBtn = screen.getByRole('button', { name: /Delete/i })
    fireEvent.click(restoredDeleteBtn) // reopen
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i })
    fireEvent.click(cancelBtn)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    await waitFor(() => {
      const finalDeleteBtn = screen.getByRole('button', { name: /Delete/i })
      expect(document.activeElement).toBe(finalDeleteBtn)
    })
  })
})
