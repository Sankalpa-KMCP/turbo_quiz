import { z } from 'zod'
import { type QuizDatabase } from '../database'
import {
  type Question,
  type QuestionInput,
  type QuestionUpdateInput,
  type Difficulty,
  type BookmarkStatus
} from '../../types/db'
import { questionCreateSchema, questionUpdateSchema } from '../../schemas/questionSchema'
import { normalizeName } from '../../utils/normalizeName'
import {
  validateSchema,
  translatePersistenceError,
  NotFoundError,
  ValidationError,
  InvalidRelationshipError,
  isRepositoryOrSerializedError,
  reconstructRepositoryError
} from '../errors'

export type TopicFilter =
  | { kind: 'all' }
  | { kind: 'topic'; topicId: number }
  | { kind: 'uncategorized' }

export interface QuestionSearchFilter {
  subjectId: number
  topicFilter?: TopicFilter
  difficulty?: Difficulty
  bookmarkStatus?: BookmarkStatus
  searchText?: string
}

const topicFilterSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }).strict(),
  z.object({ kind: z.literal('uncategorized') }).strict(),
  z.object({
    kind: z.literal('topic'),
    topicId: z.number().int().positive('topicId must be a positive integer')
  }).strict()
])

const questionSearchFilterSchema = z.object({
  subjectId: z.number().int().positive('subjectId must be a positive integer'),
  topicFilter: topicFilterSchema.optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  bookmarkStatus: z.union([z.literal(0), z.literal(1)]).optional(),
  searchText: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        const trimmed = val.trim()
        return trimmed === '' ? undefined : trimmed
      }
      return val
    },
    z.string().optional()
  )
}).strict()

const positiveIdSchema = z.number().int().positive('Id must be a positive integer')

export class QuestionRepository {
  private readonly db: QuizDatabase
  private readonly now: () => number

  constructor(db: QuizDatabase, now: () => number = Date.now) {
    this.db = db
    this.now = now
  }

  async create(input: QuestionInput): Promise<Question> {
    const validated = validateSchema(questionCreateSchema, input, 'Question')
    let repoError: unknown = null

    try {
      return await this.db.transaction('rw', [this.db.questions, this.db.subjects, this.db.topics], async () => {
        try {
          // 1. Verify parent Subject exists
          const subject = await this.db.subjects.get(validated.subjectId)
          if (!subject) {
            throw new InvalidRelationshipError(
              'Question',
              'subjectId',
              'Subject',
              validated.subjectId
            )
          }

          // 2. If topicId is provided, verify it exists and belongs to the Subject
          if (validated.topicId !== null) {
            const topic = await this.db.topics.get(validated.topicId)
            if (!topic) {
              throw new InvalidRelationshipError(
                'Question',
                'topicId',
                'Topic',
                validated.topicId
              )
            }
            if (topic.subjectId !== validated.subjectId) {
              throw new InvalidRelationshipError(
                'Question',
                'topicId',
                'Topic',
                validated.topicId
              )
            }
          }

          const timestamp = this.now()
          const newQuestion = {
            subjectId: validated.subjectId,
            topicId: validated.topicId,
            questionText: validated.questionText,
            options: [...validated.options], // Defensive copy of options array
            correctOptionIndex: validated.correctOptionIndex,
            explanation: validated.explanation,
            difficulty: validated.difficulty,
            bookmarkStatus: validated.bookmarkStatus,
            createdAt: timestamp,
            updatedAt: timestamp
          }

          const id = await this.db.questions.add(newQuestion)
          return {
            id,
            ...newQuestion
          }
        } catch (err) {
          repoError = err
          throw err
        }
      })
    } catch (err) {
      if (repoError) {
        throw reconstructRepositoryError(repoError)
      }
      if (err && typeof err === 'object' && 'inner' in err && isRepositoryOrSerializedError(err.inner)) {
        throw reconstructRepositoryError(err.inner)
      }
      if (isRepositoryOrSerializedError(err)) {
        throw reconstructRepositoryError(err)
      }
      translatePersistenceError(err, {
        entityType: 'Question',
        operation: 'create'
      })
    }
  }

  async getById(id: number): Promise<Question | undefined> {
    try {
      return await this.db.questions.get(id)
    } catch (err) {
      translatePersistenceError(err, {
        entityType: 'Question',
        operation: 'read'
      })
    }
  }

  async requireById(id: number): Promise<Question> {
    const question = await this.getById(id)
    if (!question) {
      throw new NotFoundError('Question', id)
    }
    return question
  }

  async getByIds(ids: number[]): Promise<Question[]> {
    try {
      if (ids.length === 0) return []
      const results = await this.db.questions.bulkGet(ids)
      return results.filter((q): q is Question => q !== undefined)
    } catch (err) {
      translatePersistenceError(err, {
        entityType: 'Question',
        operation: 'read'
      })
    }
  }

  async update(id: number, input: QuestionUpdateInput): Promise<Question> {
    const parsed = validateSchema(questionUpdateSchema, input, 'Question')
    let repoError: unknown = null

    try {
      return await this.db.transaction('rw', [this.db.questions, this.db.topics], async () => {
        try {
          const current = await this.db.questions.get(id)
          if (!current) {
            throw new NotFoundError('Question', id)
          }

          // Enforce Subject immutability
          if (parsed.subjectId !== undefined && parsed.subjectId !== current.subjectId) {
            throw new ValidationError(
              'Question',
              new z.ZodError([
                {
                  code: 'custom',
                  path: ['subjectId'],
                  message: 'subjectId is immutable after creation'
                }
              ])
            )
          }

          // Merge mutable fields
          const merged = {
            subjectId: current.subjectId,
            topicId: parsed.topicId !== undefined ? parsed.topicId : current.topicId,
            questionText: parsed.questionText !== undefined ? parsed.questionText : current.questionText,
            options: parsed.options !== undefined ? parsed.options : current.options,
            correctOptionIndex: parsed.correctOptionIndex !== undefined ? parsed.correctOptionIndex : current.correctOptionIndex,
            explanation: parsed.explanation !== undefined ? parsed.explanation : current.explanation,
            difficulty: parsed.difficulty !== undefined ? parsed.difficulty : current.difficulty,
            bookmarkStatus: parsed.bookmarkStatus !== undefined ? parsed.bookmarkStatus : current.bookmarkStatus
          }

          // Project creation-schema fields and validate
          const projection = {
            subjectId: merged.subjectId,
            topicId: merged.topicId,
            questionText: merged.questionText,
            options: merged.options,
            correctOptionIndex: merged.correctOptionIndex,
            explanation: merged.explanation,
            difficulty: merged.difficulty,
            bookmarkStatus: merged.bookmarkStatus
          }
          validateSchema(questionCreateSchema, projection, 'Question')

          // Revalidate topic relationship if numeric
          if (merged.topicId !== null) {
            const topic = await this.db.topics.get(merged.topicId)
            if (!topic) {
              throw new InvalidRelationshipError(
                'Question',
                'topicId',
                'Topic',
                merged.topicId
              )
            }
            if (topic.subjectId !== merged.subjectId) {
              throw new InvalidRelationshipError(
                'Question',
                'topicId',
                'Topic',
                merged.topicId
              )
            }
          }

          const timestamp = this.now()
          const updatedQuestion: Question = {
            id,
            subjectId: merged.subjectId,
            topicId: merged.topicId,
            questionText: merged.questionText,
            options: [...merged.options], // Defensive copy of options array
            correctOptionIndex: merged.correctOptionIndex,
            explanation: merged.explanation,
            difficulty: merged.difficulty,
            bookmarkStatus: merged.bookmarkStatus,
            createdAt: current.createdAt,
            updatedAt: timestamp
          }

          try {
            await this.db.questions.put(updatedQuestion)
            return updatedQuestion
          } catch (err) {
            translatePersistenceError(err, {
              entityType: 'Question',
              operation: 'update'
            })
          }
        } catch (err) {
          repoError = err
          throw err
        }
      })
    } catch (err) {
      if (repoError) {
        throw reconstructRepositoryError(repoError)
      }
      if (err && typeof err === 'object' && 'inner' in err && isRepositoryOrSerializedError(err.inner)) {
        throw reconstructRepositoryError(err.inner)
      }
      if (isRepositoryOrSerializedError(err)) {
        throw reconstructRepositoryError(err)
      }
      translatePersistenceError(err, {
        entityType: 'Question',
        operation: 'update'
      })
    }
  }

  async toggleBookmark(id: number): Promise<Question> {
    let repoError: unknown = null

    try {
      return await this.db.transaction('rw', [this.db.questions], async () => {
        try {
          const current = await this.db.questions.get(id)
          if (!current) {
            throw new NotFoundError('Question', id)
          }

          const nextStatus = current.bookmarkStatus === 0 ? 1 : 0
          const timestamp = this.now()

          const updatedQuestion: Question = {
            ...current,
            bookmarkStatus: nextStatus,
            updatedAt: timestamp
          }

          try {
            await this.db.questions.put(updatedQuestion)
            return updatedQuestion
          } catch (err) {
            translatePersistenceError(err, {
              entityType: 'Question',
              operation: 'update'
            })
          }
        } catch (err) {
          repoError = err
          throw err
        }
      })
    } catch (err) {
      if (repoError) {
        throw reconstructRepositoryError(repoError)
      }
      if (err && typeof err === 'object' && 'inner' in err && isRepositoryOrSerializedError(err.inner)) {
        throw reconstructRepositoryError(err.inner)
      }
      if (isRepositoryOrSerializedError(err)) {
        throw reconstructRepositoryError(err)
      }
      translatePersistenceError(err, {
        entityType: 'Question',
        operation: 'update'
      })
    }
  }

  async search(filter: QuestionSearchFilter): Promise<Question[]> {
    const validated = validateSchema(questionSearchFilterSchema, filter, 'Question')

    const subjectId = validated.subjectId
    const topicFilter = validated.topicFilter ?? { kind: 'all' }

    let questions: Question[] = []

    try {
      if (topicFilter.kind === 'all') {
        questions = await this.db.questions.where('subjectId').equals(subjectId).toArray()
      } else if (topicFilter.kind === 'topic') {
        questions = await this.db.questions.where('[subjectId+topicId]').equals([subjectId, topicFilter.topicId]).toArray()
      } else {
        questions = await this.db.questions.where('subjectId').equals(subjectId).toArray()
      }
    } catch (err) {
      translatePersistenceError(err, {
        entityType: 'Question',
        operation: 'read'
      })
    }

    let results = questions

    if (topicFilter.kind === 'uncategorized') {
      results = results.filter((q) => q.topicId === null)
    }

    if (validated.difficulty !== undefined) {
      results = results.filter((q) => q.difficulty === validated.difficulty)
    }

    if (validated.bookmarkStatus !== undefined) {
      results = results.filter((q) => q.bookmarkStatus === validated.bookmarkStatus)
    }

    if (validated.searchText !== undefined) {
      const queryStr = normalizeName(validated.searchText)
      results = results.filter((q) => {
        const textMatch = normalizeName(q.questionText).includes(queryStr)
        const optionsMatch = q.options.some((opt) => normalizeName(opt).includes(queryStr))
        const explanationMatch = q.explanation !== null && normalizeName(q.explanation).includes(queryStr)
        return textMatch || optionsMatch || explanationMatch
      })
    }

    results.sort((a, b) => {
      if (b.createdAt !== a.createdAt) {
        return b.createdAt - a.createdAt
      }
      return b.id - a.id
    })

    return results
  }

  async countBySubject(subjectId: number): Promise<number> {
    validateSchema(positiveIdSchema, subjectId, 'Question')
    try {
      return await this.db.questions.where('subjectId').equals(subjectId).count()
    } catch (err) {
      translatePersistenceError(err, {
        entityType: 'Question',
        operation: 'read'
      })
    }
  }

  async countByTopic(topicId: number): Promise<number> {
    validateSchema(positiveIdSchema, topicId, 'Question')
    try {
      return await this.db.questions.where('topicId').equals(topicId).count()
    } catch (err) {
      translatePersistenceError(err, {
        entityType: 'Question',
        operation: 'read'
      })
    }
  }

  async delete(id: number): Promise<void> {
    validateSchema(positiveIdSchema, id, 'Question')
    let repoError: unknown = null

    try {
      await this.db.transaction('rw', [this.db.questions, this.db.answerAttempts], async () => {
        try {
          const current = await this.db.questions.get(id)
          if (!current) {
            throw new NotFoundError('Question', id)
          }

          // Modify AnswerAttempts
          await this.db.answerAttempts.where('questionId').equals(id).modify({
            questionId: null
          })

          // Delete Question
          await this.db.questions.delete(id)
        } catch (err) {
          repoError = err
          throw err
        }
      })
    } catch (err) {
      if (repoError) {
        throw reconstructRepositoryError(repoError)
      }
      if (err && typeof err === 'object' && 'inner' in err && isRepositoryOrSerializedError(err.inner)) {
        throw reconstructRepositoryError(err.inner)
      }
      if (isRepositoryOrSerializedError(err)) {
        throw reconstructRepositoryError(err)
      }
      translatePersistenceError(err, {
        entityType: 'Question',
        operation: 'delete'
      })
    }
  }
}
