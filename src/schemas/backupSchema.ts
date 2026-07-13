import { z } from 'zod'
import type { Subject, Topic, Question, QuizAttempt, AnswerAttempt } from '../types/db'

// Version 1 schema for Subjects
const subjectBackupSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(1),
  normalizedName: z.string().trim().min(1),
  description: z.string().nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative()
}).strict()

// Version 1 schema for Topics
const topicBackupSchema = z.object({
  id: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  name: z.string().trim().min(1),
  normalizedName: z.string().trim().min(1),
  createdAt: z.number().int().nonnegative()
}).strict()

// Version 1 schema for Questions
const questionBackupSchema = z.object({
  id: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  topicId: z.number().int().positive().nullable(),
  questionText: z.string().trim().min(1),
  options: z.array(z.string().trim().min(1)).min(2).max(6),
  correctOptionIndex: z.number().int().nonnegative(),
  explanation: z.string().nullable(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  bookmarkStatus: z.union([z.literal(0), z.literal(1)]),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative()
}).strict()

// Version 1 schema for QuizAttempts
const quizAttemptBackupSchema = z.object({
  id: z.number().int().positive(),
  subjectId: z.number().int().positive().nullable(),
  topicId: z.number().int().positive().nullable(),
  mode: z.enum(['practice', 'exam', 'mistakes']),
  totalQuestions: z.number().int().nonnegative(),
  correctAnswers: z.number().int().nonnegative(),
  scorePercentage: z.number().nonnegative(),
  timeTakenSeconds: z.number().nonnegative(),
  startedAt: z.number().int().nonnegative(),
  completedAt: z.number().int().nonnegative(),
  subjectNameSnap: z.string().nullable(),
  topicNameSnap: z.string().nullable()
}).strict()

// Version 1 schema for AnswerAttempts
const answerAttemptBackupSchema = z.object({
  id: z.number().int().positive(),
  quizAttemptId: z.number().int().positive(),
  questionId: z.number().int().positive().nullable(),
  selectedOptionIndex: z.number().int().nonnegative().nullable(),
  correctOptionIndex: z.number().int().nonnegative(),
  isCorrect: z.boolean(),
  timeTakenSeconds: z.number().nonnegative(),
  questionSnapshot: z.object({
    questionText: z.string().trim().min(1),
    options: z.array(z.string().trim().min(1)).min(2).max(6),
    correctOptionIndex: z.number().int().nonnegative(),
    explanation: z.string().nullable(),
    difficulty: z.enum(['easy', 'medium', 'hard'])
  }).strict()
}).strict()

export const backupV1Schema = z.object({
  version: z.literal(1),
  exportedAt: z.number().int().nonnegative(),
  data: z.object({
    subjects: z.array(subjectBackupSchema),
    topics: z.array(topicBackupSchema),
    questions: z.array(questionBackupSchema),
    quizAttempts: z.array(quizAttemptBackupSchema),
    answerAttempts: z.array(answerAttemptBackupSchema)
  }).strict()
}).strict()

export interface BackupDataV1 {
  version: 1
  exportedAt: number
  data: {
    subjects: Subject[]
    topics: Topic[]
    questions: Question[]
    quizAttempts: QuizAttempt[]
    answerAttempts: AnswerAttempt[]
  }
}
