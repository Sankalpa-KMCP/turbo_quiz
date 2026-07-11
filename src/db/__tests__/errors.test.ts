import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import Dexie from 'dexie'
import {
  DuplicateNameError,
  NotFoundError,
  ValidationError,
  InvalidRelationshipError,
  PersistenceError,
  isRepositoryError,
  validateSchema,
  translatePersistenceError
} from '../errors'

describe('Repository Errors', () => {
  it('should instantiate DuplicateNameError with correct properties', () => {
    const cause = new Error('Original constraint failure')
    const err = new DuplicateNameError('Subject', 'Biology', 'normalizedName', cause)

    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(DuplicateNameError)
    expect(err.code).toBe('DUPLICATE_NAME')
    expect(err.name).toBe('DuplicateNameError')
    expect(err.entityType).toBe('Subject')
    expect(err.conflictingValue).toBe('Biology')
    expect(err.field).toBe('normalizedName')
    expect(err.cause).toBe(cause)
    expect(err.message).toBe('Subject with normalizedName "Biology" already exists.')
  })

  it('should instantiate NotFoundError with correct properties', () => {
    const err = new NotFoundError('Topic', 123)

    expect(err).toBeInstanceOf(NotFoundError)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.name).toBe('NotFoundError')
    expect(err.entityType).toBe('Topic')
    expect(err.entityId).toBe(123)
    expect(err.message).toBe('Topic with ID 123 was not found.')
  })

  it('should instantiate ValidationError with correct properties and issues', () => {
    const schema = z.object({ age: z.number().min(18) })
    const result = schema.safeParse({ age: 15 })

    expect(result.success).toBe(false)
    if (!result.success) {
      const err = new ValidationError('User', result.error)
      expect(err).toBeInstanceOf(ValidationError)
      expect(err.code).toBe('VALIDATION_ERROR')
      expect(err.name).toBe('ValidationError')
      expect(err.entityType).toBe('User')
      expect(err.issues).toHaveLength(1)
      expect(err.issues[0].path).toEqual(['age'])
      expect(err.cause).toBe(result.error)
    }
  })

  it('should instantiate InvalidRelationshipError with correct properties', () => {
    const err = new InvalidRelationshipError('Question', 'topicId', 'Topic', 99)

    expect(err).toBeInstanceOf(InvalidRelationshipError)
    expect(err.code).toBe('INVALID_RELATIONSHIP')
    expect(err.name).toBe('InvalidRelationshipError')
    expect(err.entityType).toBe('Question')
    expect(err.foreignKey).toBe('topicId')
    expect(err.referencedEntityType).toBe('Topic')
    expect(err.referencedId).toBe(99)
    expect(err.message).toBe('Cannot save Question: referenced Topic with ID 99 (on field "topicId") does not exist.')
  })

  it('should instantiate PersistenceError with correct properties', () => {
    const cause = new Error('Database locked')
    const err = new PersistenceError('Subject', 'create', cause)

    expect(err).toBeInstanceOf(PersistenceError)
    expect(err.code).toBe('PERSISTENCE_ERROR')
    expect(err.name).toBe('PersistenceError')
    expect(err.entityType).toBe('Subject')
    expect(err.operation).toBe('create')
    expect(err.cause).toBe(cause)
    expect(err.message).toBe('Failed to create Subject: Database locked')
  })
})

describe('isRepositoryError Type Guard', () => {
  it('should return true for all repository errors', () => {
    expect(isRepositoryError(new DuplicateNameError('Subject', 'Biology'))).toBe(true)
    expect(isRepositoryError(new NotFoundError('Subject', 1))).toBe(true)
    expect(isRepositoryError(new ValidationError('Subject', new z.ZodError([])))).toBe(true)
    expect(isRepositoryError(new InvalidRelationshipError('Topic', 'subjectId', 'Subject', 1))).toBe(true)
    expect(isRepositoryError(new PersistenceError('Subject', 'create', new Error()))).toBe(true)
  })

  it('should return false for ordinary errors or plain objects', () => {
    expect(isRepositoryError(new Error('Ordinary error'))).toBe(false)
    expect(isRepositoryError(null)).toBe(false)
    expect(isRepositoryError(undefined)).toBe(false)
    expect(isRepositoryError({ code: 'DUPLICATE_NAME', message: 'Fake error' })).toBe(false)
  })
})

describe('validateSchema Zod Helper', () => {
  const schema = z.object({
    name: z.string().trim().toUpperCase().min(1),
    active: z.boolean().default(true)
  })

  it('should validate and parse input including defaults, transforms, and preprocessing', () => {
    const input: unknown = { name: '  chemistry  ' }
    const output = validateSchema(schema, input, 'Subject')

    expect(output).toEqual({
      name: 'CHEMISTRY',
      active: true
    })
  })

  it('should throw ValidationError on schema failure and preserve Zod issues', () => {
    const input: unknown = { name: '   ', active: 'not-a-boolean' }

    expect(() => validateSchema(schema, input, 'Subject')).toThrow(ValidationError)

    try {
      validateSchema(schema, input, 'Subject')
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError)
      if (err instanceof ValidationError) {
        expect(err.entityType).toBe('Subject')
        expect(err.issues).toHaveLength(2)
        expect(err.cause).toBeInstanceOf(z.ZodError)
      }
    }
  })
})

describe('translatePersistenceError Helper', () => {
  const context = {
    entityType: 'Subject',
    operation: 'create' as const,
    duplicateNameContext: {
      conflictingValue: 'Maths',
      field: 'normalizedName'
    }
  }

  it('should rethrow pre-existing RepositoryErrors unchanged', () => {
    const originalErr = new NotFoundError('Subject', 1)
    expect(() => translatePersistenceError(originalErr, context)).toThrow(originalErr)
  })

  it('should translate ConstraintError to DuplicateNameError when context is supplied', () => {
    const dexieConstraintErr = new Dexie.ConstraintError('Unique key constraint failed')

    try {
      translatePersistenceError(dexieConstraintErr, context)
    } catch (err) {
      expect(err).toBeInstanceOf(DuplicateNameError)
      if (err instanceof DuplicateNameError) {
        expect(err.entityType).toBe('Subject')
        expect(err.conflictingValue).toBe('Maths')
        expect(err.field).toBe('normalizedName')
        expect(err.cause).toBe(dexieConstraintErr)
      }
    }
  })

  it('should wrap ConstraintError in PersistenceError when duplicateNameContext is absent', () => {
    const dexieConstraintErr = new Dexie.ConstraintError('Unique key constraint failed')
    const noDupContext = { entityType: 'Subject', operation: 'create' as const }

    try {
      translatePersistenceError(dexieConstraintErr, noDupContext)
    } catch (err) {
      expect(err).toBeInstanceOf(PersistenceError)
      if (err instanceof PersistenceError) {
        expect(err.entityType).toBe('Subject')
        expect(err.operation).toBe('create')
        expect(err.cause).toBe(dexieConstraintErr)
      }
    }
  })

  it('should wrap other DexieErrors in PersistenceError', () => {
    const dexieDataErr = new Dexie.DataError('Database operation rejected')

    try {
      translatePersistenceError(dexieDataErr, context)
    } catch (err) {
      expect(err).toBeInstanceOf(PersistenceError)
      if (err instanceof PersistenceError) {
        expect(err.entityType).toBe('Subject')
        expect(err.operation).toBe('create')
        expect(err.cause).toBe(dexieDataErr)
      }
    }
  })

  it('should rethrow ordinary non-Dexie Errors unchanged', () => {
    const ordinaryErr = new TypeError('Cannot read property of undefined')
    expect(() => translatePersistenceError(ordinaryErr, context)).toThrow(ordinaryErr)
  })
})
