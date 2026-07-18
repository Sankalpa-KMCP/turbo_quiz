import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import NotFoundPage from '../NotFoundPage'

describe('NotFoundPage', () => {
  it('presents a calm not-found message with a primary recovery link', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /Page not found/i })).toBeInTheDocument()
    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Go to Dashboard/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /Browse subjects/i })).toHaveAttribute('href', '/subjects')
  })
})