import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import AppLayout from '../AppLayout'

const createTestRouter = (initialUrl: string) => {
  return createMemoryRouter(
    [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          { index: true, element: <div>Dashboard Content</div> },
          { path: 'subjects', element: <div>Subjects Content</div> }
        ]
      }
    ],
    { initialEntries: [initialUrl] }
  )
}

describe('AppLayout Component', () => {
  it('renders solid brand name and main navigation destinations', () => {
    const router = createTestRouter('/')
    render(<RouterProvider router={router} />)

    // Check brand wordmark in layout (desktop and mobile)
    const brandLinks = screen.getAllByRole('link', { name: /TurboQuiz/i })
    expect(brandLinks.length).toBeGreaterThanOrEqual(1)
    brandLinks.forEach(link => {
      expect(link).toHaveTextContent('TurboQuiz')
    })

    // Check desktop links
    const dashboardLink = screen.getAllByRole('link', { name: 'Dashboard' })[0]
    expect(dashboardLink).toBeInTheDocument()
    expect(dashboardLink).toHaveAttribute('href', '/')

    const subjectsLink = screen.getAllByRole('link', { name: 'Subjects' })[0]
    expect(subjectsLink).toBeInTheDocument()
    expect(subjectsLink).toHaveAttribute('href', '/subjects')
  })

  it('exposes aria-current="page" state on active destinations', () => {
    const router = createTestRouter('/')
    render(<RouterProvider router={router} />)

    // Dashboard is active
    const dashboardLink = screen.getAllByRole('link', { name: 'Dashboard' })[0]
    expect(dashboardLink).toHaveAttribute('aria-current', 'page')

    // Subjects is inactive
    const subjectsLink = screen.getAllByRole('link', { name: 'Subjects' })[0]
    expect(subjectsLink).not.toHaveAttribute('aria-current')
  })

  it('contains functional skip-to-content link targeting main', () => {
    const router = createTestRouter('/')
    render(<RouterProvider router={router} />)

    const skipLink = screen.getByRole('link', { name: /Skip to main content/i })
    expect(skipLink).toBeInTheDocument()
    expect(skipLink).toHaveAttribute('href', '#main-content')
  })

  it('toggles mobile menu trigger button state', () => {
    const router = createTestRouter('/')
    render(<RouterProvider router={router} />)

    const toggleBtn = screen.getByRole('button', { name: /Toggle navigation menu/i })
    expect(toggleBtn).toBeInTheDocument()
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false')

    // Click toggle
    fireEvent.click(toggleBtn)
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true')
  })
})
