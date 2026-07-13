import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../database'
import { QuizRepository } from '../repositories/QuizRepository'
import { SubjectRepository } from '../repositories/SubjectRepository'
import { TopicRepository } from '../repositories/TopicRepository'
import { QuestionRepository } from '../repositories/QuestionRepository'
import { type QuizAttemptSessionSaveInput } from '../../types/db'

describe('QuizRepository.getMistakeProjections', () => {
  let quizRepo: QuizRepository
  let subjectId: number
  let topicId: number
  let q1Id: number
  let q2Id: number
  let q3Id: number

  beforeEach(async () => {
    // Reset database
    await db.transaction('rw', db.questions, db.topics, db.subjects, db.quizAttempts, db.answerAttempts, async () => {
      await db.questions.clear()
      await db.topics.clear()
      await db.subjects.clear()
      await db.quizAttempts.clear()
      await db.answerAttempts.clear()
    })

    quizRepo = new QuizRepository(db)
    const subjectRepo = new SubjectRepository(db)
    const topicRepo = new TopicRepository(db)
    const questionRepo = new QuestionRepository(db)

    const s1 = await subjectRepo.create({ name: 'Subject 1', description: 'Test Subject' })
    subjectId = s1.id

    const topic = await topicRepo.create({ subjectId, name: 'Topic 1' })
    topicId = topic.id

    const q1 = await questionRepo.create({
      subjectId, topicId, questionText: 'Q1', options: ['A', 'B'], correctOptionIndex: 0, difficulty: 'easy', explanation: 'e'
    })
    q1Id = q1.id

    const q2 = await questionRepo.create({
      subjectId, topicId, questionText: 'Q2', options: ['A', 'B'], correctOptionIndex: 0, difficulty: 'medium', explanation: 'e'
    })
    q2Id = q2.id

    const q3 = await questionRepo.create({
      subjectId, topicId, questionText: 'Q3', options: ['A', 'B'], correctOptionIndex: 0, difficulty: 'hard', explanation: 'e'
    })
    q3Id = q3.id
  })

  const createAttempt = async (startedAt: number, answers: Array<{ questionId: number, isCorrect: boolean, skipped?: boolean }>) => {
    const input: QuizAttemptSessionSaveInput = {
      subjectId,
      topicId,
      subjectNameSnap: 'Subject 1',
      topicNameSnap: 'Topic 1',
      mode: 'practice',
      startedAt,
      answers: answers.map(a => ({
        questionId: a.questionId,
        selectedOptionIndex: a.skipped ? null : (a.isCorrect ? 0 : 1),
        timeTakenSeconds: 5,
        questionSnapshot: {
          questionText: 'Q',
          options: ['A', 'B'],
          correctOptionIndex: 0,
          explanation: null,
          difficulty: 'easy'
        }
      }))
    }
    // We hack the clock to ensure completions have stable order
    const realRepo = new QuizRepository(db, () => startedAt + 10)
    return realRepo.save(input)
  }

  it('identifies latest skipped and incorrect as active mistakes', async () => {
    await createAttempt(1000, [
      { questionId: q1Id, isCorrect: false },
      { questionId: q2Id, isCorrect: false, skipped: true },
      { questionId: q3Id, isCorrect: true }
    ])

    const projections = await quizRepo.getMistakeProjections()
    expect(projections).toHaveLength(2)

    const q1Proj = projections.find(p => p.answerAttempt.questionId === q1Id)
    expect(q1Proj?.kind).toBe('active')
    expect(q1Proj?.wasSkipped).toBe(false)

    const q2Proj = projections.find(p => p.answerAttempt.questionId === q2Id)
    expect(q2Proj?.kind).toBe('active')
    expect(q2Proj?.wasSkipped).toBe(true)
  })

  it('excludes resolved questions where latest is correct', async () => {
    // Attempt 1: Q1 wrong
    await createAttempt(1000, [{ questionId: q1Id, isCorrect: false }])

    let projections = await quizRepo.getMistakeProjections()
    expect(projections).toHaveLength(1)

    // Attempt 2: Q1 correct
    await createAttempt(2000, [{ questionId: q1Id, isCorrect: true }])

    projections = await quizRepo.getMistakeProjections()
    expect(projections).toHaveLength(0) // Resolved!
  })

  it('keeps active if wrong again after correct', async () => {
    await createAttempt(1000, [{ questionId: q1Id, isCorrect: true }])
    await createAttempt(2000, [{ questionId: q1Id, isCorrect: false }])

    const projections = await quizRepo.getMistakeProjections()
    expect(projections).toHaveLength(1)
    expect(projections[0].kind).toBe('active')
  })

  it('treats deleted questions as deleted-history', async () => {
    await createAttempt(1000, [{ questionId: q1Id, isCorrect: false }])

    await db.transaction('rw', db.questions, db.answerAttempts, async () => {
      await db.questions.delete(q1Id)
      // Subject delete trigger normally does this
      await db.answerAttempts.where('questionId').equals(q1Id).modify({ questionId: null })
    })

    const projections = await quizRepo.getMistakeProjections()
    expect(projections).toHaveLength(1)
    expect(projections[0].kind).toBe('deleted-history')
    expect(projections[0].answerAttempt.questionId).toBeNull()
  })

  it('filters by subject and topic', async () => {
    const subjectRepo = new SubjectRepository(db)
    const topicRepo = new TopicRepository(db)
    const questionRepo = new QuestionRepository(db)

    const s2 = await subjectRepo.create({ name: 'S2', description: 'desc2' })
    const t2 = await topicRepo.create({ subjectId: s2.id, name: 'T2' })
    const q4 = await questionRepo.create({ subjectId: s2.id, topicId: t2.id, questionText: 'Q4', options: ['A', 'B'], correctOptionIndex: 0, difficulty: 'easy', explanation: 'e' })

    await createAttempt(1000, [{ questionId: q1Id, isCorrect: false }])

    const inputS2: QuizAttemptSessionSaveInput = {
      subjectId: s2.id,
      topicId: t2.id,
      subjectNameSnap: 'S2',
      topicNameSnap: 'T2',
      mode: 'practice',
      startedAt: 2000,
      answers: [{
        questionId: q4.id,
        selectedOptionIndex: 1,
        timeTakenSeconds: 5,
        questionSnapshot: { questionText: 'Q4', options: ['A', 'B'], correctOptionIndex: 0, explanation: null, difficulty: 'easy' }
      }]
    }
    await quizRepo.save(inputS2)

    let p = await quizRepo.getMistakeProjections({ subjectId: s2.id })
    expect(p).toHaveLength(1)
    expect(p[0].answerAttempt.questionId).toBe(q4.id)

    p = await quizRepo.getMistakeProjections({ subjectId })
    expect(p).toHaveLength(1)
    expect(p[0].answerAttempt.questionId).toBe(q1Id)

    p = await quizRepo.getMistakeProjections({ subjectId, topicId: 999 })
    expect(p).toHaveLength(0)
  })
})
