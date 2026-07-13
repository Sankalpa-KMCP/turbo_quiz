import { create } from 'zustand'
import { type QuestionSnapshot, type QuizAttemptSessionSaveInput, type Question } from '../types/db'
import { shuffle } from '../utils/shuffle'
import { type QuestionSearchFilter } from '../db/repositories/QuestionRepository'

export interface SetupConfig {
  subjectId: number
  topicId: number | null
  mode: 'practice' | 'exam' | 'mistakes'
  questionCount: number | 'all'
  retryQuestionIds?: number[]
}

export interface SessionQuestion {
  questionId: number
  questionSnapshot: QuestionSnapshot
}

export interface SessionAnswer {
  selectedOptionIndex: number | null
  timeTakenSeconds: number
}

export type QuizSessionPhase =
  | 'idle'
  | 'configured'
  | 'loading'
  | 'playing'
  | 'completing'
  | 'completed'
  | 'error'

export interface QuizSessionDependencies {
  subjectRepository: {
    requireById(id: number): Promise<{ name: string }>
  }
  topicRepository: {
    requireById(id: number): Promise<{ name: string; subjectId: number }>
  }
  questionRepository: {
    search(filter: QuestionSearchFilter): Promise<Question[]>
    getByIds(ids: number[]): Promise<Question[]>
  }
  quizRepository: {
    save(input: QuizAttemptSessionSaveInput): Promise<{ id: number }>
  }
  clock: () => number
  random: () => number
}

export interface QuizSessionState {
  phase: QuizSessionPhase
  setupConfig: SetupConfig | null
  subjectNameSnap: string | null
  topicNameSnap: string | null
  questions: SessionQuestion[]
  currentIndex: number
  answers: Record<number, SessionAnswer>
  sessionStartedAt: number | null
  enteredAt: number | null
  completedAttemptId: number | null
  error: string | null
}

export interface QuizSessionActions {
  configureSetup(config: SetupConfig): void
  startSession(): Promise<void>
  selectAnswer(optionIndex: number): void
  skipQuestion(): void
  nextQuestion(): void
  previousQuestion(): void
  goToQuestion(index: number): void
  completeQuiz(): Promise<number>
  resetSession(): void
}

const DEFAULT_STATE: QuizSessionState = {
  phase: 'idle',
  setupConfig: null,
  subjectNameSnap: null,
  topicNameSnap: null,
  questions: [],
  currentIndex: -1,
  answers: {},
  sessionStartedAt: null,
  enteredAt: null,
  completedAttemptId: null,
  error: null
}

export const createQuizSessionStore = (dependencies: QuizSessionDependencies) => {
  let startGeneration = 0

  return create<QuizSessionState & QuizSessionActions>((set, get) => {
    // Helper to flush current question timing
    const getFlushedAnswers = (now: number): Record<number, SessionAnswer> => {
      const state = get()
      if (
        state.enteredAt === null ||
        state.currentIndex < 0 ||
        state.currentIndex >= state.questions.length
      ) {
        return state.answers
      }
      const q = state.questions[state.currentIndex]
      const ans = state.answers[q.questionId]
      if (!ans) {
        return state.answers
      }
      const deltaMs = Math.max(0, now - state.enteredAt)
      const deltaSeconds = deltaMs / 1000
      return {
        ...state.answers,
        [q.questionId]: {
          ...ans,
          timeTakenSeconds: ans.timeTakenSeconds + deltaSeconds
        }
      }
    }

    return {
      ...DEFAULT_STATE,

      configureSetup: (config) => {
        if (config.mode !== 'practice' && config.mode !== 'exam' && config.mode !== 'mistakes') {
          throw new Error(`Unsupported mode: ${config.mode}`)
        }
        startGeneration++

        let dedupedRetryIds: number[] | undefined = undefined
        if (config.retryQuestionIds && config.retryQuestionIds.length > 0) {
          dedupedRetryIds = Array.from(new Set(config.retryQuestionIds))
        }

        set({
          setupConfig: { ...config, retryQuestionIds: dedupedRetryIds },
          phase: 'configured',
          error: null
        })
      },

      startSession: async () => {
        const state = get()
        if (
          state.phase === 'loading' ||
          state.phase === 'playing' ||
          state.phase === 'completing'
        ) {
          return // Prevent overlapping starts
        }

        const config = state.setupConfig
        if (!config) {
          set({ phase: 'error', error: 'No configuration found' })
          return
        }

        startGeneration++
        const currentGen = startGeneration

        set({ phase: 'loading', error: null })

        try {
          // 1. Load current Subject
          const subject = await dependencies.subjectRepository.requireById(config.subjectId)
          if (startGeneration !== currentGen) return

          // 2. Load optional Topic
          let topicNameSnap: string | null = null
          if (config.topicId !== null) {
            const topic = await dependencies.topicRepository.requireById(config.topicId)
            if (startGeneration !== currentGen) return
            if (topic.subjectId !== config.subjectId) {
              throw new Error('Topic does not belong to the selected subject')
            }
            topicNameSnap = topic.name
          }

          // 3. Load eligible Questions through repository
          let candidateQuestions: Question[] = []
          if (config.retryQuestionIds) {
            candidateQuestions = await dependencies.questionRepository.getByIds(config.retryQuestionIds)
            candidateQuestions = candidateQuestions.filter(q => q.subjectId === config.subjectId)
          } else {
            candidateQuestions = await dependencies.questionRepository.search({
              subjectId: config.subjectId,
              topicFilter: config.topicId
                ? { kind: 'topic', topicId: config.topicId }
                : { kind: 'all' }
            })
          }
          if (startGeneration !== currentGen) return

          if (candidateQuestions.length === 0) {
            set({
              phase: 'error',
              error: 'No questions found for the selected filters'
            })
            return
          }

          // 4. Shuffle a copied pool using Fisher-Yates and random dependency
          const shuffled = shuffle(candidateQuestions, dependencies.random)

          // 5. Apply the count limit
          const selectedQuestions =
            config.questionCount === 'all'
              ? shuffled
              : shuffled.slice(0, config.questionCount)

          // 6. Construct immutable copied session snapshots
          const sessionQuestions: SessionQuestion[] = selectedQuestions.map((q) => ({
            questionId: q.id,
            questionSnapshot: {
              questionText: q.questionText,
              options: [...q.options],
              correctOptionIndex: q.correctOptionIndex,
              explanation: q.explanation,
              difficulty: q.difficulty
            }
          }))

          // 7. Initialize answer/timing records
          const answers: Record<number, SessionAnswer> = {}
          for (const sq of sessionQuestions) {
            answers[sq.questionId] = {
              selectedOptionIndex: null,
              timeTakenSeconds: 0
            }
          }

          const now = dependencies.clock()

          set({
            phase: 'playing',
            subjectNameSnap: subject.name,
            topicNameSnap,
            questions: sessionQuestions,
            currentIndex: 0,
            answers,
            sessionStartedAt: now,
            enteredAt: now,
            completedAttemptId: null,
            error: null
          })
        } catch (err) {
          if (startGeneration !== currentGen) return
          const errMsg = err instanceof Error ? err.message : String(err)
          set({ phase: 'error', error: errMsg })
        }
      },

      selectAnswer: (optionIndex) => {
        const state = get()
        if (state.phase !== 'playing') return

        const idx = state.currentIndex
        if (idx < 0 || idx >= state.questions.length) return

        const q = state.questions[idx]
        const ans = state.answers[q.questionId]
        if (!ans) return

        if (optionIndex < 0 || optionIndex >= q.questionSnapshot.options.length) {
          throw new Error('Option index out of bounds')
        }

        // Practice or mistakes mode: lock the answer after first selection
        if ((state.setupConfig?.mode === 'practice' || state.setupConfig?.mode === 'mistakes') && ans.selectedOptionIndex !== null) {
          return
        }

        set({
          answers: {
            ...state.answers,
            [q.questionId]: {
              ...ans,
              selectedOptionIndex: optionIndex
            }
          }
        })
      },

      skipQuestion: () => {
        const state = get()
        if (state.phase !== 'playing') return

        const now = dependencies.clock()
        const updatedAnswers = getFlushedAnswers(now)

        const nextIndex = state.currentIndex + 1
        if (nextIndex < state.questions.length) {
          set({
            answers: updatedAnswers,
            currentIndex: nextIndex,
            enteredAt: now
          })
        } else {
          set({
            answers: updatedAnswers,
            enteredAt: now
          })
        }
      },

      nextQuestion: () => {
        const state = get()
        if (state.phase !== 'playing') return

        const now = dependencies.clock()
        const updatedAnswers = getFlushedAnswers(now)

        const nextIndex = state.currentIndex + 1
        if (nextIndex < state.questions.length) {
          set({
            answers: updatedAnswers,
            currentIndex: nextIndex,
            enteredAt: now
          })
        }
      },

      previousQuestion: () => {
        const state = get()
        if (state.phase !== 'playing') return

        const now = dependencies.clock()
        const updatedAnswers = getFlushedAnswers(now)

        const prevIndex = state.currentIndex - 1
        if (prevIndex >= 0) {
          set({
            answers: updatedAnswers,
            currentIndex: prevIndex,
            enteredAt: now
          })
        }
      },

      goToQuestion: (index) => {
        const state = get()
        if (state.phase !== 'playing') return
        if (index < 0 || index >= state.questions.length) return

        const now = dependencies.clock()
        const updatedAnswers = getFlushedAnswers(now)

        set({
          answers: updatedAnswers,
          currentIndex: index,
          enteredAt: now
        })
      },

      completeQuiz: async () => {
        const state = get()
        if (state.phase === 'completing' || state.phase === 'completed') {
          // If already completed, just return the ID
          if (state.completedAttemptId !== null) {
            return state.completedAttemptId
          }
          throw new Error('Quiz is already completing or completed')
        }

        const config = state.setupConfig
        if (!config || !state.sessionStartedAt) {
          throw new Error('No active session to complete')
        }

        set({ phase: 'completing', error: null })

        const now = dependencies.clock()
        // Flush the final question timing
        const finalAnswers = getFlushedAnswers(now)

        try {
          const savePayload: QuizAttemptSessionSaveInput = {
            subjectId: config.subjectId,
            topicId: config.topicId,
            subjectNameSnap: state.subjectNameSnap!,
            topicNameSnap: state.topicNameSnap,
            mode: config.mode,
            startedAt: state.sessionStartedAt,
            answers: state.questions.map((q) => {
              const ans = finalAnswers[q.questionId]
              return {
                questionId: q.questionId,
                selectedOptionIndex: ans.selectedOptionIndex,
                timeTakenSeconds: Number(ans.timeTakenSeconds.toFixed(3)),
                questionSnapshot: q.questionSnapshot
              }
            })
          }

          const savedAttempt = await dependencies.quizRepository.save(savePayload)

          set({
            phase: 'completed',
            answers: finalAnswers,
            completedAttemptId: savedAttempt.id,
            error: null
          })

          return savedAttempt.id
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          set({
            phase: 'playing', // Recovery allows retrying
            error: errMsg
          })
          throw err
        }
      },

      resetSession: () => {
        startGeneration++
        set(DEFAULT_STATE)
      }
    }
  })
}

// Production repositories setup
import { db } from '../db/database'
import { SubjectRepository } from '../db/repositories/SubjectRepository'
import { TopicRepository } from '../db/repositories/TopicRepository'
import { QuestionRepository } from '../db/repositories/QuestionRepository'
import { QuizRepository } from '../db/repositories/QuizRepository'

const subjectRepo = new SubjectRepository(db)
const topicRepo = new TopicRepository(db)
const questionRepo = new QuestionRepository(db)
const quizRepo = new QuizRepository(db)

const productionDependencies: QuizSessionDependencies = {
  subjectRepository: {
    requireById: (id) => subjectRepo.requireById(id)
  },
  topicRepository: {
    requireById: (id) => topicRepo.requireById(id)
  },
  questionRepository: {
    search: (filter) => questionRepo.search(filter),
    getByIds: (ids) => questionRepo.getByIds(ids)
  },
  quizRepository: {
    save: (input) => quizRepo.save(input)
  },
  clock: () => Date.now(),
  random: () => Math.random()
}

export const useQuizSessionStore = createQuizSessionStore(productionDependencies)
