import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDatabase, type QuizDatabase } from '../database'
import { TopicRepository } from '../repositories/TopicRepository'
import {
  ValidationError,
  DuplicateNameError,
  NotFoundError,
  InvalidRelationshipError
} from '../errors'

describe('TopicRepository', () => {
  let testDb: QuizDatabase
  let repo: TopicRepository
  let clockTime: number
  let subjectId: number

  beforeEach(async () => {
    const dbName = `test-topic-repo-${Date.now()}-${Math.random()}`
    testDb = createDatabase(dbName)
    await testDb.open()
    clockTime = 1000
    repo = new TopicRepository(testDb, () => clockTime)

    // Setup default parent subject for tests
    subjectId = await testDb.subjects.add({
      name: 'Biology',
      normalizedName: 'biology',
      description: null,
      createdAt: 1000,
      updatedAt: 1000
    })
  })

  afterEach(async () => {
    if (testDb) {
      testDb.close()
      await testDb.delete()
    }
  })

  it('should create a topic under a valid parent subject', async () => {
    const topic = await repo.create({
      subjectId,
      name: '   Photosynthesis   '
    })

    expect(topic.id).toBeTypeOf('number')
    expect(topic.id).toBeGreaterThan(0)
    expect(topic.subjectId).toBe(subjectId)
    expect(topic.name).toBe('Photosynthesis')
    expect(topic.normalizedName).toBe('photosynthesis')
    expect(topic.createdAt).toBe(1000)
  })

  it('should throw ValidationError when input fails creation schema', async () => {
    await expect(repo.create({ subjectId, name: '   ' })).rejects.toThrow(ValidationError)
  })

  it('should throw InvalidRelationshipError when parent subjectId does not exist', async () => {
    await expect(
      repo.create({ subjectId: subjectId + 999, name: 'Cells' })
    ).rejects.toThrow(InvalidRelationshipError)
  })

  it('should throw DuplicateNameError when topic name conflicts within the same subject', async () => {
    await repo.create({ subjectId, name: 'Cells' })
    await expect(
      repo.create({ subjectId, name: '  cells  ' })
    ).rejects.toThrow(DuplicateNameError)
  })

  it('should allow same normalized topic name under different subjects', async () => {
    const anotherSubjectId = await testDb.subjects.add({
      name: 'Chemistry',
      normalizedName: 'chemistry',
      description: null,
      createdAt: 1000,
      updatedAt: 1000
    })

    const t1 = await repo.create({ subjectId, name: 'Inorganic' })
    const t2 = await repo.create({ subjectId: anotherSubjectId, name: 'Inorganic' })

    expect(t1.id).not.toBe(t2.id)
    expect(t1.normalizedName).toBe(t2.normalizedName)
  })

  it('should translate direct compound database constraints to DuplicateNameError', async () => {
    await testDb.topics.add({
      subjectId,
      name: 'Ecology',
      normalizedName: 'ecology',
      createdAt: clockTime
    })

    // Bypass friendly check by proxying lookup
    const mockDb = new Proxy(testDb, {
      get(target, prop) {
        if (prop === 'topics') {
          return new Proxy(target.topics, {
            get(subTarget, subProp) {
              if (subProp === 'where') {
                return () => ({
                  equals: () => ({
                    first: async () => undefined
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

    const mockRepo = new TopicRepository(mockDb, () => clockTime)
    await expect(mockRepo.create({ subjectId, name: 'ecology' })).rejects.toThrow(DuplicateNameError)
  })

  it('should retrieve topic using getById and requireById', async () => {
    const created = await repo.create({ subjectId, name: 'Cells' })

    const found = await repo.getById(created.id)
    expect(found).toEqual(created)

    await expect(repo.requireById(created.id)).resolves.toEqual(created)
    await expect(repo.requireById(created.id + 999)).rejects.toThrow(NotFoundError)
  })

  it('should sort topics alphabetically by normalizedName and by id as tie-breaker', async () => {
    const t3 = await repo.create({ subjectId, name: 'Genetics' })
    const t1 = await repo.create({ subjectId, name: 'Cells' })
    const t2 = await repo.create({ subjectId, name: 'Ecology' })

    const list = await repo.getBySubject(subjectId)
    expect(list).toHaveLength(3)
    expect(list[0].id).toBe(t1.id) // Cells
    expect(list[1].id).toBe(t2.id) // Ecology
    expect(list[2].id).toBe(t3.id) // Genetics
  })

  it('should throw ValidationError if getBySubject receives an invalid subjectId', async () => {
    await expect(repo.getBySubject(-5)).rejects.toThrow(ValidationError)
  })

  it('should update topic fields, keep subjectId immutable, preserve createdAt, and handle duplicate name updates', async () => {
    const created = await repo.create({ subjectId, name: 'Old Name' })

    const updated = await repo.update(created.id, {
      name: 'New Name'
    })

    expect(updated.id).toBe(created.id)
    expect(updated.name).toBe('New Name')
    expect(updated.subjectId).toBe(subjectId) // immutable
    expect(updated.createdAt).toBe(1000) // preserved

    // Duplicate check on update
    await repo.create({ subjectId, name: 'Conflict Topic' })
    await expect(
      repo.update(created.id, { name: 'conflict topic' })
    ).rejects.toThrow(DuplicateNameError)

    // Updating missing topic throws NotFoundError
    await expect(
      repo.update(created.id + 999, { name: 'Name' })
    ).rejects.toThrow(NotFoundError)
  })

  it('should execute Topic delete transaction, reassign Questions and QuizAttempts, and preserve history', async () => {
    const topic = await repo.create({ subjectId, name: 'Ecology' })

    // Add related Question
    const qId = await testDb.questions.add({
      subjectId,
      topicId: topic.id,
      questionText: 'Q1',
      options: ['A', 'B'],
      correctOptionIndex: 0,
      explanation: null,
      difficulty: 'easy',
      bookmarkStatus: 0,
      createdAt: 1000,
      updatedAt: 1000
    })

    // Add related QuizAttempt
    const attemptId = await testDb.quizAttempts.add({
      subjectId,
      topicId: topic.id,
      mode: 'practice',
      totalQuestions: 1,
      correctAnswers: 1,
      scorePercentage: 100,
      timeTakenSeconds: 10,
      startedAt: 1000,
      completedAt: 1000,
      subjectNameSnap: 'Biology',
      topicNameSnap: 'Ecology'
    })

    // Perform Topic delete
    await repo.delete(topic.id)

    // Assert Topic is removed
    await expect(repo.getById(topic.id)).resolves.toBeUndefined()

    // Assert Question topicId is nullified but remains in DB
    const question = await testDb.questions.get(qId)
    expect(question).toBeDefined()
    expect(question?.topicId).toBeNull()

    // Assert QuizAttempt topicId is nullified but snapshots remain
    const attempt = await testDb.quizAttempts.get(attemptId)
    expect(attempt).toBeDefined()
    expect(attempt?.topicId).toBeNull()
    expect(attempt?.subjectId).toBe(subjectId)
    expect(attempt?.topicNameSnap).toBe('Ecology')

    // Deleting missing Topic throws NotFoundError
    await expect(repo.delete(topic.id)).rejects.toThrow(NotFoundError)
  })
})
