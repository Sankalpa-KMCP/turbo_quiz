import { describe, it, expect } from 'vitest';
import {
  aiQuestionRequestSchema,
  aiQuestionResponseSchema,
  aiApiErrorSchema,
  aiGenerationStatusSchema
} from '../index.js';

describe('AI Question Generation Contracts', () => {
  const validSourceText = 'a'.repeat(250);

  describe('aiQuestionRequestSchema', () => {
    const validRequest = {
      sourceText: validSourceText,
      questionCount: 5,
      difficulty: 'medium',
      subjectName: 'Biology',
      topicName: 'Cell Division',
      includeExplanations: true,
      includeSourceExcerpts: true
    };

    it('should parse valid request payloads', () => {
      const parsed = aiQuestionRequestSchema.parse(validRequest);
      expect(parsed).toEqual(validRequest);
    });

    it('should parse valid requests without optional topicName', () => {
      const { topicName, ...withoutTopic } = validRequest;
      expect(topicName).toBe('Cell Division');
      const parsed = aiQuestionRequestSchema.parse(withoutTopic);
      expect(parsed.topicName).toBeUndefined();
    });

    it('should reject source text shorter than 200 characters', () => {
      const invalid = { ...validRequest, sourceText: 'a'.repeat(199) };
      const res = aiQuestionRequestSchema.safeParse(invalid);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('Source text must be at least 200 characters');
      }
    });

    it('should reject source text longer than 50,000 characters', () => {
      const invalid = { ...validRequest, sourceText: 'a'.repeat(50001) };
      const res = aiQuestionRequestSchema.safeParse(invalid);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('Source text cannot exceed 50,000 characters');
      }
    });

    it('should reject question count less than 1', () => {
      const invalid = { ...validRequest, questionCount: 0 };
      const res = aiQuestionRequestSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });

    it('should reject question count greater than 20', () => {
      const invalid = { ...validRequest, questionCount: 21 };
      const res = aiQuestionRequestSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });

    it('should reject non-integer question count', () => {
      const invalid = { ...validRequest, questionCount: 5.5 };
      const res = aiQuestionRequestSchema.safeParse(invalid);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('Question count must be an integer');
      }
    });

    it('should reject invalid difficulty types', () => {
      const invalid = { ...validRequest, difficulty: 'expert' };
      const res = aiQuestionRequestSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });

    it('should reject empty subjectName', () => {
      const invalid = { ...validRequest, subjectName: '   ' };
      const res = aiQuestionRequestSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });

    it('should reject empty topicName if provided', () => {
      const invalid = { ...validRequest, topicName: '   ' };
      const res = aiQuestionRequestSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });
  });

  describe('aiQuestionResponseSchema', () => {
    const validQuestion = {
      questionText: 'What is the powerhouse of the cell?',
      options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi apparatus'],
      correctOptionIndex: 1,
      difficulty: 'easy',
      explanation: 'Mitochondria generates chemical energy.'
    };

    const validResponse = {
      generationId: 'gen-uuid-1234',
      questions: [validQuestion]
    };

    it('should parse valid responses', () => {
      const parsed = aiQuestionResponseSchema.parse(validResponse);
      expect(parsed).toEqual(validResponse);
    });

    it('should allow optional sourceExcerpt in questions', () => {
      const questionWithExcerpt = {
        ...validQuestion,
        sourceExcerpt: 'Mitochondria are double-membraned organelles.'
      };
      const responseWithExcerpt = {
        ...validResponse,
        questions: [questionWithExcerpt]
      };
      const parsed = aiQuestionResponseSchema.parse(responseWithExcerpt);
      expect(parsed.questions[0].sourceExcerpt).toBe('Mitochondria are double-membraned organelles.');
    });

    it('should reject empty generationId', () => {
      const invalid = { ...validResponse, generationId: '   ' };
      const res = aiQuestionResponseSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });

    it('should reject questions array with 0 items', () => {
      const invalid = { ...validResponse, questions: [] };
      const res = aiQuestionResponseSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });

    it('should reject questions array with more than 20 items', () => {
      const invalid = {
        ...validResponse,
        questions: Array(21).fill(validQuestion)
      };
      const res = aiQuestionResponseSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });

    it('should reject question text shorter than 10 characters', () => {
      const invalidQuestion = { ...validQuestion, questionText: 'Too short' };
      const invalidResponse = { ...validResponse, questions: [invalidQuestion] };
      const res = aiQuestionResponseSchema.safeParse(invalidResponse);
      expect(res.success).toBe(false);
    });

    it('should reject questions with non-four options', () => {
      const invalidQuestion1 = { ...validQuestion, options: ['One', 'Two', 'Three'] };
      const invalidQuestion2 = { ...validQuestion, options: ['One', 'Two', 'Three', 'Four', 'Five'] };
      
      expect(aiQuestionResponseSchema.safeParse({ ...validResponse, questions: [invalidQuestion1] }).success).toBe(false);
      expect(aiQuestionResponseSchema.safeParse({ ...validResponse, questions: [invalidQuestion2] }).success).toBe(false);
    });

    it('should reject questions with empty options', () => {
      const invalidQuestion = { ...validQuestion, options: ['One', '   ', 'Three', 'Four'] };
      const res = aiQuestionResponseSchema.safeParse({ ...validResponse, questions: [invalidQuestion] });
      expect(res.success).toBe(false);
    });

    it('should reject correctOptionIndex out of 0-3 range', () => {
      const invalidQuestion1 = { ...validQuestion, correctOptionIndex: -1 };
      const invalidQuestion2 = { ...validQuestion, correctOptionIndex: 4 };

      expect(aiQuestionResponseSchema.safeParse({ ...validResponse, questions: [invalidQuestion1] }).success).toBe(false);
      expect(aiQuestionResponseSchema.safeParse({ ...validResponse, questions: [invalidQuestion2] }).success).toBe(false);
    });

    it('should reject non-integer correctOptionIndex', () => {
      const invalidQuestion = { ...validQuestion, correctOptionIndex: 1.5 };
      const invalidResponse = { ...validResponse, questions: [invalidQuestion] };
      const res = aiQuestionResponseSchema.safeParse(invalidResponse);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain('Correct option index must be an integer');
      }
    });

    it('should reject empty explanation', () => {
      const invalidQuestion = { ...validQuestion, explanation: '   ' };
      const res = aiQuestionResponseSchema.safeParse({ ...validResponse, questions: [invalidQuestion] });
      expect(res.success).toBe(false);
    });

    it('should reject empty sourceExcerpt if provided', () => {
      const invalidQuestion = { ...validQuestion, sourceExcerpt: '   ' };
      const res = aiQuestionResponseSchema.safeParse({ ...validResponse, questions: [invalidQuestion] });
      expect(res.success).toBe(false);
    });
  });

  describe('aiApiErrorSchema', () => {
    const validError = {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please retry in 60s.',
      requestId: 'req-123',
      retryable: true
    };

    it('should parse valid error payloads', () => {
      const parsed = aiApiErrorSchema.parse(validError);
      expect(parsed).toEqual(validError);
    });

    it('should reject empty fields', () => {
      const invalid = { ...validError, code: '   ' };
      const res = aiApiErrorSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });

    it('should reject missing or empty message', () => {
      const { message, ...missingMessage } = validError;
      expect(message).toBeDefined();
      expect(aiApiErrorSchema.safeParse(missingMessage).success).toBe(false);

      const invalidMessage = { ...validError, message: '   ' };
      expect(aiApiErrorSchema.safeParse(invalidMessage).success).toBe(false);
    });

    it('should reject wrong-typed message', () => {
      const invalidMessage = { ...validError, message: 123 };
      expect(aiApiErrorSchema.safeParse(invalidMessage).success).toBe(false);
    });

    it('should reject missing or empty requestId', () => {
      const { requestId, ...missingRequestId } = validError;
      expect(requestId).toBeDefined();
      expect(aiApiErrorSchema.safeParse(missingRequestId).success).toBe(false);

      const invalidRequestId = { ...validError, requestId: '   ' };
      expect(aiApiErrorSchema.safeParse(invalidRequestId).success).toBe(false);
    });

    it('should reject wrong-typed requestId', () => {
      const invalidRequestId = { ...validError, requestId: true };
      expect(aiApiErrorSchema.safeParse(invalidRequestId).success).toBe(false);
    });

    it('should reject missing or wrong-typed retryable flag', () => {
      const { retryable, ...missingRetryable } = validError;
      expect(retryable).toBeDefined();
      expect(aiApiErrorSchema.safeParse(missingRetryable).success).toBe(false);

      const invalidRetryable = { ...validError, retryable: 'true' };
      expect(aiApiErrorSchema.safeParse(invalidRetryable).success).toBe(false);
    });
  });

  describe('aiGenerationStatusSchema', () => {
    it('should accept valid statuses', () => {
      expect(aiGenerationStatusSchema.parse('queued')).toBe('queued');
      expect(aiGenerationStatusSchema.parse('processing')).toBe('processing');
      expect(aiGenerationStatusSchema.parse('completed')).toBe('completed');
      expect(aiGenerationStatusSchema.parse('failed')).toBe('failed');
      expect(aiGenerationStatusSchema.parse('cancelled')).toBe('cancelled');
    });

    it('should reject invalid statuses', () => {
      const res = aiGenerationStatusSchema.safeParse('done');
      expect(res.success).toBe(false);
    });
  });
});
