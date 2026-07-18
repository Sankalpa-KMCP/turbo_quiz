import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import GlobalErrorBoundary from '../GlobalErrorBoundary'

const BrokenComponent = () => {
  throw new Error('Render error details')
}

describe('GlobalErrorBoundary Component', () => {
  it('renders a calm 404 recovery surface for route 404 responses', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <div>Home</div>,
          loader: () => {
            throw new Response('Not Found', { status: 404, statusText: 'Not Found' })
          },
          errorElement: <GlobalErrorBoundary />,
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Page not found/i })).toBeInTheDocument()
      expect(screen.getByText('404')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Go to Dashboard' })).toBeInTheDocument()
    })
  })

  it('renders unexpected errors with recovery actions and without novelty chrome', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <BrokenComponent />,
          errorElement: <GlobalErrorBoundary />,
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Application error/i })).toBeInTheDocument()
      expect(screen.getByText(/An unexpected error occurred while rendering this page/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reload Application' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Go to Dashboard' })).toBeInTheDocument()
    })
  })
})
