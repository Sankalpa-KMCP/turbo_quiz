import Dexie from 'dexie'
import { type z } from 'zod'

export type RepositoryErrorCode =
  | 'DUPLICATE_NAME'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'INVALID_RELATIONSHIP'
  | 'PERSISTENCE_ERROR'

/**
 * Base custom error for repository operations.
 */
export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode
  readonly cause?: unknown

  constructor(
    code: RepositoryErrorCode,
    message: string,
    cause?: unknown
  ) {
    super(message)
    this.code = code
    this.cause = cause
    // Restore prototype chain for ES5/TS compatibility
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * Thrown when a unique constraint (like normalizedName) is violated on Subject or Topic.
 */
export class DuplicateNameError extends RepositoryError {
  readonly entityType: string
  readonly conflictingValue: string
  readonly field: string

  constructor(
    entityType: string,
    conflictingValue: string,
    field: string = 'name',
    cause?: unknown
  ) {
    super(
      'DUPLICATE_NAME',
      `${entityType} with ${field} "${conflictingValue}" already exists.`,
      cause
    )
    this.entityType = entityType
    this.conflictingValue = conflictingValue
    this.field = field
    this.name = 'DuplicateNameError'
  }
}

/**
 * Thrown when a lookup by ID is expected to return a record but fails.
 */
export class NotFoundError extends RepositoryError {
  readonly entityType: string
  readonly entityId: number

  constructor(
    entityType: string,
    entityId: number,
    cause?: unknown
  ) {
    super(
      'NOT_FOUND',
      `${entityType} with ID ${entityId} was not found.`,
      cause
    )
    this.entityType = entityType
    this.entityId = entityId
    this.name = 'NotFoundError'
  }
}

/**
 * Wraps ZodError to prevent leaking raw Zod exceptions across repository boundaries.
 */
export class ValidationError extends RepositoryError {
  readonly entityType: string
  readonly zodError: z.ZodError

  constructor(
    entityType: string,
    zodError: z.ZodError,
    cause?: unknown
  ) {
    super(
      'VALIDATION_ERROR',
      `Validation failed for ${entityType}: ${zodError.message}`,
      cause || zodError
    )
    this.entityType = entityType
    this.zodError = zodError
    this.name = 'ValidationError'
  }

  get issues() {
    return this.zodError.issues
  }
}

/**
 * Thrown when parent reference/foreign key does not exist.
 */
export class InvalidRelationshipError extends RepositoryError {
  readonly entityType: string
  readonly foreignKey: string
  readonly referencedEntityType: string
  readonly referencedId: number

  constructor(
    entityType: string,
    foreignKey: string,
    referencedEntityType: string,
    referencedId: number,
    cause?: unknown
  ) {
    super(
      'INVALID_RELATIONSHIP',
      `Cannot save ${entityType}: referenced ${referencedEntityType} with ID ${referencedId} (on field "${foreignKey}") does not exist.`,
      cause
    )
    this.entityType = entityType
    this.foreignKey = foreignKey
    this.referencedEntityType = referencedEntityType
    this.referencedId = referencedId
    this.name = 'InvalidRelationshipError'
  }
}

/**
 * Fallback wrapper for unexpected database errors (from Dexie/IndexedDB).
 */
export class PersistenceError extends RepositoryError {
  readonly entityType: string
  readonly operation: 'create' | 'update' | 'delete' | 'read' | 'save'

  constructor(
    entityType: string,
    operation: 'create' | 'update' | 'delete' | 'read' | 'save',
    cause: unknown
  ) {
    const causeMessage = cause instanceof Error ? cause.message : String(cause)
    super(
      'PERSISTENCE_ERROR',
      `Failed to ${operation} ${entityType}: ${causeMessage}`,
      cause
    )
    this.entityType = entityType
    this.operation = operation
    this.name = 'PersistenceError'
  }
}

/**
 * Type guard for RepositoryError subclasses.
 * Work without unsafe double assertions or any casting.
 */
export function isRepositoryError(error: unknown): error is RepositoryError {
  return (
    error instanceof DuplicateNameError ||
    error instanceof NotFoundError ||
    error instanceof ValidationError ||
    error instanceof InvalidRelationshipError ||
    error instanceof PersistenceError
  )
}

/**
 * Private helper to detect both real and serialized repository errors.
 */
export function isRepositoryOrSerializedError(error: unknown): boolean {
  if (isRepositoryError(error)) {
    return true
  }
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>
    return (
      typeof obj.code === 'string' &&
      ['DUPLICATE_NAME', 'NOT_FOUND', 'VALIDATION_ERROR', 'INVALID_RELATIONSHIP', 'PERSISTENCE_ERROR'].includes(obj.code)
    )
  }
  return false
}

/**
 * Restores or reconstructs the proper RepositoryError subclass instance
 * to solve prototype chain loss during Dexie transaction abort errors.
 */
export function reconstructRepositoryError(error: unknown): unknown {
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>
    if (typeof obj.code === 'string') {
      switch (obj.code) {
        case 'DUPLICATE_NAME':
          return new DuplicateNameError(
            String(obj.entityType || ''),
            String(obj.conflictingValue || ''),
            String(obj.field || 'name'),
            obj.cause
          )
        case 'NOT_FOUND':
          return new NotFoundError(
            String(obj.entityType || ''),
            Number(obj.entityId || 0),
            obj.cause
          )
        case 'VALIDATION_ERROR':
          return new ValidationError(
            String(obj.entityType || ''),
            obj.zodError as z.ZodError,
            obj.cause
          )
        case 'INVALID_RELATIONSHIP':
          return new InvalidRelationshipError(
            String(obj.entityType || ''),
            String(obj.foreignKey || ''),
            String(obj.referencedEntityType || ''),
            Number(obj.referencedId || 0),
            obj.cause
          )
        case 'PERSISTENCE_ERROR':
          return new PersistenceError(
            String(obj.entityType || ''),
            obj.operation as 'create' | 'update' | 'delete' | 'read' | 'save',
            obj.cause
          )
      }
    }
  }
  return error
}

/**
 * Schema-generic Zod validation helper.
 * Validates unknown inputs against the schema, wrapping ZodError in ValidationError.
 */
export function validateSchema<Output, Input>(
  schema: z.ZodType<Output, Input>,
  data: unknown,
  entityType: string
): Output {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw new ValidationError(entityType, result.error)
  }
  return result.data
}

export interface DuplicateNameContext {
  conflictingValue: string
  field?: string
}

export interface PersistenceErrorContext {
  entityType: string
  operation: 'create' | 'update' | 'delete' | 'read' | 'save'
  duplicateNameContext?: DuplicateNameContext
}

/**
 * Translates errors thrown by Dexie/IndexedDB operations into typed RepositoryError instances.
 * Rethrows programmer/ordinary errors and pre-existing custom repository errors.
 */
export function translatePersistenceError(
  err: unknown,
  context: PersistenceErrorContext
): never {
  if (err && typeof err === 'object' && 'inner' in err && isRepositoryOrSerializedError(err.inner)) {
    throw reconstructRepositoryError(err.inner)
  }

  if (isRepositoryOrSerializedError(err)) {
    throw reconstructRepositoryError(err)
  }

  // Identify unique constraint collisions
  const isConstraint =
    err instanceof Dexie.ConstraintError ||
    (err instanceof Error && err.name === 'ConstraintError')

  if (isConstraint) {
    if (context.duplicateNameContext) {
      throw new DuplicateNameError(
        context.entityType,
        context.duplicateNameContext.conflictingValue,
        context.duplicateNameContext.field || 'name',
        err
      )
    } else {
      throw new PersistenceError(context.entityType, context.operation, err)
    }
  }

  // Identify other database-related Dexie exceptions
  const isDexieError =
    err instanceof Dexie.DexieError ||
    (err instanceof Error && (err.name in Dexie.errnames || err.constructor.name === 'DexieError'))

  if (isDexieError) {
    throw new PersistenceError(context.entityType, context.operation, err)
  }

  // Rethrow ordinary non-Dexie exceptions (e.g. TypeErrors) unchanged
  throw err
}
