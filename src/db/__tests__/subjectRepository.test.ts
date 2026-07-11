import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDatabase, type QuizDatabase } from '../database'
import { SubjectRepository } from '../repositories/SubjectRepository'
import {
  ValidationError,
  DuplicateNameError,
  NotFoundError
} from '../errors'

describe('SubjectRepository', () => {
  let testDb: QuizDatabase
  let repo: SubjectRepository
  let clockTime: number

  beforeEach(async () => {
    const dbName = `test-subject-repo-${Date.now()}-${Math.random()}`
    testDb = createDatabase(dbName)
    await testDb.open()
    clockTime = 1000
    repo = new SubjectRepository(testDb, () => clockTime)
  })

  afterEach(async () => {
    if (testDb) {
      testDb.close()
      await testDb.delete()
    }
  })

  it('should create a subject with trimmed inputs and derived normalizedName', async () => {
    const subject = await repo.create({
      name: '   Physics Science   ',
      description: '   Study of matter and energy   '
    })

    expect(subject.id).toBeTypeOf('number')
    expect(subject.id).toBeGreaterThan(0)
    expect(subject.name).toBe('Physics Science')
    expect(subject.normalizedName).toBe('physics science')
    expect(subject.description).toBe('Study of matter and energy')
    expect(subject.createdAt).toBe(1000)
    expect(subject.updatedAt).toBe(1000)
  })

  it('should throw ValidationError when input fails creation Zod schema', async () => {
    await expect(repo.create({ name: '   ', description: null })).rejects.toThrow(ValidationError)
  })

  it('should throw DuplicateNameError when a subject name collision occurs (friendly check)', async () => {
    await repo.create({ name: 'Biology', description: null })
    await expect(
      repo.create({ name: '  biology  ', description: 'desc' })
    ).rejects.toThrow(DuplicateNameError)
  })

  it('should translate direct database unique constraint errors to DuplicateNameError', async () => {
    await testDb.subjects.add({
      name: 'Biology',
      normalizedName: 'biology',
      description: null,
      createdAt: clockTime,
      updatedAt: clockTime
    })

    // Circumvent friendly pre-check by mocking lookup to return undefined
    const mockDb = new Proxy(testDb, {
      get(target, prop) {
        if (prop === 'subjects') {
          return new Proxy(target.subjects, {
            get(subTarget, subProp) {
              if (subProp === 'where') {
                return () => ({
                  equals: () => ({
                    first: async () => undefined // simulate no record found to bypass precheck
                  })
                })
              }
              return Reflect.get(subTarget, subProp)
            }
          })
        }
        return Reflect.get(target, prop)
      }
    })

    const mockRepo = new SubjectRepository(mockDb, () => clockTime)
    await expect(mockRepo.create({ name: 'biology', description: null })).rejects.toThrow(DuplicateNameError)
  })

  it('should find a subject using getById and return undefined when missing', async () => {
    const created = await repo.create({ name: 'Math', description: null })

    const found = await repo.getById(created.id)
    expect(found).toEqual(created)

    const missing = await repo.getById(created.id + 999)
    expect(missing).toBeUndefined()
  })

  it('should return subject using requireById and throw NotFoundError when missing', async () => {
    const created = await repo.create({ name: 'Math', description: null })

    const found = await repo.requireById(created.id)
    expect(found).toEqual(created)

    await expect(repo.requireById(created.id + 999)).rejects.toThrow(NotFoundError)
  })

  it('should sort subjects alphabetically by normalizedName and by id as tie-breaker', async () => {
    const s3 = await repo.create({ name: 'Chemistry', description: null })
    const s1 = await repo.create({ name: 'Algebra', description: null })
    const s2 = await repo.create({ name: 'Calculus', description: null })

    const list = await repo.getAll()
    expect(list).toHaveLength(3)
    expect(list[0].id).toBe(s1.id) // Algebra
    expect(list[1].id).toBe(s2.id) // Calculus
    expect(list[2].id).toBe(s3.id) // Chemistry
  })

  it('should update mutable fields, preserve createdAt, update updatedAt, and handle duplicates excluding current record', async () => {
    const created = await repo.create({ name: 'Original', description: 'Original description' })
    clockTime = 2000

    const updated = await repo.update(created.id, {
      name: 'Updated Name',
      description: null // clears description
    })

    expect(updated.id).toBe(created.id)
    expect(updated.name).toBe('Updated Name')
    expect(updated.normalizedName).toBe('updated name')
    expect(updated.description).toBeNull()
    expect(updated.createdAt).toBe(1000)
    expect(updated.updatedAt).toBe(2000)

    // Omitted field remains unchanged
    const updated2 = await repo.update(created.id, {
      name: 'Name Changed Again'
    })
    expect(updated2.description).toBeNull() // remains null

    // Duplicate check on update
    await repo.create({ name: 'Conflict Subject', description: null })
    await expect(
      repo.update(created.id, { name: 'conflict subject' })
    ).rejects.toThrow(DuplicateNameError)

    // Updating non-existent Subject throws NotFoundError
    await expect(
      repo.update(created.id + 999, { name: 'New Name' })
    ).rejects.toThrow(NotFoundError)
  })

  it('should execute cascading deletes inside a single transaction and preserve history snapshots', async () => {
    // 1. Setup entities
    const s1 = await repo.create({ name: 'Biology', description: null })
    const s2 = await repo.create({ name: 'Unrelated Biology', description: null })

    // Add Topics
    const t1Id = await testDb.topics.add({ subjectId: s1.id, name: 'Cells', normalizedName: 'cells', createdAt: 1000 })
    const t2Id = await testDb.topics.add({ subjectId: s1.id, name: 'Genetics', normalizedName: 'genetics', createdAt: 1000 })
    const tUnrelatedId = await testDb.topics.add({ subjectId: s2.id, name: 'Plants', normalizedName: 'plants', createdAt: 1000 })

    // Add Questions
    const q1Id = await testDb.questions.add({
      subjectId: s1.id,
      topicId: t1Id,
      questionText: 'Q1',
      options: ['A', 'B'],
      correctOptionIndex: 0,
      explanation: null,
      difficulty: 'easy',
      bookmarkStatus: 0,
      createdAt: 1000,
      updatedAt: 1000
    })
    const qUnrelatedId = await testDb.questions.add({
      subjectId: s2.id,
      topicId: tUnrelatedId,
      questionText: 'QUnrelated',
      options: ['C', 'D'],
      correctOptionIndex: 1,
      explanation: null,
      difficulty: 'medium',
      bookmarkStatus: 0,
      createdAt: 1000,
      updatedAt: 1000
    })

    // Add QuizAttempts
    const attempt1Id = await testDb.quizAttempts.add({
      subjectId: s1.id,
      topicId: t1Id,
      mode: 'practice',
      totalQuestions: 1,
      correctAnswers: 1,
      scorePercentage: 100,
      timeTakenSeconds: 10,
      startedAt: 1000,
      completedAt: 1000,
      subjectNameSnap: 'Biology',
      topicNameSnap: 'Cells'
    })

    const attemptUnrelatedId = await testDb.quizAttempts.add({
      subjectId: s2.id,
      topicId: tUnrelatedId,
      mode: 'practice',
      totalQuestions: 1,
      correctAnswers: 1,
      scorePercentage: 100,
      timeTakenSeconds: 10,
      startedAt: 1000,
      completedAt: 1000,
      subjectNameSnap: 'Unrelated Biology',
      topicNameSnap: 'Plants'
    })

    // Add AnswerAttempts
    await testDb.answerAttempts.bulkAdd([
      {
        quizAttemptId: attempt1Id,
        questionId: q1Id,
        selectedOptionIndex: 0,
        correctOptionIndex: 0,
        isCorrect: true,
        timeTakenSeconds: 10,
        questionSnapshot: { questionText: 'Q1', options: ['A', 'B'], correctOptionIndex: 0, explanation: null, difficulty: 'easy' }
      },
      {
        quizAttemptId: attemptUnrelatedId,
        questionId: qUnrelatedId,
        selectedOptionIndex: 1,
        correctOptionIndex: 1,
        isCorrect: true,
        timeTakenSeconds: 10,
        questionSnapshot: { questionText: 'QUnrelated', options: ['C', 'D'], correctOptionIndex: 1, explanation: null, difficulty: 'medium' }
      }
    ])

    // 2. Perform cascade delete
    await repo.delete(s1.id)

    // 3. Verify assertions
    // Subject s1 is deleted
    await expect(repo.getById(s1.id)).resolves.toBeUndefined()

    // Related Topics are deleted
    await expect(testDb.topics.get(t1Id)).resolves.toBeUndefined()
    await expect(testDb.topics.get(t2Id)).resolves.toBeUndefined()

    // Related Questions are deleted
    await expect(testDb.questions.get(q1Id)).resolves.toBeUndefined()

    // Unrelated records are untouched
    await expect(repo.getById(s2.id)).resolves.toBeDefined()
    await expect(testDb.topics.get(tUnrelatedId)).resolves.toBeDefined()
    await expect(testDb.questions.get(qUnrelatedId)).resolves.toBeDefined()

    // Historical attempt1 subjectId/topicId are nullified but snapshots remain
    const attempt1 = await testDb.quizAttempts.get(attempt1Id)
    expect(attempt1).toBeDefined()
    expect(attempt1?.subjectId).toBeNull()
    expect(attempt1?.topicId).toBeNull()
    expect(attempt1?.subjectNameSnap).toBe('Biology')
    expect(attempt1?.topicNameSnap).toBe('Cells')

    // Historical unrelated attempt remains untouched
    const attemptUnrelated = await testDb.quizAttempts.get(attemptUnrelatedId)
    expect(attemptUnrelated?.subjectId).toBe(s2.id)
    expect(attemptUnrelated?.topicId).toBe(tUnrelatedId)

    // Historical answerAttempt questionId is nullified but snapshot remains
    const answers = await testDb.answerAttempts.where('quizAttemptId').equals(attempt1Id).toArray()
    expect(answers).toHaveLength(1)
    expect(answers[0].questionId).toBeNull()
    expect(answers[0].questionSnapshot.questionText).toBe('Q1')

    // Unrelated answer attempt remains untouched
    const unrelatedAnswers = await testDb.answerAttempts.where('quizAttemptId').equals(attemptUnrelatedId).toArray()
    expect(unrelatedAnswers).toHaveLength(1)
    expect(unrelatedAnswers[0].questionId).toBe(qUnrelatedId)

    // Deleting missing Subject throws NotFoundError
    await expect(repo.delete(s1.id)).rejects.toThrow(NotFoundError)
  })
})
