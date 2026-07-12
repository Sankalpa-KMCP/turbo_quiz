import { describe, it, expect } from 'vitest'
import { shuffle } from '../shuffle'

describe('shuffle', () => {
  it('handles empty arrays', () => {
    const input: number[] = []
    const result = shuffle(input)
    expect(result).toEqual([])
    expect(result).not.toBe(input)
  })

  it('handles single-element arrays', () => {
    const input = [42]
    const result = shuffle(input)
    expect(result).toEqual([42])
    expect(result).not.toBe(input)
  })

  it('does not mutate the input array', () => {
    const input = [1, 2, 3, 4, 5]
    const originalCopy = [...input]
    shuffle(input)
    expect(input).toEqual(originalCopy)
  })

  it('preserves all elements', () => {
    const input = [1, 2, 3, 4, 5]
    const result = shuffle(input)
    expect(result.length).toBe(input.length)
    expect(new Set(result)).toEqual(new Set(input))
  })

  it('is deterministic when provided a custom random function', () => {
    const input = [1, 2, 3, 4]
    const mockRandomValues = [0.4, 0.1, 0.9]
    let callCount = 0
    const mockRandom = () => {
      const val = mockRandomValues[callCount % mockRandomValues.length]
      callCount++
      return val
    }

    const result = shuffle(input, mockRandom)
    callCount = 0
    const result2 = shuffle(input, mockRandom)
    expect(result).toEqual(result2)
  })
})
