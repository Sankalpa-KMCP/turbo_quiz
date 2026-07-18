import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Textarea } from '../Textarea'

describe('Textarea Primitive', () => {
  it('renders without aria-invalid by default', () => {
    render(<Textarea placeholder="Test textarea" />)
    const textarea = screen.getByPlaceholderText('Test textarea')
    expect(textarea.hasAttribute('aria-invalid')).toBe(false)
  })

  it('renders aria-invalid="true" when hasError is true', () => {
    render(<Textarea placeholder="Test textarea" hasError />)
    const textarea = screen.getByPlaceholderText('Test textarea')
    expect(textarea.getAttribute('aria-invalid')).toBe('true')
  })

  it('preserves explicit aria-invalid value even if hasError is true', () => {
    render(<Textarea placeholder="Test textarea" hasError aria-invalid="false" />)
    const textarea = screen.getByPlaceholderText('Test textarea')
    expect(textarea.getAttribute('aria-invalid')).toBe('false')
  })

  it('passes native props and refs correctly', () => {
    render(<Textarea placeholder="Test textarea" disabled rows={5} />)
    const textarea = screen.getByPlaceholderText('Test textarea')
    expect(textarea.hasAttribute('disabled')).toBe(true)
    expect(textarea.getAttribute('rows')).toBe('5')
  })
})
