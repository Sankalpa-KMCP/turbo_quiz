import Dexie, { type Table } from 'dexie'
import type { Subject, Topic, Question, QuizAttempt, AnswerAttempt } from '../types/db'

export const DATABASE_NAME = 'TurboQuizDatabase'

export class QuizDatabase extends Dexie {
  subjects!: Table<Subject, number, Omit<Subject, 'id'>>
  topics!: Table<Topic, number, Omit<Topic, 'id'>>
  questions!: Table<Question, number, Omit<Question, 'id'>>
  quizAttempts!: Table<QuizAttempt, number, Omit<QuizAttempt, 'id'>>
  answerAttempts!: Table<AnswerAttempt, number, Omit<AnswerAttempt, 'id'>>

  constructor(databaseName: string) {
    super(databaseName)

    this.version(1).stores({
      subjects: '++id, &normalizedName, name, createdAt',
      topics: '++id, subjectId, &[subjectId+normalizedName], name, createdAt',
      questions: '++id, subjectId, topicId, [subjectId+topicId], difficulty, bookmarkStatus, createdAt',
      quizAttempts: '++id, subjectId, topicId, mode, completedAt',
      answerAttempts: '++id, quizAttemptId, questionId, isCorrect'
    })
  }
}

/**
 * Creates and initializes a new QuizDatabase instance.
 * Useful for unit tests requiring isolated in-memory or custom-named databases.
 *
 * @param name Unique name of the database
 * @returns QuizDatabase instance
 */
export function createDatabase(name: string): QuizDatabase {
  return new QuizDatabase(name)
}

/**
 * Production database singleton.
 * Note: Database is not opened immediately. Dexie will open it automatically
 * upon the first query, or when explicitly requested.
 */
export const db = createDatabase(DATABASE_NAME)
