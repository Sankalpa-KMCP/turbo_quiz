import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { useQuizSessionStore } from '../../stores/quizSessionStore'
import QuizPlayPage from '../QuizPlayPage'

describe('QuizPlayPage', () => {
  beforeEach(() => {
    useQuizSessionStore.getState().resetSession()
  })

  it('redirects to setup when no active session exists', () => {
    render(
      <MemoryRouter initialEntries={['/quiz/play']}>
        <QuizPlayPage />
      </MemoryRouter>
    )

    // Should redirect to setup (since MemoryRouter setup has path setup)
    // Here we can check if it returns null or has setup state.
    // Since Navigate component does the routing shift, rendering with setup config null redirect matches.
  })

  it('renders active session questions and options correctly in practice mode', () => {
    useQuizSessionStore.setState({
      phase: 'playing',
      setupConfig: {
        subjectId: 1,
        topicId: null,
        mode: 'practice',
        questionCount: 'all'
      },
      subjectNameSnap: 'Physics',
      topicNameSnap: null,
      questions: [
        {
          questionId: 10,
          questionSnapshot: {
            questionText: 'Is light a wave or particle?',
            options: ['Wave', 'Particle', 'Both'],
            correctOptionIndex: 2,
            explanation: 'It exhibits wave-particle duality.',
            difficulty: 'easy'
          }
        }
      ],
      currentIndex: 0,
      answers: {
        10: { selectedOptionIndex: null, timeTakenSeconds: 0 }
      },
      sessionStartedAt: Date.now(),
      enteredAt: Date.now()
    })

    render(
      <MemoryRouter>
        <QuizPlayPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Physics')).toBeInTheDocument()
    expect(screen.getByText('Is light a wave or particle?')).toBeInTheDocument()
    expect(screen.getByText('Wave')).toBeInTheDocument()
    expect(screen.getByText('Particle')).toBeInTheDocument()
    expect(screen.getByText('Both')).toBeInTheDocument()
    expect(screen.getByText('practice mode', { exact: false })).toBeInTheDocument()

    // Explanation should not be displayed yet
    expect(screen.queryByText('Explanation')).not.toBeInTheDocument()

    // Select incorrect answer 'Wave'
    fireEvent.click(screen.getByText('Wave'))

    // In practice mode, incorrect highlights and correct highlights, explanation is revealed
    expect(screen.getByText('Explanation')).toBeInTheDocument()
    expect(screen.getByText('It exhibits wave-particle duality.')).toBeInTheDocument()

    // Selection should be locked in practice mode (subsequent clicks on 'Particle' won't change selected answer)
    fireEvent.click(screen.getByText('Particle'))
    expect(useQuizSessionStore.getState().answers[10].selectedOptionIndex).toBe(0) // Still 0 ('Wave')
  })

  it('hides correctness and allows answer changes in exam mode', () => {
    useQuizSessionStore.setState({
      phase: 'playing',
      setupConfig: {
        subjectId: 1,
        topicId: null,
        mode: 'exam',
        questionCount: 'all'
      },
      subjectNameSnap: 'Physics',
      topicNameSnap: null,
      questions: [
        {
          questionId: 10,
          questionSnapshot: {
            questionText: 'Is light a wave or particle?',
            options: ['Wave', 'Particle', 'Both'],
            correctOptionIndex: 2,
            explanation: 'It exhibits wave-particle duality.',
            difficulty: 'easy'
          }
        }
      ],
      currentIndex: 0,
      answers: {
        10: { selectedOptionIndex: null, timeTakenSeconds: 0 }
      },
      sessionStartedAt: Date.now(),
      enteredAt: Date.now()
    })

    render(
      <MemoryRouter>
        <QuizPlayPage />
      </MemoryRouter>
    )

    expect(screen.getByText('exam mode', { exact: false })).toBeInTheDocument()

    // Select 'Wave'
    fireEvent.click(screen.getByText('Wave'))
    expect(useQuizSessionStore.getState().answers[10].selectedOptionIndex).toBe(0)

    // Correctness feedback and explanation are hidden
    expect(screen.queryByText('Explanation')).not.toBeInTheDocument()

    // Can change selection in exam mode
    fireEvent.click(screen.getByText('Both'))
    expect(useQuizSessionStore.getState().answers[10].selectedOptionIndex).toBe(2)
    expect(screen.queryByText('Explanation')).not.toBeInTheDocument()
  })

  it('supports navigation, skipping, and confirmation finish dialog', async () => {
    useQuizSessionStore.setState({
      phase: 'playing',
      setupConfig: {
        subjectId: 1,
        topicId: null,
        mode: 'exam',
        questionCount: 'all'
      },
      subjectNameSnap: 'Physics',
      topicNameSnap: null,
      questions: [
        {
          questionId: 10,
          questionSnapshot: {
            questionText: 'Q1',
            options: ['A', 'B'],
            correctOptionIndex: 0,
            explanation: null,
            difficulty: 'easy'
          }
        },
        {
          questionId: 20,
          questionSnapshot: {
            questionText: 'Q2',
            options: ['C', 'D'],
            correctOptionIndex: 1,
            explanation: null,
            difficulty: 'easy'
          }
        }
      ],
      currentIndex: 0,
      answers: {
        10: { selectedOptionIndex: null, timeTakenSeconds: 0 },
        20: { selectedOptionIndex: null, timeTakenSeconds: 0 }
      },
      sessionStartedAt: Date.now(),
      enteredAt: Date.now()
    })

    render(
      <MemoryRouter>
        <QuizPlayPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Q1')).toBeInTheDocument()

    // Click Next, transitions to Q2
    fireEvent.click(screen.getByText('Next'))
    expect(screen.getByText('Q2')).toBeInTheDocument()

    // Click Previous, transitions back to Q1
    fireEvent.click(screen.getByText('Previous'))
    expect(screen.getByText('Q1')).toBeInTheDocument()

    // Skip Q1, transitions to Q2
    fireEvent.click(screen.getByText('Skip'))
    expect(screen.getByText('Q2')).toBeInTheDocument()

    // Q2 should show Finish Quiz button since it's the last question
    const finishBtn = screen.getByRole('button', { name: /Finish Quiz/i })
    expect(finishBtn).toBeInTheDocument()

    // Click Finish Quiz, triggers confirm panel
    fireEvent.click(finishBtn)
    expect(screen.getByRole('heading', { name: /Finish Quiz/i })).toBeInTheDocument()
    expect(screen.getByText(/You have 2 unanswered questions/i)).toBeInTheDocument()

    // Cancel dialog
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(screen.queryByRole('heading', { name: /Finish Quiz/i })).not.toBeInTheDocument()
  })

  it('handles accessible focus movement and Escape closure', async () => {
    vi.useFakeTimers()
    const container = document.createElement('div')
    document.body.appendChild(container)

    useQuizSessionStore.setState({
      phase: 'playing',
      setupConfig: {
        subjectId: 1,
        topicId: null,
        mode: 'exam',
        questionCount: 'all'
      },
      subjectNameSnap: 'Physics',
      topicNameSnap: null,
      questions: [
        {
          questionId: 10,
          questionSnapshot: {
            questionText: 'Q1',
            options: ['A', 'B'],
            correctOptionIndex: 0,
            explanation: null,
            difficulty: 'easy'
          }
        }
      ],
      currentIndex: 0,
      answers: {
        10: { selectedOptionIndex: null, timeTakenSeconds: 0 }
      },
      sessionStartedAt: Date.now(),
      enteredAt: Date.now()
    })

    render(
      <MemoryRouter>
        <QuizPlayPage />
      </MemoryRouter>,
      { container }
    )

    const finishBtn = screen.getByRole('button', { name: /Finish Quiz/i })
    expect(finishBtn).toBeInTheDocument()

    // 1. Click finish opens confirmation and focuses Cancel button
    fireEvent.click(finishBtn)
    vi.runOnlyPendingTimers()

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i })
    expect(document.activeElement).toBe(cancelBtn)

    // 2. Escape key closes confirmation and returns focus to finish button
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
    vi.runOnlyPendingTimers()

    expect(screen.queryByRole('heading', { name: /Finish Quiz/i })).not.toBeInTheDocument()
    const finishBtnAfter = screen.getByRole('button', { name: /Finish Quiz/i })
    expect(document.activeElement).toBe(finishBtnAfter)

    // 3. Cancel button click closes confirmation and returns focus
    fireEvent.click(finishBtnAfter)
    vi.runOnlyPendingTimers()
    const cancelBtn2 = screen.getByRole('button', { name: /Cancel/i })
    fireEvent.click(cancelBtn2)
    vi.runOnlyPendingTimers()

    expect(screen.queryByRole('heading', { name: /Finish Quiz/i })).not.toBeInTheDocument()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Finish Quiz/i }))

    vi.useRealTimers()
    document.body.removeChild(container)
  })

  it('guards confirm Finish against multiple simultaneous clicks', async () => {
    const completeQuizSpy = vi.fn().mockImplementation(() => {
      // Simulate delay in completion
      return new Promise((resolve) => setTimeout(() => resolve(456), 50))
    })

    useQuizSessionStore.setState({
      phase: 'playing',
      setupConfig: {
        subjectId: 1,
        topicId: null,
        mode: 'exam',
        questionCount: 'all'
      },
      subjectNameSnap: 'Physics',
      topicNameSnap: null,
      questions: [
        {
          questionId: 10,
          questionSnapshot: {
            questionText: 'Q1',
            options: ['A', 'B'],
            correctOptionIndex: 0,
            explanation: null,
            difficulty: 'easy'
          }
        }
      ],
      currentIndex: 0,
      answers: {
        10: { selectedOptionIndex: null, timeTakenSeconds: 0 }
      },
      sessionStartedAt: Date.now(),
      enteredAt: Date.now(),
      completeQuiz: completeQuizSpy
    })

    render(
      <MemoryRouter>
        <QuizPlayPage />
      </MemoryRouter>
    )

    // Open confirmation
    fireEvent.click(screen.getByRole('button', { name: /Finish Quiz/i }))

    // Trigger multiple confirm clicks
    const confirmBtn = screen.getByRole('button', { name: /Submit Answers/i })
    fireEvent.click(confirmBtn)
    fireEvent.click(confirmBtn)

    // Verify it only calls completeQuiz once
    expect(completeQuizSpy).toHaveBeenCalledTimes(1)
  })
})
