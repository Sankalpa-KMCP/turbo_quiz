import { z } from 'zod'
import { normalizeName } from '../utils/normalizeName'

const difficultySchema = z.enum(['easy', 'medium', 'hard'])

const questionSnapshotSchema = z.object({
  questionText: z.string().refine(val => val.trim().length > 0, {
    message: 'Question text cannot be empty'
  }),
  options: z.array(
    z.string().refine(val => val.trim().length > 0, {
      message: 'Option cannot be empty'
    })
  )
    .min(2, 'At least 2 options are required')
    .max(6, 'At most 6 options are allowed')
    .refine((opts) => {
      const normalized = opts.map((opt) => normalizeName(opt))
      const unique = new Set(normalized)
      return unique.size === opts.length
    }, {
      message: 'Duplicate options are not allowed'
    }),
  correctOptionIndex: z.number().int().nonnegative('Correct option index must be non-negative'),
  explanation: z.string().nullable(),
  difficulty: difficultySchema
}).strict().refine((data) => {
  return data.correctOptionIndex < data.options.length
}, {
  message: 'Correct option index must point to a valid option',
  path: ['correctOptionIndex']
})

const answerAttemptSessionInputSchema = z.object({
  questionId: z.number().int().positive('questionId must be a positive integer'),
  selectedOptionIndex: z.number().int().nonnegative('selectedOptionIndex must be non-negative').nullable(),
  timeTakenSeconds: z.number().nonnegative('timeTakenSeconds must be non-negative'),
  questionSnapshot: questionSnapshotSchema
}).strict().refine((data) => {
  if (data.selectedOptionIndex !== null) {
    return data.selectedOptionIndex < data.questionSnapshot.options.length
  }
  return true
}, {
  message: 'Selected option index must point to a valid option',
  path: ['selectedOptionIndex']
})

export const quizAttemptSessionSaveSchema = z.object({
  subjectId: z.number().int().positive('subjectId must be a positive integer'),
  topicId: z.number().int().positive('topicId must be a positive integer').nullable(),
  subjectNameSnap: z.string().refine(val => val.trim().length > 0, {
    message: 'subjectNameSnap cannot be empty'
  }),
  topicNameSnap: z.string().refine(val => val.trim().length > 0, {
    message: 'topicNameSnap cannot be empty'
  }).nullable(),
  mode: z.enum(['practice', 'exam', 'mistakes']),
  startedAt: z.number().int().nonnegative('startedAt must be non-negative'),
  answers: z.array(answerAttemptSessionInputSchema)
    .min(1, 'At least one answer is required')
    .refine((answers) => {
      const ids = answers.map((a) => a.questionId)
      const unique = new Set(ids)
      return unique.size === answers.length
    }, {
      message: 'Duplicate question references are not allowed'
    })
}).strict().refine((data) => {
  if (data.topicId === null) {
    return data.topicNameSnap === null
  }
  return data.topicNameSnap !== null
}, {
  message: 'topicNameSnap must be null if topicId is null, and non-null if topicId is numeric',
  path: ['topicNameSnap']
})
