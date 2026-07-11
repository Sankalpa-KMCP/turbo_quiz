import { type QuizDatabase } from '../database'
import {
  type Subject,
  type SubjectInput,
  type SubjectUpdateInput
} from '../../types/db'
import { subjectCreateSchema, subjectUpdateSchema } from '../../schemas/subjectSchema'
import { normalizeName } from '../../utils/normalizeName'
import {
  validateSchema,
  translatePersistenceError,
  NotFoundError,
  DuplicateNameError,
  isRepositoryOrSerializedError,
  reconstructRepositoryError
} from '../errors'

export class SubjectRepository {
  private readonly db: QuizDatabase
  private readonly now: () => number

  constructor(db: QuizDatabase, now: () => number = Date.now) {
    this.db = db
    this.now = now
  }

  async create(input: SubjectInput): Promise<Subject> {
    const validated = validateSchema(subjectCreateSchema, input, 'Subject')
    const displayName = validated.name
    const normalized = normalizeName(displayName)
    const timestamp = this.now()

    // Friendly pre-check
    const existing = await this.db.subjects.where('normalizedName').equals(normalized).first()
    if (existing) {
      throw new DuplicateNameError('Subject', displayName, 'name')
    }

    try {
      const id = await this.db.subjects.add({
        name: displayName,
        normalizedName: normalized,
        description: validated.description,
        createdAt: timestamp,
        updatedAt: timestamp
      })
      return {
        id,
        name: displayName,
        normalizedName: normalized,
        description: validated.description,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    } catch (err) {
      translatePersistenceError(err, {
        entityType: 'Subject',
        operation: 'create',
        duplicateNameContext: { conflictingValue: displayName, field: 'name' }
      })
    }
  }

  async getById(id: number): Promise<Subject | undefined> {
    try {
      return await this.db.subjects.get(id)
    } catch (err) {
      translatePersistenceError(err, {
        entityType: 'Subject',
        operation: 'read'
      })
    }
  }

  async requireById(id: number): Promise<Subject> {
    const subject = await this.getById(id)
    if (!subject) {
      throw new NotFoundError('Subject', id)
    }
    return subject
  }

  async getAll(): Promise<Subject[]> {
    try {
      const list = await this.db.subjects.toArray()
      return list.sort((a, b) => {
        const cmp = a.normalizedName.localeCompare(b.normalizedName)
        if (cmp !== 0) return cmp
        return a.id - b.id
      })
    } catch (err) {
      translatePersistenceError(err, {
        entityType: 'Subject',
        operation: 'read'
      })
    }
  }

  async update(id: number, input: SubjectUpdateInput): Promise<Subject> {
    const parsed = validateSchema(subjectUpdateSchema, input, 'Subject')
    let repoError: unknown = null

    try {
      return await this.db.transaction('rw', [this.db.subjects], async () => {
        try {
          const current = await this.db.subjects.get(id)
          if (!current) {
            throw new NotFoundError('Subject', id)
          }

          // Merge only mutable fields
          const merged = {
            name: parsed.name !== undefined ? parsed.name : current.name,
            description: parsed.description !== undefined ? parsed.description : current.description
          }

          // Project user-controlled fields and validate
          const projection = {
            name: merged.name,
            description: merged.description
          }
          validateSchema(subjectCreateSchema, projection, 'Subject')

          const nameChanged = merged.name !== current.name
          const normalized = nameChanged ? normalizeName(merged.name) : current.normalizedName

          if (nameChanged) {
            const existing = await this.db.subjects.where('normalizedName').equals(normalized).first()
            if (existing && existing.id !== id) {
              throw new DuplicateNameError('Subject', merged.name, 'name')
            }
          }

          const timestamp = this.now()
          const updatedSubject: Subject = {
            id,
            name: merged.name,
            normalizedName: normalized,
            description: merged.description,
            createdAt: current.createdAt,
            updatedAt: timestamp
          }

          try {
            await this.db.subjects.put(updatedSubject)
            return updatedSubject
          } catch (err) {
            translatePersistenceError(err, {
              entityType: 'Subject',
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
        entityType: 'Subject',
        operation: 'update'
      })
    }
  }

  async delete(id: number): Promise<void> {
    let repoError: unknown = null

    try {
      await this.db.transaction(
        'rw',
        [this.db.subjects, this.db.topics, this.db.questions, this.db.quizAttempts, this.db.answerAttempts],
        async () => {
          try {
            const current = await this.db.subjects.get(id)
            if (!current) {
              throw new NotFoundError('Subject', id)
            }

            // Load all Topics
            const topics = await this.db.topics.where('subjectId').equals(id).toArray()
            const topicIds = topics.map((t) => t.id!)

            // Load all Questions
            const questions = await this.db.questions.where('subjectId').equals(id).toArray()
            const questionIds = questions.map((q) => q.id!)

            // Load QuizAttempts matching subjectId
            const attemptsBySubject = await this.db.quizAttempts.where('subjectId').equals(id).toArray()

            // Load QuizAttempts matching topicId in topicIds
            let attemptsByTopic: typeof attemptsBySubject = []
            if (topicIds.length > 0) {
              attemptsByTopic = await this.db.quizAttempts.where('topicId').anyOf(topicIds).toArray()
            }

            // Union Attempt IDs
            const attemptIdsMap = new Map<number, boolean>()
            attemptsBySubject.forEach((a) => attemptIdsMap.set(a.id!, true))
            attemptsByTopic.forEach((a) => attemptIdsMap.set(a.id!, true))
            const attemptIds = Array.from(attemptIdsMap.keys())

            // Modify QuizAttempts
            if (attemptIds.length > 0) {
              await this.db.quizAttempts.where('id').anyOf(attemptIds).modify({
                subjectId: null,
                topicId: null
              })
            }

            // Modify AnswerAttempts
            if (questionIds.length > 0) {
              await this.db.answerAttempts.where('questionId').anyOf(questionIds).modify({
                questionId: null
              })
            }

            // Bulk delete Questions
            if (questionIds.length > 0) {
              await this.db.questions.bulkDelete(questionIds)
            }

            // Bulk delete Topics
            if (topicIds.length > 0) {
              await this.db.topics.bulkDelete(topicIds)
            }

            // Delete Subject
            await this.db.subjects.delete(id)
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
        entityType: 'Subject',
        operation: 'delete'
      })
    }
  }
}
