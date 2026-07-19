import { z } from 'zod';

// Minimal entry point for shared package
export const SHARED_CONSTANT = "turboquiz-shared-v1";

export interface SharedConfig {
  version: string;
}

export function getSharedConfig(): SharedConfig {
  return {
    version: SHARED_CONSTANT
  };
}

// ==========================================
// AI Question Contracts (S0.4)
// ==========================================

/**
 * AI Generation Status values
 */
export const aiGenerationStatusSchema = z.enum([
  'queued',
  'processing',
  'completed',
  'failed',
  'cancelled'
]);

export type AiGenerationStatus = z.infer<typeof aiGenerationStatusSchema>;

/**
 * POST /api/ai/questions Request Contract
 */
export const aiQuestionRequestSchema = z.object({
  sourceText: z
    .string()
    .min(200, 'Source text must be at least 200 characters')
    .max(50000, 'Source text cannot exceed 50,000 characters'),
  questionCount: z
    .number()
    .int('Question count must be an integer')
    .min(1, 'Question count must be at least 1')
    .max(20, 'Question count cannot exceed 20'),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']),
  subjectName: z.string().trim().min(1, 'Subject name cannot be empty'),
  topicName: z.string().trim().min(1, 'Topic name cannot be empty').optional(),
  includeExplanations: z.boolean(),
  includeSourceExcerpts: z.boolean()
}).strict();

export type AiQuestionRequest = z.infer<typeof aiQuestionRequestSchema>;

/**
 * Generated Question structure
 */
export const aiGeneratedQuestionSchema = z.object({
  questionText: z
    .string()
    .trim()
    .min(10, 'Question text must be at least 10 characters'),
  options: z
    .array(z.string().trim().min(1, 'Option cannot be empty'))
    .length(4, 'Must contain exactly 4 options'),
  correctOptionIndex: z
    .number()
    .int('Correct option index must be an integer')
    .min(0, 'Correct option index must be at least 0')
    .max(3, 'Correct option index must be at most 3'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  explanation: z.string().trim().min(1, 'Explanation cannot be empty'),
  sourceExcerpt: z.string().trim().min(1, 'Source excerpt cannot be empty').optional()
}).strict();

export type AiGeneratedQuestion = z.infer<typeof aiGeneratedQuestionSchema>;

/**
 * POST /api/ai/questions Response Contract
 */
export const aiQuestionResponseSchema = z.object({
  generationId: z.string().trim().min(1, 'Generation ID cannot be empty'),
  questions: z
    .array(aiGeneratedQuestionSchema)
    .min(1, 'Must contain at least 1 question')
    .max(20, 'Cannot exceed 20 questions')
}).strict();

export type AiQuestionResponse = z.infer<typeof aiQuestionResponseSchema>;

/**
 * Safe API Error Contract
 */
export const aiApiErrorSchema = z.object({
  code: z.string().trim().min(1, 'Error code cannot be empty'),
  message: z.string().trim().min(1, 'Error message cannot be empty'),
  requestId: z.string().trim().min(1, 'Request ID cannot be empty'),
  retryable: z.boolean()
}).strict();

export type AiApiError = z.infer<typeof aiApiErrorSchema>;
