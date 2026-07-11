import { z } from 'zod'
import { normalizeName } from '../utils/normalizeName'

export const questionCreateSchema = z.object({
  subjectId: z.number().int().positive('subjectId must be a positive integer'),
  topicId: z.number().int().positive('topicId must be a positive integer').nullable(),
  questionText: z.string().trim().min(1, 'Question text cannot be empty'),
  options: z.array(z.string().trim().min(1, 'Option cannot be empty'))
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
  explanation: z.preprocess(
    (val) => (val === undefined || val === null ? null : val),
    z.string().trim().nullable()
  ).default(null),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  bookmarkStatus: z.union([z.literal(0), z.literal(1)]).default(0)
}).strict().refine((data) => {
  return data.correctOptionIndex < data.options.length
}, {
  message: 'Correct option index must point to a valid option',
  path: ['correctOptionIndex']
})

export const questionUpdateSchema = z.object({
  subjectId: z.number().int().positive('subjectId must be a positive integer').optional(),
  topicId: z.number().int().positive('topicId must be a positive integer').nullable().optional(),
  questionText: z.string().trim().min(1, 'Question text cannot be empty').optional(),
  options: z.array(z.string().trim().min(1, 'Option cannot be empty'))
    .min(2, 'At least 2 options are required')
    .max(6, 'At most 6 options are allowed')
    .refine((opts) => {
      const normalized = opts.map((opt) => normalizeName(opt))
      const unique = new Set(normalized)
      return unique.size === opts.length
    }, {
      message: 'Duplicate options are not allowed'
    }).optional(),
  correctOptionIndex: z.number().int().nonnegative('Correct option index must be non-negative').optional(),
  explanation: z.string().trim().nullable().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  bookmarkStatus: z.union([z.literal(0), z.literal(1)]).optional()
}).strict().refine(
  (data) => {
    const keys = Object.keys(data) as (keyof typeof data)[]
    return keys.some((key) => data[key] !== undefined)
  },
  {
    message: 'Update payload must contain at least one field'
  }
).refine((data) => {
  if (data.options !== undefined && data.correctOptionIndex !== undefined) {
    return data.correctOptionIndex < data.options.length
  }
  return true
}, {
  message: 'Correct option index must point to a valid option',
  path: ['correctOptionIndex']
})
