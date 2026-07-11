import { z } from 'zod'

export const topicCreateSchema = z.object({
  subjectId: z.number().int().positive('subjectId must be a positive integer'),
  name: z.string().trim().min(1, 'Name cannot be empty')
}).strict()

export const topicUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty').optional()
}).strict().refine(
  (data) => {
    const keys = Object.keys(data) as (keyof typeof data)[]
    return keys.some((key) => data[key] !== undefined)
  },
  {
    message: 'Update payload must contain at least one field'
  }
)
