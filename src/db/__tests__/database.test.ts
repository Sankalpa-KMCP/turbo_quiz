import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDatabase, type QuizDatabase } from '../database'

describe('QuizDatabase Schema and Indexes', () => {
  let testDb: QuizDatabase
  let dbName: string

  beforeEach(() => {
    dbName = `test-schema-db-${Date.now()}-${Math.random()}`
    testDb = createDatabase(dbName)
  })

  afterEach(async () => {
    if (testDb) {
      testDb.close()
      await testDb.delete()
    }
  })

  it('should open database and define version-1 tables', async () => {
    await testDb.open()
    expect(testDb.isOpen()).toBe(true)

    // Verify verno
    expect(testDb.verno).toBe(1)

    // Verify table inventory
    const tableNames = testDb.tables.map((t) => t.name).sort()
    const expectedTables = [
      'answerAttempts',
      'questions',
      'quizAttempts',
      'subjects',
      'topics'
    ]
    expect(tableNames).toEqual(expectedTables)
  })

  it('should support auto-increment and verify key returned is positive', async () => {
    await testDb.open()

    // Add subject without id - insertion type validation ensures no casts are needed
    const payload = {
      name: 'Biology',
      normalizedName: 'biology',
      description: 'Study of life',
      createdAt: 1000,
      updatedAt: 1000
    }
    const id = await testDb.subjects.add(payload)

    expect(id).toBeTypeOf('number')
    expect(id).toBeGreaterThan(0)

    // Retrieve and verify contents
    const record = await testDb.subjects.get(id)
    expect(record).toBeDefined()
    if (record) {
      expect(record.id).toBe(id)
      expect(record.name).toBe('Biology')
      expect(record.normalizedName).toBe('biology')
      expect(record.description).toBe('Study of life')
      expect(record.createdAt).toBe(1000)
      expect(record.updatedAt).toBe(1000)
    }
  })

  it('should enforce unique index constraint on subjects normalizedName', async () => {
    await testDb.open()

    // Add first subject
    await testDb.subjects.add({
      name: 'Biology',
      normalizedName: 'biology',
      description: 'Study of life',
      createdAt: Date.now(),
      updatedAt: Date.now()
    })

    // Attempting to add duplicate normalizedName should fail (database constraint)
    await expect(
      testDb.subjects.add({
        name: 'biology',
        normalizedName: 'biology',
        description: 'Case check',
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
    ).rejects.toThrow()
  })

  it('should enforce compound uniqueness on topics [subjectId+normalizedName]', async () => {
    await testDb.open()

    // Add first topic under subject 1
    await testDb.topics.add({
      subjectId: 1,
      name: 'Cells',
      normalizedName: 'cells',
      createdAt: Date.now()
    })

    // Duplicate topic under different subjectId (Should succeed)
    await expect(
      testDb.topics.add({
        subjectId: 2,
        name: 'Cells',
        normalizedName: 'cells',
        createdAt: Date.now()
      })
    ).resolves.toBeGreaterThan(0)

    // Duplicate topic under same subjectId (Should fail)
    await expect(
      testDb.topics.add({
        subjectId: 1,
        name: 'cells',
        normalizedName: 'cells',
        createdAt: Date.now()
      })
    ).rejects.toThrow()
  })

  it('should support querying questions by difficulty, bookmarkStatus, and compound subjectId/topicId indexes', async () => {
    await testDb.open()

    await testDb.questions.add({
      subjectId: 1,
      topicId: 10,
      questionText: 'Q1',
      options: ['A', 'B'],
      correctOptionIndex: 0,
      explanation: null,
      difficulty: 'easy',
      bookmarkStatus: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    })

    await testDb.questions.add({
      subjectId: 1,
      topicId: 11,
      questionText: 'Q2',
      options: ['C', 'D'],
      correctOptionIndex: 1,
      explanation: null,
      difficulty: 'medium',
      bookmarkStatus: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    })

    // Query difficulty index
    const easyQs = await testDb.questions.where('difficulty').equals('easy').toArray()
    expect(easyQs).toHaveLength(1)
    expect(easyQs[0].questionText).toBe('Q1')

    // Query bookmarkStatus index
    const bookmarked = await testDb.questions.where('bookmarkStatus').equals(1).toArray()
    expect(bookmarked).toHaveLength(1)
    expect(bookmarked[0].questionText).toBe('Q1')

    // Query compound index [subjectId+topicId]
    const compoundMatch = await testDb.questions.where('[subjectId+topicId]').equals([1, 11]).toArray()
    expect(compoundMatch).toHaveLength(1)
    expect(compoundMatch[0].questionText).toBe('Q2')
  })

  it('should support nullable question topic and sparse-index lookup behavior', async () => {
    await testDb.open()

    const qId = await testDb.questions.add({
      subjectId: 1,
      topicId: null,
      questionText: 'Uncategorized Question',
      options: ['A', 'B'],
      correctOptionIndex: 0,
      explanation: null,
      difficulty: 'easy',
      bookmarkStatus: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    })

    expect(qId).toBeGreaterThan(0)

    // Retrieval by primary key succeeds
    const question = await testDb.questions.get(qId)
    expect(question).toBeDefined()
    expect(question?.topicId).toBeNull()

    // Retrieval through subjectId index succeeds
    const subjectQuestions = await testDb.questions.where('subjectId').equals(1).toArray()
    expect(subjectQuestions).toContainEqual(expect.objectContaining({ id: qId }))

    // Null values are not indexed by topicId. Verified by querying topicId:
    // We fetch all topic-bound questions and verify the null topic question is absent.
    const allTopicKeys = await testDb.questions.orderBy('topicId').keys()
    expect(allTopicKeys).not.toContain(null)

    // Uncategorized questions are fetched by subject index and filtered in-memory
    const uncategorized = subjectQuestions.filter((q) => q.topicId === null)
    expect(uncategorized).toHaveLength(1)
    expect(uncategorized[0].id).toBe(qId)
  })

  it('should support sorting quiz attempts chronologically by completedAt index', async () => {
    await testDb.open()

    // Insert out of order
    await testDb.quizAttempts.add({
      subjectId: 1,
      topicId: null,
      mode: 'practice',
      totalQuestions: 5,
      correctAnswers: 3,
      scorePercentage: 60,
      timeTakenSeconds: 200,
      startedAt: 1000,
      completedAt: 3000, // Completed last
      subjectNameSnap: 'Biology',
      topicNameSnap: null
    })

    await testDb.quizAttempts.add({
      subjectId: 1,
      topicId: null,
      mode: 'practice',
      totalQuestions: 5,
      correctAnswers: 4,
      scorePercentage: 80,
      timeTakenSeconds: 0,
      startedAt: 1000,
      completedAt: 1000, // Completed first
      subjectNameSnap: 'Biology',
      topicNameSnap: null
    })

    await testDb.quizAttempts.add({
      subjectId: 1,
      topicId: null,
      mode: 'practice',
      totalQuestions: 5,
      correctAnswers: 2,
      scorePercentage: 40,
      timeTakenSeconds: 100,
      startedAt: 1000,
      completedAt: 2000, // Completed second
      subjectNameSnap: 'Biology',
      topicNameSnap: null
    })

    // Query index in chronological order
    const ordered = await testDb.quizAttempts.orderBy('completedAt').toArray()
    expect(ordered).toHaveLength(3)
    expect(ordered[0].completedAt).toBe(1000)
    expect(ordered[1].completedAt).toBe(2000)
    expect(ordered[2].completedAt).toBe(3000)
  })

  it('should support answer attempts isolation and snapshots across multiple quiz attempts', async () => {
    await testDb.open()

    // Create Attempt A
    const attemptAId = await testDb.quizAttempts.add({
      subjectId: 1,
      topicId: null,
      mode: 'practice',
      totalQuestions: 2,
      correctAnswers: 1,
      scorePercentage: 50,
      timeTakenSeconds: 5,
      startedAt: Date.now() - 5000,
      completedAt: Date.now(),
      subjectNameSnap: 'Biology',
      topicNameSnap: null
    })

    // Create Attempt B
    const attemptBId = await testDb.quizAttempts.add({
      subjectId: 1,
      topicId: null,
      mode: 'exam',
      totalQuestions: 1,
      correctAnswers: 1,
      scorePercentage: 100,
      timeTakenSeconds: 2,
      startedAt: Date.now() - 2000,
      completedAt: Date.now(),
      subjectNameSnap: 'Biology',
      topicNameSnap: null
    })

    // Write answers for Attempt A
    await testDb.answerAttempts.bulkAdd([
      {
        quizAttemptId: attemptAId,
        questionId: 10,
        selectedOptionIndex: 0,
        correctOptionIndex: 0,
        isCorrect: true,
        timeTakenSeconds: 2,
        questionSnapshot: {
          questionText: 'QA1',
          options: ['A', 'B'],
          correctOptionIndex: 0,
          explanation: 'Exp A1',
          difficulty: 'easy'
        }
      },
      {
        quizAttemptId: attemptAId,
        questionId: 11,
        selectedOptionIndex: 1,
        correctOptionIndex: 0,
        isCorrect: false,
        timeTakenSeconds: 3,
        questionSnapshot: {
          questionText: 'QA2',
          options: ['C', 'D'],
          correctOptionIndex: 0,
          explanation: 'Exp A2',
          difficulty: 'medium'
        }
      }
    ])

    // Write answer for Attempt B
    await testDb.answerAttempts.add({
      quizAttemptId: attemptBId,
      questionId: 12,
      selectedOptionIndex: 0,
      correctOptionIndex: 0,
      isCorrect: true,
      timeTakenSeconds: 1.5,
      questionSnapshot: {
        questionText: 'QB1',
        options: ['E', 'F'],
        correctOptionIndex: 0,
        explanation: 'Exp B1',
        difficulty: 'hard'
      }
    })

    // Query answers belonging to Attempt A
    const answersA = await testDb.answerAttempts
      .where('quizAttemptId')
      .equals(attemptAId)
      .toArray()

    // Assert isolation and snapshot integrity
    expect(answersA).toHaveLength(2)
    expect(answersA.map((a) => a.questionId)).toContain(10)
    expect(answersA.map((a) => a.questionId)).toContain(11)
    expect(answersA.map((a) => a.questionId)).not.toContain(12)

    const answer1 = answersA.find((a) => a.questionId === 10)
    expect(answer1).toBeDefined()
    expect(answer1?.questionSnapshot.questionText).toBe('QA1')
    expect(answer1?.questionSnapshot.explanation).toBe('Exp A1')
    expect(answer1?.questionSnapshot.difficulty).toBe('easy')
  })
})
