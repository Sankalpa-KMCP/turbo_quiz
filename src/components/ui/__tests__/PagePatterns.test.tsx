import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from '../EmptyState'
import { LoadingState } from '../LoadingState'
import { PageHeader } from '../PageHeader'

describe('shared page patterns', () => {
  it('renders a semantic page heading with supporting content', () => {
    render(<PageHeader title="Questions Bank" description="Manage your questions." action={<button>New</button>} />)

    const heading = screen.getByRole('heading', { level: 1, name: 'Questions Bank' })
    expect(heading).toBeInTheDocument()
    expect(heading).toHaveClass('font-serif')
    expect(heading).toHaveClass('font-semibold')
    expect(screen.getByText('Manage your questions.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument()
  })

  it('announces loading states', () => {
    render(<LoadingState label="Loading subjects…" />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading subjects…')
  })

  it('provides an empty-state heading and next action', () => {
    render(
      <EmptyState
        title="No subjects found"
        description="Create one to begin."
        action={<button>Create subject</button>}
      />
    )

    expect(screen.getByRole('heading', { level: 2, name: 'No subjects found' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create subject' })).toBeInTheDocument()
  })
})
