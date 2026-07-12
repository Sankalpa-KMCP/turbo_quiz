import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { db } from '../../db/database'
import { SubjectRepository } from '../../db/repositories/SubjectRepository'
import { TopicRepository } from '../../db/repositories/TopicRepository'
import { QuestionRepository } from '../../db/repositories/QuestionRepository'
import QuestionFormPage from '../QuestionFormPage'

const subjectRepo = new SubjectRepository(db)
const topicRepo = new TopicRepository(db)
const questionRepo = new QuestionRepository(db)

const renderWithRouter = (initialUrl: string) => {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route path="/questions/new" element={<QuestionFormPage />} />
        <Route path="/questions/:questionId/edit" element={<QuestionFormPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('QuestionFormPage', () => {
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

  it('handles edit not found', async () => {
    renderWithRouter('/questions/999/edit')
    await waitFor(() => {
      expect(screen.getByText('Question not found.')).toBeInTheDocument()
    })
  })

  it('loads creation form and preselects subject and topic', async () => {
    const sub = await subjectRepo.create({ name: 'History', description: null })
    const topic = await topicRepo.create({ subjectId: sub.id, name: 'Rome' })

    renderWithRouter(`/questions/new?subjectId=${sub.id}&topicId=${topic.id}`)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Create Question' })).toBeInTheDocument()
    })

    await waitFor(() => {
      const subjectSelect = screen.getByLabelText(/Subject \*/i) as HTMLSelectElement
      expect(subjectSelect.value).toBe(sub.id.toString())

      const topicSelect = screen.getByLabelText(/Topic/i) as HTMLSelectElement
      expect(topicSelect.value).toBe(topic.id.toString())
    })
  })

  it('creates a valid question', async () => {
    const sub = await subjectRepo.create({ name: 'Math', description: null })

    renderWithRouter(`/questions/new?subjectId=${sub.id}`)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Create Question' })).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/Question Text/i), { target: { value: 'What is 2+2?' } })

    const optionInputs = screen.getAllByPlaceholderText(/Option \d/)
    fireEvent.change(optionInputs[0], { target: { value: '3' } })
    fireEvent.change(optionInputs[1], { target: { value: '4' } })

    const optionRadios = screen.getAllByTitle('Mark as correct answer')
    fireEvent.click(optionRadios[1])

    fireEvent.click(screen.getByRole('button', { name: 'Create Question' }))

    await waitFor(async () => {
      const q = await questionRepo.search({ subjectId: sub.id })
      expect(q).toHaveLength(1)
      expect(q[0].questionText).toBe('What is 2+2?')
      expect(q[0].options).toEqual(['3', '4'])
      expect(q[0].correctOptionIndex).toBe(1)
    })
  })

  it('allows editing an existing question', async () => {
    const sub = await subjectRepo.create({ name: 'Science', description: null })
    const q = await questionRepo.create({
      subjectId: sub.id,
      topicId: null,
      questionText: 'What is water?',
      options: ['H2O', 'CO2'],
      correctOptionIndex: 0,
      difficulty: 'easy',
      explanation: null
    })

    renderWithRouter(`/questions/${q.id}/edit`)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Question' })).toBeInTheDocument()
    })

    const qInput = screen.getByLabelText(/Question Text/i)
    expect(qInput).toHaveValue('What is water?')

    fireEvent.click(screen.getByRole('button', { name: '+ Add Option' }))

    const optionInputs = screen.getAllByPlaceholderText(/Option \d/)
    expect(optionInputs).toHaveLength(3)

    fireEvent.change(optionInputs[2], { target: { value: 'O2' } })

    const optionRadios = screen.getAllByTitle('Mark as correct answer')
    fireEvent.click(optionRadios[2])

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(async () => {
      const updated = await questionRepo.getById(q.id)
      expect(updated?.options).toHaveLength(3)
      expect(updated?.correctOptionIndex).toBe(2)
    })
  })

  it('allows adding up to 6 options and prevents 7th', async () => {
    const sub = await subjectRepo.create({ name: 'Science', description: null })
    renderWithRouter(`/questions/new?subjectId=${sub.id}`)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Create Question' })).toBeInTheDocument()
    })

    const addButton = screen.getByRole('button', { name: '+ Add Option' })

    fireEvent.click(addButton) // 3
    fireEvent.click(addButton) // 4
    fireEvent.click(addButton) // 5
    fireEvent.click(addButton) // 6

    expect(screen.queryByRole('button', { name: '+ Add Option' })).not.toBeInTheDocument()

    const optionInputs = screen.getAllByPlaceholderText(/Option \d/)
    expect(optionInputs).toHaveLength(6)

    fireEvent.change(screen.getByLabelText(/Question Text/i), { target: { value: '6 options question?' } })

    optionInputs.forEach((input, i) => {
      fireEvent.change(input, { target: { value: `Opt ${i + 1}` } })
    })

    const optionRadios = screen.getAllByTitle('Mark as correct answer')
    fireEvent.click(optionRadios[5])

    fireEvent.click(screen.getByRole('button', { name: 'Create Question' }))

    await waitFor(async () => {
      const qs = await questionRepo.search({ subjectId: sub.id })
      expect(qs).toHaveLength(1)
      expect(qs[0].options).toHaveLength(6)
      expect(qs[0].correctOptionIndex).toBe(5)
    })
  })

  it('adjusts correctOptionIndex correctly during removals', async () => {
    const sub = await subjectRepo.create({ name: 'Science', description: null })
    renderWithRouter(`/questions/new?subjectId=${sub.id}`)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Create Question' })).toBeInTheDocument()
    })

    const addButton = screen.getByRole('button', { name: '+ Add Option' })
    fireEvent.click(addButton) // 3
    fireEvent.click(addButton) // 4

    const getRadios = () => screen.getAllByTitle('Mark as correct answer') as HTMLInputElement[]
    const getRemoveBtns = () => screen.getAllByTitle('Remove Option')

    fireEvent.click(getRadios()[1])
    expect(getRadios()[1].checked).toBe(true)

    // Remove after selected: option 4 (index 3). Correct remains index 1.
    fireEvent.click(getRemoveBtns()[3])
    expect(getRadios()[1].checked).toBe(true)

    // Remove before selected: option 1 (index 0). Correct (was index 1) becomes index 0.
    fireEvent.click(getRemoveBtns()[0])
    expect(getRadios()[0].checked).toBe(true)

    // Add back a 3rd option
    fireEvent.click(screen.getByRole('button', { name: '+ Add Option' }))

    // Remove the selected option (index 0). Correct is cleared.
    fireEvent.click(getRemoveBtns()[0])

    const radios = getRadios()
    expect(radios[0].checked).toBe(false)
    expect(radios[1].checked).toBe(false)

    // Verify submission is blocked without correct option
    fireEvent.change(screen.getByLabelText(/Question Text/i), { target: { value: 'Valid question?' } })
    const inputs = screen.getAllByPlaceholderText(/Option \d/)
    fireEvent.change(inputs[0], { target: { value: 'A' } })
    fireEvent.change(inputs[1], { target: { value: 'B' } })

    fireEvent.click(screen.getByRole('button', { name: 'Create Question' }))

    await waitFor(() => {
      expect(screen.getByText('Correct option index must be non-negative')).toBeInTheDocument()
    })
  })
})
