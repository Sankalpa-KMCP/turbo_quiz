import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { createQuizSessionStore, type QuizSessionDependencies } from '../quizSessionStore'

describe('QuizSessionStore', () => {
  let dependencies: QuizSessionDependencies
  let mockSubjectRepo: { requireById: Mock }
  let mockTopicRepo: { requireById: Mock }
  let mockQuestionRepo: { search: Mock; getByIds: Mock }
  let mockQuizRepo: { save: Mock }
  let currentTime: number
  let mockRandomVal: number

  beforeEach(() => {
    currentTime = 1000
    mockRandomVal = 0.5

    mockSubjectRepo = {
      requireById: vi.fn().mockResolvedValue({ name: 'Physics' })
    }
    mockTopicRepo = {
      requireById: vi.fn().mockResolvedValue({ name: 'Kinematics', subjectId: 1 })
    }
    mockQuestionRepo = {
      search: vi.fn().mockResolvedValue([
        {
          id: 10,
          questionText: 'Q1',
          options: ['A', 'B'],
          correctOptionIndex: 0,
          explanation: 'Exp1',
          difficulty: 'easy'
        },
        {
          id: 20,
          questionText: 'Q2',
          options: ['C', 'D'],
          correctOptionIndex: 1,
          explanation: 'Exp2',
          difficulty: 'medium'
        }
      ]),
      getByIds: vi.fn().mockResolvedValue([
        {
          id: 10,
          subjectId: 1,
          questionText: 'Q1',
          options: ['A', 'B'],
          correctOptionIndex: 0,
          explanation: 'Exp1',
          difficulty: 'easy'
        }
      ])
    }
    mockQuizRepo = {
      save: vi.fn().mockResolvedValue({ id: 999 })
    }

    dependencies = {
      subjectRepository: mockSubjectRepo,
      topicRepository: mockTopicRepo,
      questionRepository: mockQuestionRepo,
      quizRepository: mockQuizRepo,
      clock: () => currentTime,
      random: () => mockRandomVal
    }
  })

  it('has initial default state', () => {
    const store = createQuizSessionStore(dependencies)
    const state = store.getState()

    expect(state.phase).toBe('idle')
    expect(state.setupConfig).toBeNull()
    expect(state.subjectNameSnap).toBeNull()
    expect(state.topicNameSnap).toBeNull()
    expect(state.questions).toEqual([])
    expect(state.currentIndex).toBe(-1)
    expect(state.answers).toEqual({})
    expect(state.sessionStartedAt).toBeNull()
    expect(state.enteredAt).toBeNull()
    expect(state.completedAttemptId).toBeNull()
    expect(state.error).toBeNull()
  })

  it('configures setup and validates mode', () => {
    const store = createQuizSessionStore(dependencies)
    store.getState().configureSetup({
      subjectId: 1,
      topicId: null,
      mode: 'practice',
      questionCount: 'all'
    })

    expect(store.getState().phase).toBe('configured')
    expect(store.getState().setupConfig).toEqual({
      subjectId: 1,
      topicId: null,
      mode: 'practice',
      questionCount: 'all'
    })

    // It should allow mistakes mode and deduplicate retryQuestionIds
    expect(() => {
      store.getState().configureSetup({
        subjectId: 1,
        topicId: null,
        mode: 'mistakes',
        questionCount: 'all',
        retryQuestionIds: [10, 10, 20]
      })
    }).not.toThrow()

    expect(store.getState().setupConfig?.retryQuestionIds).toEqual([10, 20])
  })

  it('loads and starts session correctly, copying snapshots', async () => {
    const store = createQuizSessionStore(dependencies)
    store.getState().configureSetup({
      subjectId: 1,
      topicId: 2,
      mode: 'practice',
      questionCount: 1
    })

    currentTime = 2000
    await store.getState().startSession()

    const state = store.getState()
    expect(state.phase).toBe('playing')
    expect(state.subjectNameSnap).toBe('Physics')
    expect(state.topicNameSnap).toBe('Kinematics')
    expect(state.sessionStartedAt).toBe(2000)
    expect(state.enteredAt).toBe(2000)
    expect(state.currentIndex).toBe(0)
    expect(state.questions.length).toBe(1)
    expect(state.questions[0].questionId).toBe(10)
    expect(state.answers[10]).toEqual({
      selectedOptionIndex: null,
      timeTakenSeconds: 0
    })
  })

  it('prevents overlapping session starts', async () => {
    const store = createQuizSessionStore(dependencies)
    store.getState().configureSetup({
      subjectId: 1,
      topicId: null,
      mode: 'practice',
      questionCount: 'all'
    })

    // Initiate startSession
    const promise1 = store.getState().startSession()
    // Trigger startSession again immediately while phase is loading
    await store.getState().startSession()
    await promise1

    expect(mockQuestionRepo.search).toHaveBeenCalledTimes(1)
  })

  it('handles empty questions failure state', async () => {
    mockQuestionRepo.search.mockResolvedValue([])
    const store = createQuizSessionStore(dependencies)
    store.getState().configureSetup({
      subjectId: 1,
      topicId: null,
      mode: 'practice',
      questionCount: 'all'
    })

    await store.getState().startSession()

    expect(store.getState().phase).toBe('error')
    expect(store.getState().error).toContain('No questions found')
  })

  it('validates topic subject match', async () => {
    mockTopicRepo.requireById.mockResolvedValue({ name: 'Chemistry', subjectId: 2 })
    const store = createQuizSessionStore(dependencies)
    store.getState().configureSetup({
      subjectId: 1, // physics
      topicId: 3, // chemistry topic, subjectId is 2
      mode: 'practice',
      questionCount: 'all'
    })

    await store.getState().startSession()

    expect(store.getState().phase).toBe('error')
    expect(store.getState().error).toContain('Topic does not belong')
  })

  it('selects answers, enforces locking in practice mode, allows changes in exam mode', async () => {
    const store = createQuizSessionStore(dependencies)

    // Practice mode test
    store.getState().configureSetup({
      subjectId: 1,
      topicId: null,
      mode: 'practice',
      questionCount: 'all'
    })
    await store.getState().startSession()

    store.getState().selectAnswer(1)
    expect(store.getState().answers[10].selectedOptionIndex).toBe(1)

    // Answer is locked in practice
    store.getState().selectAnswer(0)
    expect(store.getState().answers[10].selectedOptionIndex).toBe(1)

    // Exam mode test
    const examStore = createQuizSessionStore(dependencies)
    examStore.getState().configureSetup({
      subjectId: 1,
      topicId: null,
      mode: 'exam',
      questionCount: 'all'
    })
    await examStore.getState().startSession()

    examStore.getState().selectAnswer(1)
    expect(examStore.getState().answers[10].selectedOptionIndex).toBe(1)

    // Answer can be changed in exam
    examStore.getState().selectAnswer(0)
    expect(examStore.getState().answers[10].selectedOptionIndex).toBe(0)

    // Mistakes mode test
    const mistakesStore = createQuizSessionStore(dependencies)
    mistakesStore.getState().configureSetup({
      subjectId: 1,
      topicId: null,
      mode: 'mistakes',
      questionCount: 'all'
    })
    await mistakesStore.getState().startSession()

    mistakesStore.getState().selectAnswer(1)
    expect(mistakesStore.getState().answers[10].selectedOptionIndex).toBe(1)

    // Answer is locked in mistakes
    mistakesStore.getState().selectAnswer(0)
    expect(mistakesStore.getState().answers[10].selectedOptionIndex).toBe(1)
  })

  it('accumulates timing correctly on navigation, skipping, and completion', async () => {
    const store = createQuizSessionStore(dependencies)
    store.getState().configureSetup({
      subjectId: 1,
      topicId: null,
      mode: 'practice',
      questionCount: 'all'
    })

    currentTime = 1000
    await store.getState().startSession()

    // 5 seconds pass on question 0
    currentTime = 6000
    store.getState().nextQuestion()

    expect(store.getState().currentIndex).toBe(1)
    expect(store.getState().answers[10].timeTakenSeconds).toBe(5)
    expect(store.getState().enteredAt).toBe(6000)

    // 3 seconds pass on question 1
    currentTime = 9000
    store.getState().previousQuestion()

    expect(store.getState().currentIndex).toBe(0)
    expect(store.getState().answers[20].timeTakenSeconds).toBe(3)
    expect(store.getState().enteredAt).toBe(9000)

    // 2 more seconds pass on question 0 (should accumulate)
    currentTime = 11000
    store.getState().skipQuestion() // advance or update timing

    expect(store.getState().answers[10].timeTakenSeconds).toBe(7) // 5 + 2

    // Finish quiz, 4 seconds pass
    currentTime = 15000
    const attemptId = await store.getState().completeQuiz()

    expect(attemptId).toBe(999)
    expect(store.getState().phase).toBe('completed')
    expect(store.getState().answers[10].timeTakenSeconds).toBe(7)
    expect(store.getState().answers[20].timeTakenSeconds).toBe(7)

    // Check completeQuiz payload matches exactly
    expect(mockQuizRepo.save).toHaveBeenCalledWith({
      subjectId: 1,
      topicId: null,
      subjectNameSnap: 'Physics',
      topicNameSnap: null,
      mode: 'practice',
      startedAt: 1000,
      answers: [
        {
          questionId: 10,
          selectedOptionIndex: null,
          timeTakenSeconds: 7,
          questionSnapshot: {
            questionText: 'Q1',
            options: ['A', 'B'],
            correctOptionIndex: 0,
            explanation: 'Exp1',
            difficulty: 'easy'
          }
        },
        {
          questionId: 20,
          selectedOptionIndex: null,
          timeTakenSeconds: 7,
          questionSnapshot: {
            questionText: 'Q2',
            options: ['C', 'D'],
            correctOptionIndex: 1,
            explanation: 'Exp2',
            difficulty: 'medium'
          }
        }
      ]
    })
  })

  it('allows recovery and retry on save failure', async () => {
    mockQuizRepo.save.mockRejectedValueOnce(new Error('Network error'))
    const store = createQuizSessionStore(dependencies)
    store.getState().configureSetup({
      subjectId: 1,
      topicId: null,
      mode: 'practice',
      questionCount: 'all'
    })
    await store.getState().startSession()

    await expect(store.getState().completeQuiz()).rejects.toThrow('Network error')

    // Phase stays playable (or recovers to playing), allowing retry
    expect(store.getState().phase).toBe('playing')
    expect(store.getState().error).toBe('Network error')

    // Next retry succeeds
    const attemptId = await store.getState().completeQuiz()
    expect(attemptId).toBe(999)
    expect(store.getState().phase).toBe('completed')
  })

  it('resets session state', () => {
    const store = createQuizSessionStore(dependencies)
    store.getState().configureSetup({
      subjectId: 1,
      topicId: null,
      mode: 'practice',
      questionCount: 'all'
    })
    store.getState().resetSession()

    expect(store.getState().phase).toBe('idle')
    expect(store.getState().setupConfig).toBeNull()
  })

  it('invalidates and ignores stale starts if resetSession occurs during loading', async () => {
    let resolveSubject: (val: { name: string }) => void = () => {}
    const subjectPromise = new Promise<{ name: string }>((resolve) => {
      resolveSubject = resolve
    })
    mockSubjectRepo.requireById.mockReturnValueOnce(subjectPromise)

    const store = createQuizSessionStore(dependencies)
    store.getState().configureSetup({
      subjectId: 1,
      topicId: null,
      mode: 'practice',
      questionCount: 'all'
    })

    const startPromise = store.getState().startSession()
    expect(store.getState().phase).toBe('loading')

    // Invalidate by calling resetSession
    store.getState().resetSession()
    expect(store.getState().phase).toBe('idle')

    // Now resolve the old load
    resolveSubject({ name: 'Stale Subject' })
    await startPromise

    // Verify it did not transition to playing or overwrite the reset state
    expect(store.getState().phase).toBe('idle')
    expect(store.getState().subjectNameSnap).toBeNull()
  })

  it('invalidates and ignores stale starts if configureSetup occurs during loading', async () => {
    let resolveSubject: (val: { name: string }) => void = () => {}
    const subjectPromise = new Promise<{ name: string }>((resolve) => {
      resolveSubject = resolve
    })
    mockSubjectRepo.requireById.mockReturnValueOnce(subjectPromise)

    const store = createQuizSessionStore(dependencies)
    store.getState().configureSetup({
      subjectId: 1,
      topicId: null,
      mode: 'practice',
      questionCount: 'all'
    })

    const startPromise = store.getState().startSession()
    expect(store.getState().phase).toBe('loading')

    // Invalidate by calling configureSetup for B
    const configB = {
      subjectId: 2,
      topicId: null,
      mode: 'exam' as const,
      questionCount: 5 as const
    }
    store.getState().configureSetup(configB)
    expect(store.getState().phase).toBe('configured')
    expect(store.getState().setupConfig).toEqual(configB)

    // Now resolve the old load
    resolveSubject({ name: 'Subject A' })
    await startPromise

    // Verify it did not transition to playing or overwrite configuration B
    expect(store.getState().phase).toBe('configured')
    expect(store.getState().setupConfig).toEqual(configB)
    expect(store.getState().subjectNameSnap).toBeNull()
  })

  it('ignores stale rejection/failure after reset or reconfigure', async () => {
    let rejectSubject: (err: Error) => void = () => {}
    const subjectPromise = new Promise((_, reject) => {
      rejectSubject = reject
    })
    mockSubjectRepo.requireById.mockReturnValueOnce(subjectPromise)

    const store = createQuizSessionStore(dependencies)
    store.getState().configureSetup({
      subjectId: 1,
      topicId: null,
      mode: 'practice',
      questionCount: 'all'
    })

    const startPromise = store.getState().startSession()
    expect(store.getState().phase).toBe('loading')

    // Reset store
    store.getState().resetSession()

    // Reject the stale load
    rejectSubject(new Error('Stale lookup error'))
    await startPromise

    // State remains idle, error is NOT set to 'Stale lookup error'
    expect(store.getState().phase).toBe('idle')
    expect(store.getState().error).toBeNull()
  })

  it('allows a subsequent start session to succeed after a previous one was invalidated', async () => {
    // 1. First start is blocked on Subject lookup
    let resolveSubject1: (val: { name: string }) => void = () => {}
    const subjectPromise1 = new Promise<{ name: string }>((resolve) => {
      resolveSubject1 = resolve
    })
    mockSubjectRepo.requireById.mockReturnValueOnce(subjectPromise1)

    const store = createQuizSessionStore(dependencies)
    store.getState().configureSetup({
      subjectId: 1,
      topicId: null,
      mode: 'practice',
      questionCount: 'all'
    })

    const startPromise1 = store.getState().startSession()

    // 2. Reconfigure setup
    store.getState().configureSetup({
      subjectId: 2,
      topicId: null,
      mode: 'exam',
      questionCount: 'all'
    })

    // 3. Second start gets a normal subject resolve
    mockSubjectRepo.requireById.mockResolvedValueOnce({ name: 'Subject 2' })
    mockQuestionRepo.search.mockResolvedValueOnce([
      {
        id: 101,
        subjectId: 2,
        topicId: null,
        questionText: 'Q2',
        options: ['A', 'B'],
        correctOptionIndex: 0,
        explanation: 'Exp',
        difficulty: 'medium',
        createdAt: 2000
      }
    ])

    const startPromise2 = store.getState().startSession()
    await startPromise2

    // Verify second start succeeded
    expect(store.getState().phase).toBe('playing')
    expect(store.getState().subjectNameSnap).toBe('Subject 2')

    // 4. Resolve the stale first start
    resolveSubject1({ name: 'Subject 1' })
    await startPromise1

    // State should still remain in playing phase for Subject 2
    expect(store.getState().phase).toBe('playing')
    expect(store.getState().subjectNameSnap).toBe('Subject 2')
    expect(store.getState().questions[0].questionId).toBe(101)
  })

  it('loads questions via getByIds for retry sessions', async () => {
    const store = createQuizSessionStore(dependencies)
    store.getState().configureSetup({
      subjectId: 1,
      topicId: null,
      mode: 'mistakes',
      questionCount: 'all',
      retryQuestionIds: [10]
    })
    await store.getState().startSession()

    expect(mockQuestionRepo.getByIds).toHaveBeenCalledWith([10])
    expect(mockQuestionRepo.search).not.toHaveBeenCalled()
    expect(store.getState().questions.length).toBe(1)
    expect(store.getState().questions[0].questionId).toBe(10)
  })
})
