import { describe, it, expect } from 'vitest'
import { isNavDestinationActive, isQuizPlayFocusPath } from '../navActive'

describe('isNavDestinationActive', () => {
  it('marks Start Quiz only on setup and play', () => {
    expect(isNavDestinationActive('start-quiz', '/quiz/setup')).toBe(true)
    expect(isNavDestinationActive('start-quiz', '/quiz/play')).toBe(true)
    expect(isNavDestinationActive('start-quiz', '/quiz/results/1')).toBe(false)
    expect(isNavDestinationActive('start-quiz', '/quiz/results')).toBe(false)
    expect(isNavDestinationActive('start-quiz', '/history')).toBe(false)
  })

  it('marks History for history and quiz results routes', () => {
    expect(isNavDestinationActive('history', '/history')).toBe(true)
    expect(isNavDestinationActive('history', '/quiz/results/42')).toBe(true)
    expect(isNavDestinationActive('history', '/quiz/results')).toBe(true)
    expect(isNavDestinationActive('history', '/quiz/setup')).toBe(false)
    expect(isNavDestinationActive('history', '/quiz/play')).toBe(false)
  })

  it('keeps other destinations accurate', () => {
    expect(isNavDestinationActive('dashboard', '/')).toBe(true)
    expect(isNavDestinationActive('dashboard', '/subjects')).toBe(false)
    expect(isNavDestinationActive('subjects', '/subjects')).toBe(true)
    expect(isNavDestinationActive('subjects', '/subjects/3')).toBe(true)
    expect(isNavDestinationActive('questions', '/questions')).toBe(true)
    expect(isNavDestinationActive('questions', '/questions/new')).toBe(true)
    expect(isNavDestinationActive('mistakes', '/mistakes')).toBe(true)
    expect(isNavDestinationActive('settings', '/settings')).toBe(true)
  })
})

describe('isQuizPlayFocusPath', () => {
  it('is true only for the play route', () => {
    expect(isQuizPlayFocusPath('/quiz/play')).toBe(true)
    expect(isQuizPlayFocusPath('/quiz/setup')).toBe(false)
    expect(isQuizPlayFocusPath('/quiz/results/1')).toBe(false)
  })
})
