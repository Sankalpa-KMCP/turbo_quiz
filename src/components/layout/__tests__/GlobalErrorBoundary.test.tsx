import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import GlobalErrorBoundary from '../GlobalErrorBoundary'

// Component that throws error on render
const BrokenComponent = () => {
  throw new Error('Render error details')
}

describe('GlobalErrorBoundary Component', () => {
  it('renders 404 page not found card when route response error is 404', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <div>Home</div>,
          loader: () => {
            throw new Response('Not Found', { status: 404, statusText: 'Not Found' })
          },
          errorElement: <GlobalErrorBoundary />
        }
      ],
      { initialEntries: ['/'] }
    )

    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '404' })).toBeInTheDocument()
      expect(screen.getByText('Page Not Found')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Go to Dashboard' })).toBeInTheDocument()
    })
  })

  it('renders unexpected error boundaries with application error card', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <BrokenComponent />,
          errorElement: <GlobalErrorBoundary />
        }
      ],
      { initialEntries: ['/'] }
    )

    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Application Error' })).toBeInTheDocument()
      expect(screen.getByText(/An unexpected error occurred while rendering this page/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reload Application' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Go to Dashboard' })).toBeInTheDocument()
    })
  })
})
