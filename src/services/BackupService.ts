import { db } from '../db/database'
import { backupV1Schema, type BackupDataV1 } from '../schemas/backupSchema'

export class BackupService {
  /**
   * Generates a full V1 backup of the database as a JSON string.
   */
  static async exportBackup(): Promise<string> {
    const data: BackupDataV1 = await db.transaction(
      'r',
      [db.subjects, db.topics, db.questions, db.quizAttempts, db.answerAttempts],
      async () => {
        const subjects = await db.subjects.toArray()
        const topics = await db.topics.toArray()
        const questions = await db.questions.toArray()
        const quizAttempts = await db.quizAttempts.toArray()
        const answerAttempts = await db.answerAttempts.toArray()

        return {
          version: 1,
          exportedAt: Date.now(),
          data: {
            subjects,
            topics,
            questions,
            quizAttempts,
            answerAttempts
          }
        }
      }
    )

    // Using stable stringify if needed, but JSON.stringify is fine here.
    return JSON.stringify(data)
  }

  /**
   * Validates a JSON string against the V1 backup schema.
   * Throws an error if invalid.
   */
  static async validateBackup(jsonString: string): Promise<BackupDataV1> {
    try {
      const parsed = JSON.parse(jsonString)
      const validated = backupV1Schema.parse(parsed)
      // backupV1Schema infers a slightly different internal type due to Zod, 
      // but it aligns with BackupDataV1 structurally.
      return validated as BackupDataV1
    } catch (err) {
      if (err instanceof Error) {
        throw new Error(`Invalid backup file: ${err.message}`, { cause: err })
      }
      throw new Error('Invalid backup file', { cause: err })
    }
  }

  /**
   * Restores a validated V1 backup, entirely replacing existing data.
   */
  static async restoreBackup(backup: BackupDataV1): Promise<void> {
    await db.transaction(
      'rw',
      [db.subjects, db.topics, db.questions, db.quizAttempts, db.answerAttempts],
      async () => {
        // Clear all existing data
        await db.subjects.clear()
        await db.topics.clear()
        await db.questions.clear()
        await db.quizAttempts.clear()
        await db.answerAttempts.clear()

        // Insert new data
        await db.subjects.bulkAdd(backup.data.subjects)
        await db.topics.bulkAdd(backup.data.topics)
        await db.questions.bulkAdd(backup.data.questions)
        await db.quizAttempts.bulkAdd(backup.data.quizAttempts)
        await db.answerAttempts.bulkAdd(backup.data.answerAttempts)
      }
    )
  }

  /**
   * Clears all user data (factory reset).
   */
  static async resetDatabase(): Promise<void> {
    await db.transaction(
      'rw',
      [db.subjects, db.topics, db.questions, db.quizAttempts, db.answerAttempts],
      async () => {
        await db.subjects.clear()
        await db.topics.clear()
        await db.questions.clear()
        await db.quizAttempts.clear()
        await db.answerAttempts.clear()
      }
    )
  }
}
