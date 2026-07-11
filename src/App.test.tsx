import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App Smoke Test', () => {
  it('renders TurboQuiz App header', () => {
    render(<App />)
    expect(screen.getByText('TurboQuiz App')).toBeInTheDocument()
  })

  it('increments the count when smoke test counter button is clicked', () => {
    render(<App />)
    const button = screen.getByRole('button', { name: /Smoke Test Counter/i })
    expect(button).toHaveTextContent('Smoke Test Counter: 0')

    fireEvent.click(button)
    expect(button).toHaveTextContent('Smoke Test Counter: 1')
  })
})
