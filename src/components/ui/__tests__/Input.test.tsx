import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Input } from '../Input'

describe('Input Primitive', () => {
  it('renders without aria-invalid by default', () => {
    render(<Input placeholder="Test input" />)
    const input = screen.getByPlaceholderText('Test input')
    expect(input.hasAttribute('aria-invalid')).toBe(false)
  })

  it('renders aria-invalid="true" when hasError is true', () => {
    render(<Input placeholder="Test input" hasError />)
    const input = screen.getByPlaceholderText('Test input')
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  it('preserves explicit aria-invalid value even if hasError is true', () => {
    render(<Input placeholder="Test input" hasError aria-invalid="false" />)
    const input = screen.getByPlaceholderText('Test input')
    expect(input.getAttribute('aria-invalid')).toBe('false')
  })

  it('passes native props and refs correctly', () => {
    render(<Input placeholder="Test input" disabled type="password" />)
    const input = screen.getByPlaceholderText('Test input')
    expect(input.hasAttribute('disabled')).toBe(true)
    expect(input.getAttribute('type')).toBe('password')
  })
})
