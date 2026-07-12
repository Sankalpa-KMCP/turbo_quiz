import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { db } from '../../db/database'
import { QuizRepository } from '../../db/repositories/QuizRepository'
import QuizResultsPage from '../QuizResultsPage'

const quizRepo = new QuizRepository(db)

describe('QuizResultsPage', () => {
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

  it('handles loading state and displays score / snapshots from database', async () => {
    // Save attempt directly
    const attempt = await quizRepo.save({
      subjectId: 101,
      topicId: 202,
      subjectNameSnap: 'Subject Snapshot Name',
      topicNameSnap: 'Topic Snapshot Name',
      mode: 'practice',
      startedAt: 1000,
      answers: [
        {
          questionId: 303,
          selectedOptionIndex: 0,
          timeTakenSeconds: 15.5,
          questionSnapshot: {
            questionText: 'Persisted Question Text',
            options: ['Option A', 'Option B'],
            correctOptionIndex: 0,
            explanation: 'Explanation snapshot text',
            difficulty: 'easy'
          }
        }
      ]
    })

    render(
      <MemoryRouter initialEntries={[`/quiz/results/${attempt.id}`]}>
        <Routes>
          <Route path="/quiz/results/:attemptId" element={<QuizResultsPage />} />
        </Routes>
      </MemoryRouter>
    )

    // Verify loading spinner shows initially or directly goes to content
    // Verify subject snapshot name displays
    await waitFor(() => {
      expect(screen.getByText('Subject Snapshot Name')).toBeInTheDocument()
      expect(screen.getByText(/Topic Snapshot Name/i)).toBeInTheDocument()
      expect(screen.getByText('100%')).toBeInTheDocument() // 1 correct out of 1
      expect(screen.getByText('1 / 1')).toBeInTheDocument() // correct / total count
      expect(screen.getByText('Persisted Question Text')).toBeInTheDocument()
      expect(screen.getByText('Option A')).toBeInTheDocument()
      expect(screen.getByText('Option B')).toBeInTheDocument()
      expect(screen.getByText('Explanation snapshot text')).toBeInTheDocument()
      expect(screen.getByText('15.5s')).toBeInTheDocument()
    })
  })

  it('renders skipped or unanswered questions correctly', async () => {
    const attempt = await quizRepo.save({
      subjectId: 101,
      topicId: null,
      subjectNameSnap: 'Subject Name',
      topicNameSnap: null,
      mode: 'exam',
      startedAt: 1000,
      answers: [
        {
          questionId: 303,
          selectedOptionIndex: null, // unanswered/skipped
          timeTakenSeconds: 0,
          questionSnapshot: {
            questionText: 'Skipped Question Text',
            options: ['Opt A', 'Opt B'],
            correctOptionIndex: 1,
            explanation: null,
            difficulty: 'hard'
          }
        }
      ]
    })

    render(
      <MemoryRouter initialEntries={[`/quiz/results/${attempt.id}`]}>
        <Routes>
          <Route path="/quiz/results/:attemptId" element={<QuizResultsPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Skipped Question Text')).toBeInTheDocument()
      expect(screen.getByText('Skipped')).toBeInTheDocument()
      expect(screen.getByText('Opt A')).toBeInTheDocument()
      expect(screen.getByText('Opt B')).toBeInTheDocument()
      expect(screen.getByText('0%')).toBeInTheDocument()
    })
  })

  it('displays fallback error message for invalid or missing attempt IDs', async () => {
    render(
      <MemoryRouter initialEntries={['/quiz/results/999999']}>
        <Routes>
          <Route path="/quiz/results/:attemptId" element={<QuizResultsPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Unable to Load Results')).toBeInTheDocument()
      expect(screen.getByText(/Quiz attempt with ID 999999 was not found/i)).toBeInTheDocument()
    })
  })

  it('displays fallback error message for malformed route IDs', async () => {
    render(
      <MemoryRouter initialEntries={['/quiz/results/not-a-number']}>
        <Routes>
          <Route path="/quiz/results/:attemptId" element={<QuizResultsPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Unable to Load Results')).toBeInTheDocument()
      expect(screen.getByText(/Invalid or malformed Attempt ID/i)).toBeInTheDocument()
    })
  })
})
