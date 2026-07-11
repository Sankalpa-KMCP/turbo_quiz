import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDatabase, type QuizDatabase } from '../database'
import { QuizRepository } from '../repositories/QuizRepository'
import { ValidationError } from '../errors'
import { type QuizAttemptSessionSaveInput } from '../../types/db'

describe('QuizRepository', () => {
  let testDb: QuizDatabase
  let repo: QuizRepository
  let clockTime: number
  let subjectId: number
  let topicId: number
  let question1Id: number
  let question2Id: number

  beforeEach(async () => {
    const dbName = `test-quiz-repo-${Date.now()}-${Math.random()}`
    testDb = createDatabase(dbName)
    await testDb.open()
    clockTime = 2000
    repo = new QuizRepository(testDb, () => clockTime)

    // Setup prerequisite records
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

    question1Id = await testDb.questions.add({
      subjectId,
      topicId,
      questionText: 'What is mitochondria?',
      options: ['Powerhouse', 'Control center'],
      correctOptionIndex: 0,
      explanation: 'Mitochondria is powerhouse',
      difficulty: 'easy',
      bookmarkStatus: 0,
      createdAt: 1000,
      updatedAt: 1000
    })

    question2Id = await testDb.questions.add({
      subjectId,
      topicId,
      questionText: 'What is nucleus?',
      options: ['Cell brain', 'Storage'],
      correctOptionIndex: 0,
      explanation: 'Nucleus controls cells',
      difficulty: 'easy',
      bookmarkStatus: 0,
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

  describe('Atomic Save and Trusted Derivations', () => {
    it('should save a valid quiz attempt with derived metrics and snapshots', async () => {
      const input: QuizAttemptSessionSaveInput = {
        subjectId,
        topicId,
        subjectNameSnap: 'Biology',
        topicNameSnap: 'Cells',
        mode: 'practice',
        startedAt: 1000,
        answers: [
          {
            questionId: question1Id,
            selectedOptionIndex: 0, // Correct
            timeTakenSeconds: 15.5,
            questionSnapshot: {
              questionText: 'What is mitochondria?',
              options: ['Powerhouse', 'Control center'],
              correctOptionIndex: 0,
              explanation: 'Mitochondria is powerhouse',
              difficulty: 'easy'
            }
          },
          {
            questionId: question2Id,
            selectedOptionIndex: 1, // Incorrect
            timeTakenSeconds: 20,
            questionSnapshot: {
              questionText: 'What is nucleus?',
              options: ['Cell brain', 'Storage'],
              correctOptionIndex: 0,
              explanation: 'Nucleus controls cells',
              difficulty: 'easy'
            }
          }
        ]
      }

      const attempt = await repo.save(input)

      // Verify returned QuizAttempt
      expect(attempt.id).toBeTypeOf('number')
      expect(attempt.id).toBeGreaterThan(0)
      expect(attempt.subjectId).toBe(subjectId)
      expect(attempt.topicId).toBe(topicId)
      expect(attempt.mode).toBe('practice')
      expect(attempt.totalQuestions).toBe(2)
      expect(attempt.correctAnswers).toBe(1)
      expect(attempt.scorePercentage).toBe(50)
      expect(attempt.timeTakenSeconds).toBe(35.5)
      expect(attempt.startedAt).toBe(1000)
      expect(attempt.completedAt).toBe(2000)
      expect(attempt.subjectNameSnap).toBe('Biology')
      expect(attempt.topicNameSnap).toBe('Cells')

      // Verify database persistence for QuizAttempt
      const dbAttempt = await testDb.quizAttempts.get(attempt.id)
      expect(dbAttempt).toEqual(attempt)

      // Verify database persistence for AnswerAttempts
      const answers = await testDb.answerAttempts
        .where('quizAttemptId')
        .equals(attempt.id)
        .toArray()

      // Asserts order-preservation contract (sorted by ascending generated ID)
      const sortedAnswers = answers.sort((a, b) => a.id - b.id)
      expect(sortedAnswers).toHaveLength(2)

      expect(sortedAnswers[0].questionId).toBe(question1Id)
      expect(sortedAnswers[0].selectedOptionIndex).toBe(0)
      expect(sortedAnswers[0].correctOptionIndex).toBe(0)
      expect(sortedAnswers[0].isCorrect).toBe(true)
      expect(sortedAnswers[0].timeTakenSeconds).toBe(15.5)
      expect(sortedAnswers[0].questionSnapshot.questionText).toBe('What is mitochondria?')

      expect(sortedAnswers[1].questionId).toBe(question2Id)
      expect(sortedAnswers[1].selectedOptionIndex).toBe(1)
      expect(sortedAnswers[1].correctOptionIndex).toBe(0)
      expect(sortedAnswers[1].isCorrect).toBe(false)
      expect(sortedAnswers[1].timeTakenSeconds).toBe(20)
      expect(sortedAnswers[1].questionSnapshot.questionText).toBe('What is nucleus?')
    })

    it('should derive correct answers when there are unanswered/skipped questions', async () => {
      const input: QuizAttemptSessionSaveInput = {
        subjectId,
        topicId,
        subjectNameSnap: 'Biology',
        topicNameSnap: 'Cells',
        mode: 'exam',
        startedAt: 1000,
        answers: [
          {
            questionId: question1Id,
            selectedOptionIndex: null, // Skipped
            timeTakenSeconds: 30,
            questionSnapshot: {
              questionText: 'What is mitochondria?',
              options: ['Powerhouse', 'Control center'],
              correctOptionIndex: 0,
              explanation: 'Mitochondria is powerhouse',
              difficulty: 'easy'
            }
          }
        ]
      }

      const attempt = await repo.save(input)
      expect(attempt.totalQuestions).toBe(1)
      expect(attempt.correctAnswers).toBe(0)
      expect(attempt.scorePercentage).toBe(0)
      expect(attempt.timeTakenSeconds).toBe(30)

      const answers = await testDb.answerAttempts.where('quizAttemptId').equals(attempt.id).toArray()
      expect(answers).toHaveLength(1)
      expect(answers[0].isCorrect).toBe(false)
      expect(answers[0].selectedOptionIndex).toBeNull()
      expect(answers[0].timeTakenSeconds).toBe(30)
    })
  })

  describe('Snapshot Authority and Invariants', () => {
    it('should save completed attempt even when current entities were renamed or edited after session start', async () => {
      const input: QuizAttemptSessionSaveInput = {
        subjectId,
        topicId,
        subjectNameSnap: 'Original Biology',
        topicNameSnap: 'Original Cells',
        mode: 'practice',
        startedAt: 1000,
        answers: [
          {
            questionId: question1Id,
            selectedOptionIndex: 0,
            timeTakenSeconds: 10,
            questionSnapshot: {
              questionText: 'Original Question Text',
              options: ['Original A', 'Original B'],
              correctOptionIndex: 0,
              explanation: 'Original explanation',
              difficulty: 'medium'
            }
          }
        ]
      }

      // Rename Subject & Topic, Edit Question
      await testDb.subjects.update(subjectId, { name: 'New Biology', normalizedName: 'new-biology' })
      await testDb.topics.update(topicId, { name: 'New Cells', normalizedName: 'new-cells' })
      await testDb.questions.update(question1Id, {
        questionText: 'New Question Text',
        options: ['New A', 'New B']
      })

      const attempt = await repo.save(input)

      // Verification: snapshots remain original
      expect(attempt.subjectNameSnap).toBe('Original Biology')
      expect(attempt.topicNameSnap).toBe('Original Cells')

      const answers = await testDb.answerAttempts.where('quizAttemptId').equals(attempt.id).toArray()
      expect(answers[0].questionSnapshot.questionText).toBe('Original Question Text')
      expect(answers[0].questionSnapshot.options).toEqual(['Original A', 'Original B'])
      expect(answers[0].questionId).toBe(question1Id) // Relationship retained
    })

    it('should retain relationships if they exist and set to null if they were deleted before save', async () => {
      const input: QuizAttemptSessionSaveInput = {
        subjectId,
        topicId,
        subjectNameSnap: 'Biology',
        topicNameSnap: 'Cells',
        mode: 'practice',
        startedAt: 1000,
        answers: [
          {
            questionId: question1Id,
            selectedOptionIndex: 0,
            timeTakenSeconds: 10,
            questionSnapshot: {
              questionText: 'What is mitochondria?',
              options: ['Powerhouse', 'Control center'],
              correctOptionIndex: 0,
              explanation: 'Mitochondria is powerhouse',
              difficulty: 'easy'
            }
          }
        ]
      }

      // Delete the Topic and Question
      await testDb.questions.delete(question1Id)
      await testDb.topics.delete(topicId)

      const attempt = await repo.save(input)

      // QuizAttempt topicId is nullified but subjectId remains
      expect(attempt.subjectId).toBe(subjectId)
      expect(attempt.topicId).toBeNull()
      expect(attempt.topicNameSnap).toBe('Cells') // Snapshot intact

      const answers = await testDb.answerAttempts.where('quizAttemptId').equals(attempt.id).toArray()
      expect(answers).toHaveLength(1)
      expect(answers[0].questionId).toBeNull() // Nullified
      expect(answers[0].questionSnapshot.questionText).toBe('What is mitochondria?') // Snapshot intact
    })
  })

  describe('Validation', () => {
    it('should throw ValidationError if answers array is empty', async () => {
      const input = {
        subjectId,
        topicId,
        subjectNameSnap: 'Biology',
        topicNameSnap: 'Cells',
        mode: 'practice',
        startedAt: 1000,
        answers: []
      } as unknown as QuizAttemptSessionSaveInput

      await expect(repo.save(input)).rejects.toThrow(ValidationError)
    })

    it('should throw ValidationError if topicId is null but topicNameSnap is non-null', async () => {
      const input = {
        subjectId,
        topicId: null,
        subjectNameSnap: 'Biology',
        topicNameSnap: 'Cells', // invalid
        mode: 'practice',
        startedAt: 1000,
        answers: [
          {
            questionId: question1Id,
            selectedOptionIndex: 0,
            timeTakenSeconds: 10,
            questionSnapshot: {
              questionText: 'What is mitochondria?',
              options: ['Powerhouse', 'Control center'],
              correctOptionIndex: 0,
              explanation: 'Mitochondria is powerhouse',
              difficulty: 'easy'
            }
          }
        ]
      } as unknown as QuizAttemptSessionSaveInput

      await expect(repo.save(input)).rejects.toThrow(ValidationError)
    })

    it('should throw ValidationError for duplicate question references', async () => {
      const input: QuizAttemptSessionSaveInput = {
        subjectId,
        topicId,
        subjectNameSnap: 'Biology',
        topicNameSnap: 'Cells',
        mode: 'practice',
        startedAt: 1000,
        answers: [
          {
            questionId: question1Id,
            selectedOptionIndex: 0,
            timeTakenSeconds: 10,
            questionSnapshot: {
              questionText: 'What is mitochondria?',
              options: ['Powerhouse', 'Control center'],
              correctOptionIndex: 0,
              explanation: 'Mitochondria is powerhouse',
              difficulty: 'easy'
            }
          },
          {
            questionId: question1Id, // duplicate
            selectedOptionIndex: 0,
            timeTakenSeconds: 5,
            questionSnapshot: {
              questionText: 'What is mitochondria?',
              options: ['Powerhouse', 'Control center'],
              correctOptionIndex: 0,
              explanation: 'Mitochondria is powerhouse',
              difficulty: 'easy'
            }
          }
        ]
      }

      await expect(repo.save(input)).rejects.toThrow(ValidationError)
    })

    it('should throw ValidationError for duplicate options in a question snapshot', async () => {
      const input: QuizAttemptSessionSaveInput = {
        subjectId,
        topicId,
        subjectNameSnap: 'Biology',
        topicNameSnap: 'Cells',
        mode: 'practice',
        startedAt: 1000,
        answers: [
          {
            questionId: question1Id,
            selectedOptionIndex: 0,
            timeTakenSeconds: 10,
            questionSnapshot: {
              questionText: 'What is mitochondria?',
              options: ['duplicate', '  Duplicate  '], // Duplicate normalized values
              correctOptionIndex: 0,
              explanation: 'Mitochondria is powerhouse',
              difficulty: 'easy'
            }
          }
        ]
      }

      await expect(repo.save(input)).rejects.toThrow(ValidationError)
    })

    it('should throw ValidationError if correctOptionIndex is out of options bounds', async () => {
      const input: QuizAttemptSessionSaveInput = {
        subjectId,
        topicId,
        subjectNameSnap: 'Biology',
        topicNameSnap: 'Cells',
        mode: 'practice',
        startedAt: 1000,
        answers: [
          {
            questionId: question1Id,
            selectedOptionIndex: 0,
            timeTakenSeconds: 10,
            questionSnapshot: {
              questionText: 'What is mitochondria?',
              options: ['A', 'B'],
              correctOptionIndex: 2, // Out of bounds
              explanation: 'Mitochondria is powerhouse',
              difficulty: 'easy'
            }
          }
        ]
      }

      await expect(repo.save(input)).rejects.toThrow(ValidationError)
    })

    it('should throw ValidationError if selectedOptionIndex is out of bounds', async () => {
      const input: QuizAttemptSessionSaveInput = {
        subjectId,
        topicId,
        subjectNameSnap: 'Biology',
        topicNameSnap: 'Cells',
        mode: 'practice',
        startedAt: 1000,
        answers: [
          {
            questionId: question1Id,
            selectedOptionIndex: 2, // Out of bounds for 2 options
            timeTakenSeconds: 10,
            questionSnapshot: {
              questionText: 'What is mitochondria?',
              options: ['A', 'B'],
              correctOptionIndex: 0,
              explanation: 'Mitochondria is powerhouse',
              difficulty: 'easy'
            }
          }
        ]
      }

      await expect(repo.save(input)).rejects.toThrow(ValidationError)
    })
  })

  describe('Snapshot Isolation', () => {
    it('should protect snapshots from caller-input mutation', async () => {
      const input: QuizAttemptSessionSaveInput = {
        subjectId,
        topicId,
        subjectNameSnap: 'Biology',
        topicNameSnap: 'Cells',
        mode: 'practice',
        startedAt: 1000,
        answers: [
          {
            questionId: question1Id,
            selectedOptionIndex: 0,
            timeTakenSeconds: 10,
            questionSnapshot: {
              questionText: 'What is mitochondria?',
              options: ['Powerhouse', 'Control center'],
              correctOptionIndex: 0,
              explanation: 'Mitochondria is powerhouse',
              difficulty: 'easy'
            }
          }
        ]
      }

      const attempt = await repo.save(input)

      // Mutate caller input after save
      input.answers[0].questionSnapshot.options[0] = 'MUTATED'
      input.answers[0].questionSnapshot.questionText = 'MUTATED'

      // Check database to ensure it remains unchanged
      const answers = await testDb.answerAttempts.where('quizAttemptId').equals(attempt.id).toArray()
      expect(answers[0].questionSnapshot.questionText).toBe('What is mitochondria?')
      expect(answers[0].questionSnapshot.options[0]).toBe('Powerhouse')
    })
  })

  describe('Partial-Write Rollback', () => {
    it('should roll back completely if any database write fails', async () => {
      // Seed unrelated pre-existing history
      const unrelatedAttemptId = await testDb.quizAttempts.add({
        subjectId,
        topicId: null,
        mode: 'practice',
        totalQuestions: 1,
        correctAnswers: 1,
        scorePercentage: 100,
        timeTakenSeconds: 5,
        startedAt: 500,
        completedAt: 500,
        subjectNameSnap: 'Biology',
        topicNameSnap: null
      })

      const unrelatedAnswerId = await testDb.answerAttempts.add({
        quizAttemptId: unrelatedAttemptId,
        questionId: question1Id,
        selectedOptionIndex: 0,
        correctOptionIndex: 0,
        isCorrect: true,
        timeTakenSeconds: 5,
        questionSnapshot: {
          questionText: 'Unrelated Mitochondria',
          options: ['A', 'B'],
          correctOptionIndex: 0,
          explanation: null,
          difficulty: 'easy'
        }
      })

      const baselineAttemptsCount = await testDb.quizAttempts.count()
      const baselineAnswersCount = await testDb.answerAttempts.count()

      const input: QuizAttemptSessionSaveInput = {
        subjectId,
        topicId,
        subjectNameSnap: 'Biology',
        topicNameSnap: 'Cells',
        mode: 'practice',
        startedAt: 1000,
        answers: [
          {
            questionId: question1Id,
            selectedOptionIndex: 0,
            timeTakenSeconds: 10,
            questionSnapshot: {
              questionText: 'What is mitochondria?',
              options: ['Powerhouse', 'Control center'],
              correctOptionIndex: 0,
              explanation: 'Mitochondria is powerhouse',
              difficulty: 'easy'
            }
          },
          {
            questionId: question2Id,
            selectedOptionIndex: 0,
            timeTakenSeconds: 15,
            questionSnapshot: {
              questionText: 'What is nucleus?',
              options: ['Cell brain', 'Storage'],
              correctOptionIndex: 0,
              explanation: 'Nucleus controls cells',
              difficulty: 'easy'
            }
          }
        ]
      }

      // Hook callback counting insertion calls
      let insertCount = 0
      const failingHook = () => {
        insertCount++
        if (insertCount === 2) {
          throw new Error('Forced transactional rollback')
        }
      }

      // Register the creating hook
      testDb.answerAttempts.hook('creating', failingHook)

      try {
        await expect(repo.save(input)).rejects.toThrow()
      } finally {
        // Unsubscribe the hook
        testDb.answerAttempts.hook('creating').unsubscribe(failingHook)
      }

      // Assert complete rollback: no new attempts or answer attempts added
      const currentAttemptsCount = await testDb.quizAttempts.count()
      const currentAnswersCount = await testDb.answerAttempts.count()

      expect(currentAttemptsCount).toBe(baselineAttemptsCount)
      expect(currentAnswersCount).toBe(baselineAnswersCount)

      // Verify unrelated history is completely untouched
      const unrelatedAttempt = await testDb.quizAttempts.get(unrelatedAttemptId)
      expect(unrelatedAttempt).toBeDefined()
      expect(unrelatedAttempt?.subjectNameSnap).toBe('Biology')

      const unrelatedAnswer = await testDb.answerAttempts.get(unrelatedAnswerId)
      expect(unrelatedAnswer).toBeDefined()
      expect(unrelatedAnswer?.questionSnapshot.questionText).toBe('Unrelated Mitochondria')

      // Assert repository remains fully functional for subsequent saves
      const normalSaveAttempt = await repo.save({
        subjectId,
        topicId,
        subjectNameSnap: 'Biology',
        topicNameSnap: 'Cells',
        mode: 'practice',
        startedAt: 1000,
        answers: [
          {
            questionId: question1Id,
            selectedOptionIndex: 0,
            timeTakenSeconds: 10,
            questionSnapshot: {
              questionText: 'What is mitochondria?',
              options: ['Powerhouse', 'Control center'],
              correctOptionIndex: 0,
              explanation: 'Mitochondria is powerhouse',
              difficulty: 'easy'
            }
          }
        ]
      })

      expect(normalSaveAttempt.id).toBeTypeOf('number')
      expect(await testDb.quizAttempts.count()).toBe(baselineAttemptsCount + 1)
    })
  })
})
