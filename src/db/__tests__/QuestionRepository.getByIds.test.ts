import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../database'
import { QuestionRepository } from '../repositories/QuestionRepository'
import { SubjectRepository } from '../repositories/SubjectRepository'
import { TopicRepository } from '../repositories/TopicRepository'

describe('QuestionRepository.getByIds', () => {
  let questionRepo: QuestionRepository
  let subjectId: number
  let topicId: number

  beforeEach(async () => {
    // Reset database
    await db.transaction('rw', db.questions, db.topics, db.subjects, db.quizAttempts, db.answerAttempts, async () => {
      await db.questions.clear()
      await db.topics.clear()
      await db.subjects.clear()
      await db.quizAttempts.clear()
      await db.answerAttempts.clear()
    })

    questionRepo = new QuestionRepository(db)
    const subjectRepo = new SubjectRepository(db)
    const topicRepo = new TopicRepository(db)

    const subject = await subjectRepo.create({ name: 'Subject 1', description: 'Test Subject' })
    subjectId = subject.id

    const topic = await topicRepo.create({ subjectId, name: 'Test Topic' })
    topicId = topic.id
  })

  it('returns existing questions and skips missing IDs', async () => {
    const q1 = await questionRepo.create({
      subjectId,
      topicId,
      questionText: 'Q1',
      options: ['A', 'B'],
      correctOptionIndex: 0,
      difficulty: 'easy',
      explanation: 'e'
    })
    const q2 = await questionRepo.create({
      subjectId, topicId, questionText: 'Q2', options: ['A', 'B'], correctOptionIndex: 0, difficulty: 'medium', explanation: 'e'
    })

    const results = await questionRepo.getByIds([q1.id, 9999, q2.id])
    
    expect(results).toHaveLength(2)
    expect(results.map(r => r.id)).toEqual(expect.arrayContaining([q1.id, q2.id]))
  })

  it('returns empty array for empty input', async () => {
    const results = await questionRepo.getByIds([])
    expect(results).toHaveLength(0)
  })

  it('handles duplicate IDs gracefully', async () => {
    const q1 = await questionRepo.create({
      subjectId,
      topicId,
      questionText: 'Q1',
      options: ['A', 'B'],
      correctOptionIndex: 0,
      difficulty: 'easy',
      explanation: 'e'
    })

    const results = await questionRepo.getByIds([q1.id, q1.id])
    // bulkGet returns duplicates if requested
    expect(results).toHaveLength(2)
    expect(results[0].id).toBe(q1.id)
    expect(results[1].id).toBe(q1.id)
  })
})
