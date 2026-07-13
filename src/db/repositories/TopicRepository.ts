import { z } from 'zod'
import { type QuizDatabase } from '../database'
import {
  type Topic,
  type TopicInput,
  type TopicUpdateInput
} from '../../types/db'
import { topicCreateSchema, topicUpdateSchema } from '../../schemas/topicSchema'
import { normalizeName } from '../../utils/normalizeName'
import {
  validateSchema,
  translatePersistenceError,
  NotFoundError,
  DuplicateNameError,
  InvalidRelationshipError,
  ValidationError,
  isRepositoryOrSerializedError,
  reconstructRepositoryError
} from '../errors'

export class TopicRepository {
  private readonly db: QuizDatabase
  private readonly now: () => number

  constructor(db: QuizDatabase, now: () => number = Date.now) {
    this.db = db
    this.now = now
  }

  async create(input: TopicInput): Promise<Topic> {
    const validated = validateSchema(topicCreateSchema, input, 'Topic')
    const displayName = validated.name
    const normalized = normalizeName(displayName)
    const timestamp = this.now()

    // Parent Subject validation
    const subject = await this.db.subjects.get(validated.subjectId)
    if (!subject) {
      throw new InvalidRelationshipError(
        'Topic',
        'subjectId',
        'Subject',
        validated.subjectId
      )
    }

    // Compound duplicate check [subjectId+normalizedName]
    const existing = await this.db.topics
      .where('[subjectId+normalizedName]')
      .equals([validated.subjectId, normalized])
      .first()
    if (existing) {
      throw new DuplicateNameError('Topic', displayName, 'name')
    }

    try {
      const id = await this.db.topics.add({
        subjectId: validated.subjectId,
        name: displayName,
        normalizedName: normalized,
        createdAt: timestamp
      })
      return {
        id,
        subjectId: validated.subjectId,
        name: displayName,
        normalizedName: normalized,
        createdAt: timestamp
      }
    } catch (err) {
      translatePersistenceError(err, {
        entityType: 'Topic',
        operation: 'create',
        duplicateNameContext: { conflictingValue: displayName, field: 'name' }
      })
    }
  }

  async getById(id: number): Promise<Topic | undefined> {
    try {
      return await this.db.topics.get(id)
    } catch (err) {
      translatePersistenceError(err, {
        entityType: 'Topic',
        operation: 'read'
      })
    }
  }

  async requireById(id: number): Promise<Topic> {
    const topic = await this.getById(id)
    if (!topic) {
      throw new NotFoundError('Topic', id)
    }
    return topic
  }

  async getBySubject(subjectId: number): Promise<Topic[]> {
    if (typeof subjectId !== 'number' || isNaN(subjectId) || subjectId <= 0) {
      throw new ValidationError('Topic', new z.ZodError([{
        code: 'custom',
        path: ['subjectId'],
        message: 'subjectId must be a positive integer'
      }]))
    }

    try {
      const list = await this.db.topics.where('subjectId').equals(subjectId).toArray()
      return list.sort((a, b) => {
        const cmp = a.normalizedName.localeCompare(b.normalizedName)
        if (cmp !== 0) return cmp
        return a.id - b.id
      })
    } catch (err) {
      translatePersistenceError(err, {
        entityType: 'Topic',
        operation: 'read'
      })
    }
  }

  async getAll(): Promise<Topic[]> {
    try {
      const list = await this.db.topics.toArray()
      return list.sort((a, b) => {
        const cmp = a.normalizedName.localeCompare(b.normalizedName)
        if (cmp !== 0) return cmp
        return a.id - b.id
      })
    } catch (err) {
      translatePersistenceError(err, {
        entityType: 'Topic',
        operation: 'read'
      })
    }
  }

  async update(id: number, input: TopicUpdateInput): Promise<Topic> {
    const parsed = validateSchema(topicUpdateSchema, input, 'Topic')
    let repoError: unknown = null

    try {
      return await this.db.transaction('rw', [this.db.topics], async () => {
        try {
          const current = await this.db.topics.get(id)
          if (!current) {
            throw new NotFoundError('Topic', id)
          }

          // Merge only mutable fields
          const merged = {
            subjectId: current.subjectId, // subjectId remains immutable
            name: parsed.name !== undefined ? parsed.name : current.name
          }

          // Project and validate
          const projection = {
            subjectId: merged.subjectId,
            name: merged.name
          }
          validateSchema(topicCreateSchema, projection, 'Topic')

          const nameChanged = merged.name !== current.name
          const normalized = nameChanged ? normalizeName(merged.name) : current.normalizedName

          if (nameChanged) {
            const existing = await this.db.topics
              .where('[subjectId+normalizedName]')
              .equals([current.subjectId, normalized])
              .first()
            if (existing && existing.id !== id) {
              throw new DuplicateNameError('Topic', merged.name, 'name')
            }
          }

          const updatedTopic: Topic = {
            id,
            subjectId: current.subjectId,
            name: merged.name,
            normalizedName: normalized,
            createdAt: current.createdAt
          }

          try {
            await this.db.topics.put(updatedTopic)
            return updatedTopic
          } catch (err) {
            translatePersistenceError(err, {
              entityType: 'Topic',
              operation: 'update',
              duplicateNameContext: { conflictingValue: merged.name, field: 'name' }
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
        entityType: 'Topic',
        operation: 'update'
      })
    }
  }

  async delete(id: number): Promise<void> {
    let repoError: unknown = null

    try {
      await this.db.transaction(
        'rw',
        [this.db.topics, this.db.questions, this.db.quizAttempts],
        async () => {
          try {
            const current = await this.db.topics.get(id)
            if (!current) {
              throw new NotFoundError('Topic', id)
            }

            // Reassign current Questions topicId to null
            await this.db.questions.where('topicId').equals(id).modify({
              topicId: null
            })

            // Reassign QuizAttempts topicId to null
            await this.db.quizAttempts.where('topicId').equals(id).modify({
              topicId: null
            })

            // Delete Topic
            await this.db.topics.delete(id)
          } catch (err) {
            repoError = err
            throw err
          }
        }
      )
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
        entityType: 'Topic',
        operation: 'delete'
      })
    }
  }
}
