import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from '../../db/database'
import { SubjectRepository } from '../../db/repositories/SubjectRepository'
import { TopicRepository } from '../../db/repositories/TopicRepository'
import { QuestionRepository } from '../../db/repositories/QuestionRepository'
import { QuizRepository } from '../../db/repositories/QuizRepository'
import { createQuizSessionStore, type QuizSessionDependencies } from '../quizSessionStore'

const subjectRepo = new SubjectRepository(db)
const topicRepo = new TopicRepository(db)
const questionRepo = new QuestionRepository(db)
const quizRepo = new QuizRepository(db)

describe('Quiz Session Full Persistence Integration', () => {
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

  it('runs quiz lifecycle and saves valid payload to database', async () => {
    // 1. Create entities in DB
    const sub = await subjectRepo.create({ name: 'Integration Physics', description: 'Testing' })
    const topic = await topicRepo.create({ subjectId: sub.id, name: 'Electrostatics' })

    const q1 = await questionRepo.create({
      subjectId: sub.id,
      topicId: topic.id,
      questionText: 'What is the charge of an electron?',
      options: ['-1.6e-19 C', '+1.6e-19 C', '0 C'],
      correctOptionIndex: 0,
      explanation: 'Electron charge is negative.',
      difficulty: 'easy'
    })

    const q2 = await questionRepo.create({
      subjectId: sub.id,
      topicId: topic.id,
      questionText: 'What is the charge of a proton?',
      options: ['-1.6e-19 C', '+1.6e-19 C', '0 C'],
      correctOptionIndex: 1,
      explanation: 'Proton charge is positive.',
      difficulty: 'medium'
    })

    // 2. Set up store with production repositories dependencies but custom clock/random
    let mockTime = 10000
    const randomVal = 0.9 // no shuffle impact or predictable shuffle

    const testDependencies: QuizSessionDependencies = {
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
      clock: () => mockTime,
      random: () => randomVal
    }

    const store = createQuizSessionStore(testDependencies)

    // 3. Configure
    store.getState().configureSetup({
      subjectId: sub.id,
      topicId: topic.id,
      mode: 'practice',
      questionCount: 'all'
    })

    // 4. Start session
    await store.getState().startSession()
    expect(store.getState().phase).toBe('playing')
    expect(store.getState().questions.length).toBe(2)

    const sessionQuestions = store.getState().questions
    const electronIndex = sessionQuestions.findIndex((q) => q.questionId === q1.id)
    const protonIndex = sessionQuestions.findIndex((q) => q.questionId === q2.id)

    // Answer electron question correctly (option 0)
    store.getState().goToQuestion(electronIndex)
    store.getState().selectAnswer(0)

    // Pass time: 5 seconds
    mockTime += 5000

    // Answer proton question incorrectly (option 2, correct is 1)
    store.getState().goToQuestion(protonIndex)
    store.getState().selectAnswer(2)

    // Pass time: 3 seconds
    mockTime += 3000

    // 6. Complete Quiz
    const attemptId = await store.getState().completeQuiz()
    expect(attemptId).toBeTypeOf('number')
    expect(store.getState().phase).toBe('completed')

    // 7. Read persisted data and verify
    const persistedAttempt = await quizRepo.requireAttemptById(attemptId)
    const persistedAnswers = await quizRepo.getAnswersForAttempt(attemptId)

    // Verify derived attempt stats
    expect(persistedAttempt.subjectId).toBe(sub.id)
    expect(persistedAttempt.topicId).toBe(topic.id)
    expect(persistedAttempt.subjectNameSnap).toBe('Integration Physics')
    expect(persistedAttempt.topicNameSnap).toBe('Electrostatics')
    expect(persistedAttempt.totalQuestions).toBe(2)
    expect(persistedAttempt.correctAnswers).toBe(1) // Q1 correct, Q2 incorrect
    expect(persistedAttempt.scorePercentage).toBe(50)
    expect(persistedAttempt.timeTakenSeconds).toBe(8) // 5s + 3s
    expect(persistedAttempt.startedAt).toBe(10000)
    expect(persistedAttempt.completedAt).toBeTypeOf('number')

    // Verify answers and snapshots
    expect(persistedAnswers.length).toBe(2)

    const ans1 = persistedAnswers[0]
    expect(ans1.questionId).toBe(q2.id)
    expect(ans1.selectedOptionIndex).toBe(2)
    expect(ans1.isCorrect).toBe(false)
    expect(ans1.timeTakenSeconds).toBe(3)
    expect(ans1.questionSnapshot.questionText).toBe(q2.questionText)

    const ans2 = persistedAnswers[1]
    expect(ans2.questionId).toBe(q1.id)
    expect(ans2.selectedOptionIndex).toBe(0)
    expect(ans2.isCorrect).toBe(true)
    expect(ans2.timeTakenSeconds).toBe(5)
    expect(ans2.questionSnapshot.questionText).toBe(q1.questionText)
    expect(ans2.questionSnapshot.options).toEqual(q1.options)
    expect(ans2.questionSnapshot.correctOptionIndex).toBe(0)
    expect(ans2.questionSnapshot.explanation).toBe(q1.explanation)
  })
})
