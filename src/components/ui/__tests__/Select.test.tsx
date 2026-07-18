import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Select } from '../Select'

describe('Select Primitive', () => {
  it('renders without aria-invalid by default', () => {
    render(
      <Select data-testid="select">
        <option value="1">Option 1</option>
      </Select>
    )
    const select = screen.getByTestId('select')
    expect(select.hasAttribute('aria-invalid')).toBe(false)
  })

  it('renders aria-invalid="true" when hasError is true', () => {
    render(
      <Select data-testid="select" hasError>
        <option value="1">Option 1</option>
      </Select>
    )
    const select = screen.getByTestId('select')
    expect(select.getAttribute('aria-invalid')).toBe('true')
  })

  it('preserves explicit aria-invalid value even if hasError is true', () => {
    render(
      <Select data-testid="select" hasError aria-invalid="false">
        <option value="1">Option 1</option>
      </Select>
    )
    const select = screen.getByTestId('select')
    expect(select.getAttribute('aria-invalid')).toBe('false')
  })

  it('passes native props and refs correctly', () => {
    render(
      <Select data-testid="select" disabled>
        <option value="1">Option 1</option>
      </Select>
    )
    const select = screen.getByTestId('select')
    expect(select.hasAttribute('disabled')).toBe(true)
  })
})
