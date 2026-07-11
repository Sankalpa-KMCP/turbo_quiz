import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDatabase, type QuizDatabase } from '../database'
import { QuestionRepository, type TopicFilter, type QuestionSearchFilter } from '../repositories/QuestionRepository'
import {
  ValidationError,
  NotFoundError,
  InvalidRelationshipError
} from '../errors'
import { type QuestionUpdateInput, type Question, type Difficulty, type BookmarkStatus } from '../../types/db'

describe('QuestionRepository', () => {
  let testDb: QuizDatabase
  let repo: QuestionRepository
  let clockTime: number
  let subjectId: number
  let topicId: number

  beforeEach(async () => {
    const dbName = `test-question-repo-${Date.now()}-${Math.random()}`
    testDb = createDatabase(dbName)
    await testDb.open()
    clockTime = 1000
    repo = new QuestionRepository(testDb, () => clockTime)

    // Setup base subject and topic
    subjectId = await testDb.subjects.add({
      name: 'Biology',
      normalizedName: 'biology',
      description: null,
      createdAt: 1000,
      updatedAt: 1000
    })

    topicId = await testDb.topics.add({
      subjectId,
      name: 'Cells',
      normalizedName: 'cells',
      createdAt: 1000
    })
  })

  afterEach(async () => {
    if (testDb) {
      testDb.close()
      await testDb.delete()
    }
  })

  describe('Creation', () => {
    it('should create a valid categorized question with derived and clock fields', async () => {
      const q = await repo.create({
        subjectId,
        topicId,
        questionText: '   What is a cell?   ',
        options: ['   option A   ', '   option B   ', '   option C   '],
        correctOptionIndex: 1,
        explanation: '   Explanation text   ',
        difficulty: 'easy' as const,
        bookmarkStatus: 1
      })

      expect(q.id).toBeTypeOf('number')
      expect(q.id).toBeGreaterThan(0)
      expect(q.subjectId).toBe(subjectId)
      expect(q.topicId).toBe(topicId)
      expect(q.questionText).toBe('What is a cell?')
      expect(q.options).toEqual(['option A', 'option B', 'option C'])
      expect(q.correctOptionIndex).toBe(1)
      expect(q.explanation).toBe('Explanation text')
      expect(q.difficulty).toBe('easy')
      expect(q.bookmarkStatus).toBe(1)
      expect(q.createdAt).toBe(1000)
      expect(q.updatedAt).toBe(1000)
    })

    it('should create a valid uncategorized question with topicId null', async () => {
      const q = await repo.create({
        subjectId,
        topicId: null,
        questionText: 'Genetics questionText',
        options: ['option X', 'option Y'],
        correctOptionIndex: 0,
        explanation: null,
        difficulty: 'medium' as const
      })

      expect(q.topicId).toBeNull()
      expect(q.bookmarkStatus).toBe(0) // defaults to 0
    })

    it('should verify options array is defensively copied', async () => {
      const originalOptions = ['One', 'Two']
      const q = await repo.create({
        subjectId,
        topicId: null,
        questionText: 'QuestionText',
        options: originalOptions,
        correctOptionIndex: 0,
        explanation: null,
        difficulty: 'easy' as const
      })

      expect(q.options).not.toBe(originalOptions) // different array references
    })

    it('should throw ValidationError on options count bounds', async () => {
      const inputTooFew = {
        subjectId,
        topicId: null,
        questionText: 'Question',
        options: ['Only One Option'],
        correctOptionIndex: 0,
        explanation: null,
        difficulty: 'easy' as const
      }

      const inputTooMany = {
        subjectId,
        topicId: null,
        questionText: 'Question',
        options: ['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7'],
        correctOptionIndex: 0,
        explanation: null,
        difficulty: 'easy' as const
      }

      await expect(repo.create(inputTooFew)).rejects.toThrow(ValidationError)
      await expect(repo.create(inputTooMany)).rejects.toThrow(ValidationError)
    })

    it('should throw ValidationError on empty option strings', async () => {
      const input = {
        subjectId,
        topicId: null,
        questionText: 'Question',
        options: ['Option 1', '   '],
        correctOptionIndex: 0,
        explanation: null,
        difficulty: 'easy' as const
      }
      await expect(repo.create(input)).rejects.toThrow(ValidationError)
    })

    it('should throw ValidationError on duplicate options after normalization', async () => {
      const input = {
        subjectId,
        topicId: null,
        questionText: 'Question',
        options: ['Cells', '  cells  '],
        correctOptionIndex: 0,
        explanation: null,
        difficulty: 'easy' as const
      }
      await expect(repo.create(input)).rejects.toThrow(ValidationError)
    })

    it('should throw ValidationError on correct option index boundary checks', async () => {
      const input = {
        subjectId,
        topicId: null,
        questionText: 'Question',
        options: ['A', 'B'],
        correctOptionIndex: 2, // invalid index
        explanation: null,
        difficulty: 'easy' as const
      }
      await expect(repo.create(input)).rejects.toThrow(ValidationError)
    })

    it('should throw InvalidRelationshipError when parent subjectId does not exist', async () => {
      const input = {
        subjectId: subjectId + 999,
        topicId: null,
        questionText: 'Question text',
        options: ['A', 'B'],
        correctOptionIndex: 0,
        explanation: null,
        difficulty: 'easy' as const
      }
      await expect(repo.create(input)).rejects.toThrow(InvalidRelationshipError)
    })

    it('should throw InvalidRelationshipError when topicId does not exist', async () => {
      const input = {
        subjectId,
        topicId: topicId + 999,
        questionText: 'Question text',
        options: ['A', 'B'],
        correctOptionIndex: 0,
        explanation: null,
        difficulty: 'easy' as const
      }
      await expect(repo.create(input)).rejects.toThrow(InvalidRelationshipError)
    })

    it('should throw InvalidRelationshipError when topicId belongs to another subject', async () => {
      const otherSubjectId = await testDb.subjects.add({
        name: 'Chemistry',
        normalizedName: 'chemistry',
        description: null,
        createdAt: 1000,
        updatedAt: 1000
      })

      const otherTopicId = await testDb.topics.add({
        subjectId: otherSubjectId,
        name: 'Organic',
        normalizedName: 'organic',
        createdAt: 1000
      })

      const input = {
        subjectId,
        topicId: otherTopicId,
        questionText: 'Question text',
        options: ['A', 'B'],
        correctOptionIndex: 0,
        explanation: null,
        difficulty: 'easy' as const
      }
      await expect(repo.create(input)).rejects.toThrow(InvalidRelationshipError)
    })
  })

  describe('Reads', () => {
    it('should lookup question by getById and requireById', async () => {
      const created = await repo.create({
        subjectId,
        topicId,
        questionText: 'Query me',
        options: ['A', 'B'],
        correctOptionIndex: 0,
        explanation: null,
        difficulty: 'easy' as const
      })

      const found = await repo.getById(created.id)
      expect(found).toEqual(created)

      const required = await repo.requireById(created.id)
      expect(required).toEqual(created)

      const missing = await repo.getById(created.id + 999)
      expect(missing).toBeUndefined()

      await expect(repo.requireById(created.id + 999)).rejects.toThrow(NotFoundError)
    })
  })

  describe('Updates', () => {
    let createdId: number

    beforeEach(async () => {
      const q = await repo.create({
        subjectId,
        topicId,
        questionText: 'Original text',
        options: ['Opt A', 'Opt B'],
        correctOptionIndex: 0,
        explanation: 'Original explanation',
        difficulty: 'easy' as const,
        bookmarkStatus: 0
      })
      createdId = q.id
      clockTime = 2000
    })

    it('should update questionText only', async () => {
      const updated = await repo.update(createdId, {
        questionText: 'New text'
      })

      expect(updated.questionText).toBe('New text')
      expect(updated.options).toEqual(['Opt A', 'Opt B'])
      expect(updated.correctOptionIndex).toBe(0)
      expect(updated.createdAt).toBe(1000)
      expect(updated.updatedAt).toBe(2000)
    })

    it('should update options only keeping correct index valid', async () => {
      const updated = await repo.update(createdId, {
        options: ['New A', 'New B', 'New C']
      })
      expect(updated.options).toEqual(['New A', 'New B', 'New C'])
      expect(updated.correctOptionIndex).toBe(0)
    })

    it('should update correctOptionIndex only keeping options valid', async () => {
      const updated = await repo.update(createdId, {
        correctOptionIndex: 1
      })
      expect(updated.correctOptionIndex).toBe(1)
    })

    it('should update options and correct index together', async () => {
      const updated = await repo.update(createdId, {
        options: ['X', 'Y', 'Z'],
        correctOptionIndex: 2
      })
      expect(updated.options).toEqual(['X', 'Y', 'Z'])
      expect(updated.correctOptionIndex).toBe(2)
    })

    it('should throw ValidationError if correct index is updated beyond options size', async () => {
      await expect(
        repo.update(createdId, { correctOptionIndex: 5 })
      ).rejects.toThrow(ValidationError)
    })

    it('should throw ValidationError if options are updated and invalidate current correct index', async () => {
      // Current index is 1 after this:
      await repo.update(createdId, { correctOptionIndex: 1 })

      await repo.update(createdId, {
        options: ['A', 'B', 'C'],
        correctOptionIndex: 2
      })

      // Now options are ['A', 'B', 'C'] and correct index is 2.
      // Now update options to size 2. The index 2 will become invalid!
      await expect(
        repo.update(createdId, { options: ['X', 'Y'] })
      ).rejects.toThrow(ValidationError)
    })

    it('should allow transitioning topicId to null', async () => {
      const updated = await repo.update(createdId, { topicId: null })
      expect(updated.topicId).toBeNull()
    })

    it('should allow transitioning topicId to another valid topic in same subject', async () => {
      const newTopicId = await testDb.topics.add({
        subjectId,
        name: 'Genetics',
        normalizedName: 'genetics',
        createdAt: 1000
      })

      const updated = await repo.update(createdId, { topicId: newTopicId })
      expect(updated.topicId).toBe(newTopicId)
    })

    it('should throw InvalidRelationshipError if topicId does not exist', async () => {
      await expect(
        repo.update(createdId, { topicId: topicId + 999 })
      ).rejects.toThrow(InvalidRelationshipError)
    })

    it('should throw InvalidRelationshipError if topicId belongs to another subject', async () => {
      const otherSubjectId = await testDb.subjects.add({
        name: 'Chemistry',
        normalizedName: 'chemistry',
        description: null,
        createdAt: 1000,
        updatedAt: 1000
      })
      const otherTopicId = await testDb.topics.add({
        subjectId: otherSubjectId,
        name: 'Organic',
        normalizedName: 'organic',
        createdAt: 1000
      })

      await expect(
        repo.update(createdId, { topicId: otherTopicId })
      ).rejects.toThrow(InvalidRelationshipError)
    })

    it('should reject attempted subjectId changes and throw ValidationError', async () => {
      await expect(
        repo.update(createdId, { subjectId: subjectId + 1 })
      ).rejects.toThrow(ValidationError)
    })

    it('should accept update with same subjectId', async () => {
      const updated = await repo.update(createdId, { subjectId, questionText: 'Same subject' })
      expect(updated.questionText).toBe('Same subject')
    })

    it('should handle explanation null updates', async () => {
      const updated = await repo.update(createdId, { explanation: null })
      expect(updated.explanation).toBeNull()
    })

    it('should verify options array copy on update', async () => {
      const freshOpts = ['One', 'Two']
      const updated = await repo.update(createdId, { options: freshOpts })
      expect(updated.options).not.toBe(freshOpts)
    })

    it('should throw ValidationError on empty update payload', async () => {
      await expect(repo.update(createdId, {}))
        .rejects.toThrow(ValidationError)
    })

    it('should throw ValidationError on unknown fields', async () => {
      await expect(
        repo.update(createdId, { invalidField: 'test' } as unknown as QuestionUpdateInput)
      ).rejects.toThrow(ValidationError)
    })

    it('should throw NotFoundError if question is missing', async () => {
      await expect(
        repo.update(createdId + 999, { questionText: 'Miss' })
      ).rejects.toThrow(NotFoundError)
    })
  })

  describe('Bookmark Toggling', () => {
    it('should toggle bookmark status and preserve other fields', async () => {
      const created = await repo.create({
        subjectId,
        topicId,
        questionText: 'Toggle me',
        options: ['A', 'B'],
        correctOptionIndex: 0,
        explanation: 'exp',
        difficulty: 'hard' as const,
        bookmarkStatus: 0
      })

      clockTime = 2000
      const t1 = await repo.toggleBookmark(created.id)
      expect(t1.bookmarkStatus).toBe(1)
      expect(t1.createdAt).toBe(1000)
      expect(t1.updatedAt).toBe(2000)
      expect(t1.questionText).toBe('Toggle me')
      expect(t1.options).toEqual(['A', 'B'])

      clockTime = 3000
      const t2 = await repo.toggleBookmark(created.id)
      expect(t2.bookmarkStatus).toBe(0)
      expect(t2.updatedAt).toBe(3000)

      await expect(repo.toggleBookmark(created.id + 999)).rejects.toThrow(NotFoundError)
    })
  })

  describe('Search', () => {
    let otherSubjectId: number
    let otherTopicId: number
    let q1: Question
    let q2: Question
    let q3: Question
    let q4: Question

    beforeEach(async () => {
      otherSubjectId = await testDb.subjects.add({
        name: 'Chemistry',
        normalizedName: 'chemistry',
        description: null,
        createdAt: 1000,
        updatedAt: 1000
      })

      otherTopicId = await testDb.topics.add({
        subjectId: otherSubjectId,
        name: 'Organic',
        normalizedName: 'organic',
        createdAt: 1000
      })

      clockTime = 1000
      q1 = await repo.create({
        subjectId,
        topicId,
        questionText: 'What is Cell membrane?',
        options: ['lipid bilayer', 'protein channel'],
        correctOptionIndex: 0,
        explanation: 'Membrane structure explanation',
        difficulty: 'easy',
        bookmarkStatus: 1
      })

      clockTime = 1100
      q2 = await repo.create({
        subjectId,
        topicId: null,
        questionText: 'Define genetics and DNA.',
        options: ['Gene info', 'Nucleotides'],
        correctOptionIndex: 1,
        explanation: null,
        difficulty: 'medium',
        bookmarkStatus: 0
      })

      clockTime = 900
      q3 = await repo.create({
        subjectId,
        topicId,
        questionText: 'Mitochondria function?',
        options: ['Powerhouse of cells', 'Protein factory'],
        correctOptionIndex: 0,
        explanation: 'Mitochondria description',
        difficulty: 'hard',
        bookmarkStatus: 1
      })

      clockTime = 1200
      q4 = await repo.create({
        subjectId: otherSubjectId,
        topicId: otherTopicId,
        questionText: 'Organic molecule structure?',
        options: ['Carbon-based', 'Silicate-based'],
        correctOptionIndex: 0,
        explanation: 'Organic compounds chemistry',
        difficulty: 'easy',
        bookmarkStatus: 1
      })
    })

    it('should return all questions for a subject when topicFilter is omitted or set to all', async () => {
      const res1 = await repo.search({ subjectId })
      expect(res1.map(q => q.id)).toEqual([q2.id, q1.id, q3.id])
      expect(res1.map(q => q.id)).not.toContain(q4.id)

      const res2 = await repo.search({ subjectId, topicFilter: { kind: 'all' } })
      expect(res2.map(q => q.id)).toEqual([q2.id, q1.id, q3.id])
      expect(res2.map(q => q.id)).not.toContain(q4.id)
    })

    it('should filter by specific topic and exclude other topics', async () => {
      const res = await repo.search({ subjectId, topicFilter: { kind: 'topic', topicId } })
      expect(res.map(q => q.id)).toEqual([q1.id, q3.id])
    })

    it('should filter uncategorized questions only', async () => {
      const res = await repo.search({ subjectId, topicFilter: { kind: 'uncategorized' } })
      expect(res.map(q => q.id)).toEqual([q2.id])
    })

    it('should return empty results for nonexistent subject or topic combinations', async () => {
      const res1 = await repo.search({ subjectId: subjectId + 999 })
      expect(res1).toEqual([])

      const res2 = await repo.search({ subjectId, topicFilter: { kind: 'topic', topicId: topicId + 999 } })
      expect(res2).toEqual([])
    })

    it('should throw ValidationError for malformed search parameters', async () => {
      await expect(repo.search({ subjectId: 0 })).rejects.toThrow(ValidationError)
      await expect(repo.search({ subjectId: -5 })).rejects.toThrow(ValidationError)
      await expect(repo.search({ subjectId: 1.5 })).rejects.toThrow(ValidationError)
      await expect(repo.search({ subjectId: NaN })).rejects.toThrow(ValidationError)
      await expect(repo.search({ subjectId: Infinity })).rejects.toThrow(ValidationError)
      await expect(repo.search({ subjectId: '1' as unknown as number })).rejects.toThrow(ValidationError)

      await expect(repo.search({ subjectId, topicFilter: { kind: 'topic', topicId: -1 } })).rejects.toThrow(ValidationError)
      await expect(repo.search({ subjectId, topicFilter: { kind: 'topic', topicId: NaN } })).rejects.toThrow(ValidationError)

      await expect(repo.search({ subjectId, topicFilter: { kind: 'all', topicId } as unknown as TopicFilter })).rejects.toThrow(ValidationError)
      await expect(repo.search({ subjectId, topicFilter: { kind: 'uncategorized', topicId } as unknown as TopicFilter })).rejects.toThrow(ValidationError)

      await expect(repo.search({ subjectId, topicFilter: { kind: 'unknown' } as unknown as TopicFilter })).rejects.toThrow(ValidationError)

      await expect(repo.search({ subjectId, difficulty: 'super-hard' as unknown as Difficulty })).rejects.toThrow(ValidationError)
      await expect(repo.search({ subjectId, bookmarkStatus: 2 as unknown as BookmarkStatus })).rejects.toThrow(ValidationError)

      await expect(repo.search({ subjectId, extraField: 'test' } as unknown as QuestionSearchFilter)).rejects.toThrow(ValidationError)
    })

    it('should filter by difficulty using exact match', async () => {
      const res = await repo.search({ subjectId, difficulty: 'easy' })
      expect(res.map(q => q.id)).toEqual([q1.id])
    })

    it('should filter by bookmarkStatus correctly including status 0', async () => {
      const res1 = await repo.search({ subjectId, bookmarkStatus: 1 })
      expect(res1.map(q => q.id)).toEqual([q1.id, q3.id])

      const res0 = await repo.search({ subjectId, bookmarkStatus: 0 })
      expect(res0.map(q => q.id)).toEqual([q2.id])
    })

    it('should match search text case-insensitively, trimmed, and unicode normalized', async () => {
      const r1 = await repo.search({ subjectId, searchText: '  membrane  ' })
      expect(r1.map(q => q.id)).toEqual([q1.id])

      const r2 = await repo.search({ subjectId, searchText: 'LIPID' })
      expect(r2.map(q => q.id)).toEqual([q1.id])

      const r3 = await repo.search({ subjectId, searchText: 'explanation' })
      expect(r3.map(q => q.id)).toEqual([q1.id])

      const r4 = await repo.search({ subjectId, searchText: 'DNA' })
      expect(r4.map(q => q.id)).toEqual([q2.id])

      const r5 = await repo.search({ subjectId, searchText: '   ' })
      expect(r5.map(q => q.id)).toEqual([q2.id, q1.id, q3.id])

      const cafeCombined = 'cafe\u0301'
      const qCafe = await repo.create({
        subjectId,
        topicId: null,
        questionText: 'Question about café',
        options: ['A', 'B'],
        correctOptionIndex: 0,
        explanation: null,
        difficulty: 'easy'
      })
      const r6 = await repo.search({ subjectId, searchText: cafeCombined })
      expect(r6.map(q => q.id)).toContain(qCafe.id)
    })

    it('should combine multiple filters using AND semantics', async () => {
      const res = await repo.search({
        subjectId,
        topicFilter: { kind: 'topic', topicId },
        difficulty: 'easy',
        bookmarkStatus: 1,
        searchText: 'membrane'
      })
      expect(res.map(q => q.id)).toEqual([q1.id])
    })

    it('should sort results by createdAt DESC and id DESC tie-breaker', async () => {
      clockTime = 2000
      const qa = await repo.create({
        subjectId,
        topicId: null,
        questionText: 'Question A',
        options: ['A', 'B'],
        correctOptionIndex: 0,
        explanation: null,
        difficulty: 'easy'
      })
      const qb = await repo.create({
        subjectId,
        topicId: null,
        questionText: 'Question B',
        options: ['A', 'B'],
        correctOptionIndex: 0,
        explanation: null,
        difficulty: 'easy'
      })

      const res = await repo.search({ subjectId, difficulty: 'easy' })
      expect(res.map(q => q.id)).toEqual([qb.id, qa.id, q1.id])
    })
  })

  describe('Counts', () => {
    beforeEach(async () => {
      await repo.create({
        subjectId,
        topicId,
        questionText: 'Q1',
        options: ['A', 'B'],
        correctOptionIndex: 0,
        explanation: null,
        difficulty: 'easy'
      })

      await repo.create({
        subjectId,
        topicId: null,
        questionText: 'Q2',
        options: ['A', 'B'],
        correctOptionIndex: 0,
        explanation: null,
        difficulty: 'medium'
      })
    })

    it('should return correct counts by subject including categorized and uncategorized', async () => {
      const count = await repo.countBySubject(subjectId)
      expect(count).toBe(2)

      const countZero = await repo.countBySubject(subjectId + 999)
      expect(countZero).toBe(0)
    })

    it('should return correct counts by topic and exclude uncategorized', async () => {
      const count = await repo.countByTopic(topicId)
      expect(count).toBe(1)

      const countZero = await repo.countByTopic(topicId + 999)
      expect(countZero).toBe(0)
    })

    it('should throw ValidationError for invalid identifier arguments', async () => {
      const invalidValues = [0, -1, 1.5, NaN, Infinity, '1' as unknown as number]
      for (const val of invalidValues) {
        await expect(repo.countBySubject(val)).rejects.toThrow(ValidationError)
        await expect(repo.countByTopic(val)).rejects.toThrow(ValidationError)
      }
    })
  })
})
