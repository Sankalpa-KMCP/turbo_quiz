import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Field } from '../Field'
import { Input } from '../Input'
import { Select } from '../Select'
import { Textarea } from '../Textarea'

describe('Field', () => {
  it('associates the visible label with the control', () => {
    render(
      <Field label="Subject name" required>
        <Input />
      </Field>
    )

    const input = screen.getByLabelText(/Subject name/)
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-required', 'true')
    expect(screen.getByText('(required)')).toHaveClass('sr-only')
  })

  it('associates helper text through aria-describedby', () => {
    render(
      <Field label="Topic" helperText="Topics group related questions.">
        <Input />
      </Field>
    )

    const input = screen.getByLabelText('Topic')
    const helper = screen.getByText('Topics group related questions.')
    expect(input).toHaveAttribute('aria-describedby', helper.id)
  })

  it('associates validation errors and marks the control invalid', () => {
    render(
      <Field label="Question text" required error="Question text is required">
        <Textarea />
      </Field>
    )

    const control = screen.getByLabelText(/Question text/)
    const error = screen.getByRole('alert')
    expect(error).toHaveTextContent('Question text is required')
    expect(control).toHaveAttribute('aria-invalid', 'true')
    expect(control).toHaveAttribute('aria-describedby', error.id)
    expect(control.className).toMatch(/border-danger-base/)
  })

  it('communicates optional fields without relying only on color', () => {
    render(
      <Field label="Explanation" optional>
        <Textarea />
      </Field>
    )

    expect(screen.getByText('(optional)')).toBeInTheDocument()
    expect(screen.getByLabelText(/Explanation/)).not.toHaveAttribute('aria-required')
  })

  it('composes with Select and preserves an explicit control id', () => {
    render(
      <Field id="subjectId" label="Subject" required helperText="Choose one subject." error="Subject is required">
        <Select>
          <option value="1">Biology</option>
        </Select>
      </Field>
    )

    const select = screen.getByLabelText(/Subject/)
    expect(select).toHaveAttribute('id', 'subjectId')
    const describedBy = select.getAttribute('aria-describedby') ?? ''
    expect(describedBy).toContain('subjectId-helper')
    expect(describedBy).toContain('subjectId-error')
  })
})
