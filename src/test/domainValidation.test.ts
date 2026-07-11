import { describe, it, expect } from 'vitest'
import { normalizeName } from '../utils/normalizeName'
import { subjectCreateSchema, subjectUpdateSchema } from '../schemas/subjectSchema'
import { topicCreateSchema, topicUpdateSchema } from '../schemas/topicSchema'
import { questionCreateSchema, questionUpdateSchema } from '../schemas/questionSchema'

describe('Domain Normalization Utility', () => {
  it('should trim whitespace, lowercase, and NFC normalize equivalent Unicode', () => {
    expect(normalizeName('  Math  ')).toBe('math')
    expect(normalizeName('PHYSICS')).toBe('physics')

    // Unicode equivalence: Å (\u00C5) vs A + comb. ring (\u0041\u030A)
    const normalized1 = normalizeName('\u00C5')
    const normalized2 = normalizeName('\u0041\u030A')
    expect(normalized1).toBe(normalized2)
    expect(normalized1).toBe('å')
  })

  it('should not mutate original string', () => {
    const raw = '  Science  '
    const result = normalizeName(raw)
    expect(result).toBe('science')
    expect(raw).toBe('  Science  ')
  })
})

describe('Subject Schemas', () => {
  it('should validate a valid subject creation payload', () => {
    const payload = { name: '  Biology  ', description: '  Study of life  ' }
    const result = subjectCreateSchema.safeParse(payload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Biology')
      expect(result.data.description).toBe('Study of life')
    }
  })

  it('should convert omitted or null description to null', () => {
    const resultOmitted = subjectCreateSchema.safeParse({ name: 'History' })
    expect(resultOmitted.success).toBe(true)
    if (resultOmitted.success) {
      expect(resultOmitted.data.description).toBeNull()
    }

    const resultNull = subjectCreateSchema.safeParse({ name: 'History', description: null })
    expect(resultNull.success).toBe(true)
    if (resultNull.success) {
      expect(resultNull.data.description).toBeNull()
    }
  })

  it('should reject whitespace-only or empty names', () => {
    const resultEmpty = subjectCreateSchema.safeParse({ name: '   ' })
    expect(resultEmpty.success).toBe(false)
  })

  it('should reject caller-supplied generated fields in create', () => {
    const payload = { name: 'Math', id: 123 }
    const result = subjectCreateSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })

  it('should validate valid update fields', () => {
    const result = subjectUpdateSchema.safeParse({ name: 'Updated name' })
    expect(result.success).toBe(true)
  })

  it('should reject empty update objects', () => {
    const result = subjectUpdateSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('Topic Schemas', () => {
  it('should validate a valid topic creation payload', () => {
    const payload = { subjectId: 1, name: '  Algebra  ' }
    const result = topicCreateSchema.safeParse(payload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Algebra')
    }
  })

  it('should reject invalid or non-integer subject IDs', () => {
    const resultNegative = topicCreateSchema.safeParse({ subjectId: -1, name: 'Algebra' })
    expect(resultNegative.success).toBe(false)

    const resultFloat = topicCreateSchema.safeParse({ subjectId: 1.5, name: 'Algebra' })
    expect(resultFloat.success).toBe(false)
  })

  it('should reject empty update objects', () => {
    const result = topicUpdateSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('Question Schemas', () => {
  const validQuestionBase = {
    subjectId: 1,
    topicId: 2,
    questionText: 'What is 2+2?',
    options: ['3', '4'],
    correctOptionIndex: 1,
    difficulty: 'easy' as const
  }

  it('should accept valid 2-option and 6-option questions', () => {
    const res2 = questionCreateSchema.safeParse(validQuestionBase)
    expect(res2.success).toBe(true)

    const res6 = questionCreateSchema.safeParse({
      ...validQuestionBase,
      options: ['1', '2', '3', '4', '5', '6'],
      correctOptionIndex: 3
    })
    expect(res6.success).toBe(true)
  })

  it('should default bookmarkStatus to 0', () => {
    const res = questionCreateSchema.safeParse(validQuestionBase)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.bookmarkStatus).toBe(0)
    }
  })

  it('should convert omitted explanation to null', () => {
    const res = questionCreateSchema.safeParse(validQuestionBase)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.explanation).toBeNull()
    }
  })

  it('should reject fewer than 2 or more than 6 options', () => {
    const res1 = questionCreateSchema.safeParse({ ...validQuestionBase, options: ['1'] })
    expect(res1.success).toBe(false)

    const res7 = questionCreateSchema.safeParse({
      ...validQuestionBase,
      options: ['1', '2', '3', '4', '5', '6', '7'],
      correctOptionIndex: 0
    })
    expect(res7.success).toBe(false)
  })

  it('should reject empty options', () => {
    const res = questionCreateSchema.safeParse({ ...validQuestionBase, options: ['1', '  '] })
    expect(res.success).toBe(false)
  })

  it('should reject duplicates differing only by case or whitespace', () => {
    const resCase = questionCreateSchema.safeParse({ ...validQuestionBase, options: ['Option', 'option'] })
    expect(resCase.success).toBe(false)

    const resSpace = questionCreateSchema.safeParse({ ...validQuestionBase, options: ['Option', '  Option  '] })
    expect(resSpace.success).toBe(false)
  })

  it('should reject Unicode-equivalent duplicates', () => {
    // Å vs A + comb. ring
    const resUnicode = questionCreateSchema.safeParse({ ...validQuestionBase, options: ['\u00C5', '\u0041\u030A'] })
    expect(resUnicode.success).toBe(false)
  })

  it('should reject invalid correctOptionIndex values', () => {
    const resNegative = questionCreateSchema.safeParse({ ...validQuestionBase, correctOptionIndex: -1 })
    expect(resNegative.success).toBe(false)

    const resFloat = questionCreateSchema.safeParse({ ...validQuestionBase, correctOptionIndex: 0.5 })
    expect(resFloat.success).toBe(false)

    const resOutOfRange = questionCreateSchema.safeParse({ ...validQuestionBase, correctOptionIndex: 2 })
    expect(resOutOfRange.success).toBe(false)
  })

  it('should reject invalid difficulty and bookmark values', () => {
    const resDiff = questionCreateSchema.safeParse({ ...validQuestionBase, difficulty: 'impossible' })
    expect(resDiff.success).toBe(false)

    const resBook = questionCreateSchema.safeParse({ ...validQuestionBase, bookmarkStatus: 2 })
    expect(resBook.success).toBe(false)
  })

  it('should accept null topicId and reject invalid topicIds', () => {
    const resNull = questionCreateSchema.safeParse({ ...validQuestionBase, topicId: null })
    expect(resNull.success).toBe(true)

    const resFloat = questionCreateSchema.safeParse({ ...validQuestionBase, topicId: 2.2 })
    expect(resFloat.success).toBe(false)
  })

  it('should preserve option order after trimming', () => {
    const res = questionCreateSchema.safeParse({
      ...validQuestionBase,
      options: ['  First  ', '  Second  ']
    })
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.options[0]).toBe('First')
      expect(res.data.options[1]).toBe('Second')
    }
  })

  it('should reject an empty update object', () => {
    const res = questionUpdateSchema.safeParse({})
    expect(res.success).toBe(false)
  })

  it('should validate options and correct index together when both are updated', () => {
    // Correct index is out of bounds for the new options
    const resInvalid = questionUpdateSchema.safeParse({
      options: ['A', 'B'],
      correctOptionIndex: 2
    })
    expect(resInvalid.success).toBe(false)

    // Correct index is in bounds for the new options
    const resValid = questionUpdateSchema.safeParse({
      options: ['A', 'B'],
      correctOptionIndex: 1
    })
    expect(resValid.success).toBe(true)
  })

  it('should allow options or correctOptionIndex to be updated alone', () => {
    const resOptions = questionUpdateSchema.safeParse({ options: ['A', 'B'] })
    expect(resOptions.success).toBe(true)

    const resIndex = questionUpdateSchema.safeParse({ correctOptionIndex: 4 })
    expect(resIndex.success).toBe(true)
  })
})
