import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDatabase, type QuizDatabase } from '../database'
import { QuizRepository } from '../repositories/QuizRepository'
import { ValidationError, NotFoundError } from '../errors'
import { type QuizAttemptSessionSaveInput } from '../../types/db'
import { SubjectRepository } from '../repositories/SubjectRepository'
import { QuestionRepository } from '../repositories/QuestionRepository'

describe('QuizRepository', () => {
  let testDb: QuizDatabase
  let repo: QuizRepository
  let subjectRepo: SubjectRepository
  let questionRepo: QuestionRepository
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
    subjectRepo = new SubjectRepository(testDb, () => clockTime)
    questionRepo = new QuestionRepository(testDb, () => clockTime)

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

  describe('Read Path and Queries', () => {
    let attemptId: number

    beforeEach(async () => {
      // Create a base quiz attempt to use across read tests
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
            selectedOptionIndex: 1,
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
      const attempt = await repo.save(input)
      attemptId = attempt.id
    })

    describe('Lookups by ID', () => {
      it('should return stored QuizAttempt for an existing ID', async () => {
        const attempt = await repo.getAttemptById(attemptId)
        expect(attempt).toBeDefined()
        expect(attempt?.id).toBe(attemptId)
        expect(attempt?.subjectNameSnap).toBe('Biology')
      })

      it('should return undefined for a valid nonexistent ID', async () => {
        const attempt = await repo.getAttemptById(99999)
        expect(attempt).toBeUndefined()
      })

      it('should return stored QuizAttempt on requireAttemptById for an existing ID', async () => {
        const attempt = await repo.requireAttemptById(attemptId)
        expect(attempt.id).toBe(attemptId)
        expect(attempt.subjectNameSnap).toBe('Biology')
      })

      it('should throw NotFoundError on requireAttemptById for a valid nonexistent ID', async () => {
        await expect(repo.requireAttemptById(99999)).rejects.toThrow(NotFoundError)
      })

      const malformedIds = [
        0,
        -1,
        2.5,
        NaN,
        Infinity,
        -Infinity,
        'string',
        null,
        undefined
      ]

      it.each(malformedIds)('should throw ValidationError for malformed ID: %s', async (invalidId) => {
        await expect(repo.getAttemptById(invalidId as unknown as number)).rejects.toThrow(ValidationError)
        await expect(repo.requireAttemptById(invalidId as unknown as number)).rejects.toThrow(ValidationError)
      })
    })

    describe('Answer Retrieval', () => {
      it('should return AnswerAttempts sorted by ID ascending', async () => {
        const answers = await repo.getAnswersForAttempt(attemptId)
        expect(answers).toHaveLength(2)
        expect(answers[0].id).toBeLessThan(answers[1].id)
        expect(answers[0].questionSnapshot.questionText).toBe('What is mitochondria?')
        expect(answers[1].questionSnapshot.questionText).toBe('What is nucleus?')
      })

      it('should return empty list for valid nonexistent parent ID', async () => {
        const answers = await repo.getAnswersForAttempt(99999)
        expect(answers).toEqual([])
      })

      it('should return empty list for existing attempt with no AnswerAttempts', async () => {
        const noAnswersAttemptId = await testDb.quizAttempts.add({
          subjectId,
          topicId: null,
          mode: 'practice',
          totalQuestions: 0,
          correctAnswers: 0,
          scorePercentage: 0,
          timeTakenSeconds: 0,
          startedAt: 1000,
          completedAt: 2000,
          subjectNameSnap: 'Biology',
          topicNameSnap: null
        })

        const answers = await repo.getAnswersForAttempt(noAnswersAttemptId)
        expect(answers).toEqual([])
      })

      it('should remain readable and preserve snapshots after current Question edits or deletion', async () => {
        // Edit current question and delete another
        await testDb.questions.update(question1Id, {
          questionText: 'Edited Question Text'
        })
        await questionRepo.delete(question2Id)

        const answers = await repo.getAnswersForAttempt(attemptId)
        expect(answers).toHaveLength(2)

        // Snapshot is preserved (Option A / session-start snapshot is authoritative)
        expect(answers[0].questionSnapshot.questionText).toBe('What is mitochondria?')
        expect(answers[0].questionId).toBe(question1Id) // ID retained

        expect(answers[1].questionSnapshot.questionText).toBe('What is nucleus?')
        expect(answers[1].questionId).toBeNull() // ID nullified
      })
    })

    describe('Listing All Attempts', () => {
      it('should return empty array when no attempts exist', async () => {
        // Clear all attempts
        await testDb.quizAttempts.clear()
        const attempts = await repo.getAllAttempts()
        expect(attempts).toEqual([])
      })

      it('should return attempts sorted by completedAt descending and then ID descending', async () => {
        // Clear the beforeEach attempt to simplify sorting checks
        await testDb.quizAttempts.clear()

        // Insert attempts out of chronological order
        const id1 = await testDb.quizAttempts.add({
          subjectId,
          topicId: null,
          mode: 'practice',
          totalQuestions: 1,
          correctAnswers: 1,
          scorePercentage: 100,
          timeTakenSeconds: 10,
          startedAt: 1000,
          completedAt: 3000, // completed last
          subjectNameSnap: 'Subject 1',
          topicNameSnap: null
        })

        const id2 = await testDb.quizAttempts.add({
          subjectId,
          topicId: null,
          mode: 'practice',
          totalQuestions: 1,
          correctAnswers: 1,
          scorePercentage: 100,
          timeTakenSeconds: 10,
          startedAt: 1000,
          completedAt: 1000, // completed first
          subjectNameSnap: 'Subject 2',
          topicNameSnap: null
        })

        // Tie-breaker candidates (same completedAt)
        const id3 = await testDb.quizAttempts.add({
          subjectId,
          topicId: null,
          mode: 'practice',
          totalQuestions: 1,
          correctAnswers: 1,
          scorePercentage: 100,
          timeTakenSeconds: 10,
          startedAt: 1000,
          completedAt: 2000, // tie completedAt
          subjectNameSnap: 'Subject 3 (Tie 1)',
          topicNameSnap: null
        })

        const id4 = await testDb.quizAttempts.add({
          subjectId,
          topicId: null,
          mode: 'practice',
          totalQuestions: 1,
          correctAnswers: 1,
          scorePercentage: 100,
          timeTakenSeconds: 10,
          startedAt: 1000,
          completedAt: 2000, // tie completedAt, higher ID
          subjectNameSnap: 'Subject 4 (Tie 2)',
          topicNameSnap: null
        })

        const list = await repo.getAllAttempts()
        expect(list).toHaveLength(4)

        // Expected sorted order: completedAt desc, then ID desc
        // 1. completedAt = 3000 -> id1
        // 2. completedAt = 2000, ID = id4 (since id4 > id3) -> id4
        // 3. completedAt = 2000, ID = id3 -> id3
        // 4. completedAt = 1000 -> id2
        expect(list[0].id).toBe(id1)
        expect(list[1].id).toBe(id4)
        expect(list[2].id).toBe(id3)
        expect(list[3].id).toBe(id2)
      })

      it('should include attempts with null Subject/Topic relationships', async () => {
        await subjectRepo.delete(subjectId) // Cascades to nullify relationships

        const list = await repo.getAllAttempts()
        expect(list).toHaveLength(1)
        expect(list[0].subjectId).toBeNull()
        expect(list[0].topicId).toBeNull()
        expect(list[0].subjectNameSnap).toBe('Biology')
        expect(list[0].topicNameSnap).toBe('Cells')
      })
    })

    describe('Subject Filtering', () => {
      it('should filter attempts by current Subject ID', async () => {
        const list = await repo.getAttemptsBySubject(subjectId)
        expect(list).toHaveLength(1)
        expect(list[0].id).toBe(attemptId)
        expect(list[0].subjectId).toBe(subjectId)
      })

      it('should exclude attempts belonging to another Subject', async () => {
        const otherSubjectId = await testDb.subjects.add({
          name: 'Chemistry',
          normalizedName: 'chemistry',
          description: null,
          createdAt: 1000,
          updatedAt: 1000
        })

        const list = await repo.getAttemptsBySubject(otherSubjectId)
        expect(list).toEqual([])
      })

      it('should return empty list for valid nonexistent Subject ID', async () => {
        const list = await repo.getAttemptsBySubject(99999)
        expect(list).toEqual([])
      })

      it('should throw ValidationError for malformed Subject ID', async () => {
        await expect(repo.getAttemptsBySubject(-5)).rejects.toThrow(ValidationError)
        await expect(repo.getAttemptsBySubject(NaN)).rejects.toThrow(ValidationError)
      })

      it('should exclude attempts whose Subject relationship has been nullified', async () => {
        // Delete the Subject (which cascades to nullify attempt subjectId)
        await subjectRepo.delete(subjectId)

        const list = await repo.getAttemptsBySubject(subjectId)
        expect(list).toEqual([]) // Excluded

        const generalHistory = await repo.getAllAttempts()
        expect(generalHistory).toHaveLength(1) // Still visible in general history
        expect(generalHistory[0].subjectNameSnap).toBe('Biology')
      })
    })

    describe('Structured-Clone Isolation', () => {
      it('should prevent returned object mutations from persisting back to database', async () => {
        const attempt = await repo.requireAttemptById(attemptId)
        expect(attempt.subjectNameSnap).toBe('Biology')

        // Mutate return value in-memory
        attempt.subjectNameSnap = 'MUTATED'

        // Query again
        const fresh = await repo.requireAttemptById(attemptId)
        expect(fresh.subjectNameSnap).toBe('Biology') // Unchanged
      })

      it('should prevent returned answer mutations from persisting back to database', async () => {
        const answers = await repo.getAnswersForAttempt(attemptId)
        expect(answers[0].questionSnapshot.questionText).toBe('What is mitochondria?')

        // Mutate return value in-memory
        answers[0].questionSnapshot.questionText = 'MUTATED'

        // Query again
        const fresh = await repo.getAnswersForAttempt(attemptId)
        expect(fresh[0].questionSnapshot.questionText).toBe('What is mitochondria?') // Unchanged
      })
    })
  })
})
