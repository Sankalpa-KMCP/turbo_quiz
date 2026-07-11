import { z } from 'zod'

export const subjectCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty'),
  description: z.preprocess(
    (val) => (val === undefined || val === null ? null : val),
    z.string().trim().nullable()
  ).default(null)
}).strict()

export const subjectUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty').optional(),
  description: z.string().trim().nullable().optional()
}).strict().refine(
  (data) => {
    const keys = Object.keys(data) as (keyof typeof data)[]
    return keys.some((key) => data[key] !== undefined)
  },
  {
    message: 'Update payload must contain at least one field'
  }
)
