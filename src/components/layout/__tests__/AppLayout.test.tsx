import { render, screen, fireEvent, within } from '@testing-library/react'
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
          { path: 'subjects', element: <div>Subjects Content</div> },
          { path: 'questions', element: <div>Questions Content</div> },
          { path: 'quiz/setup', element: <div>Quiz Setup Content</div> },
          { path: 'quiz/play', element: <div>Quiz Play Content</div> },
          { path: 'quiz/results/:attemptId', element: <div>Quiz Results Content</div> },
          { path: 'history', element: <div>History Content</div> },
          { path: 'mistakes', element: <div>Mistakes Content</div> },
          { path: 'settings', element: <div>Settings Content</div> },
        ],
      },
    ],
    { initialEntries: [initialUrl] }
  )
}

const openMobileDrawer = () => {
  const toggleBtn = screen.getByRole('button', { name: /Toggle navigation menu/i })
  fireEvent.click(toggleBtn)
  return screen.getByRole('dialog', { name: /Navigation menu/i })
}

describe('AppLayout Component', () => {
  it('renders solid brand name and main navigation destinations', () => {
    const router = createTestRouter('/')
    render(<RouterProvider router={router} />)

    const brandLinks = screen.getAllByRole('link', { name: /TurboQuiz/i })
    expect(brandLinks.length).toBeGreaterThanOrEqual(1)
    brandLinks.forEach((link) => {
      expect(link).toHaveTextContent('TurboQuiz')
    })

    const dashboardLink = screen.getAllByRole('link', { name: 'Dashboard' })[0]
    expect(dashboardLink).toHaveAttribute('href', '/')

    const subjectsLink = screen.getAllByRole('link', { name: 'Subjects' })[0]
    expect(subjectsLink).toHaveAttribute('href', '/subjects')
  })

  it('presents section hierarchy on desktop and in the mobile drawer', () => {
    const router = createTestRouter('/')
    render(<RouterProvider router={router} />)

    for (const section of ['Overview', 'Library', 'Practice', 'System']) {
      expect(screen.getAllByText(section).length).toBeGreaterThanOrEqual(1)
    }

    const drawer = openMobileDrawer()
    for (const section of ['Overview', 'Library', 'Practice', 'System']) {
      expect(within(drawer).getByText(section)).toBeInTheDocument()
    }
  })

  it('exposes aria-current="page" state on active destinations', () => {
    const router = createTestRouter('/')
    render(<RouterProvider router={router} />)

    const dashboardLink = screen.getAllByRole('link', { name: 'Dashboard' })[0]
    expect(dashboardLink).toHaveAttribute('aria-current', 'page')

    const subjectsLink = screen.getAllByRole('link', { name: 'Subjects' })[0]
    expect(subjectsLink).not.toHaveAttribute('aria-current')
  })

  it('marks Start Quiz active on setup and play, not on results', () => {
    const setupRouter = createTestRouter('/quiz/setup')
    const { unmount: unmountSetup } = render(<RouterProvider router={setupRouter} />)
    expect(screen.getAllByRole('link', { name: 'Start Quiz' })[0]).toHaveAttribute('aria-current', 'page')
    expect(screen.getAllByRole('link', { name: 'History' })[0]).not.toHaveAttribute('aria-current')
    unmountSetup()

    const playRouter = createTestRouter('/quiz/play')
    const { unmount: unmountPlay } = render(<RouterProvider router={playRouter} />)
    // Focus shell: Start Quiz is not in primary nav; exit affordance is present instead
    expect(screen.getByRole('link', { name: /Exit to setup/i })).toHaveAttribute('href', '/quiz/setup')
    expect(screen.queryByRole('navigation', { name: /Desktop primary navigation/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Toggle navigation menu/i })).not.toBeInTheDocument()
    unmountPlay()

    const resultsRouter = createTestRouter('/quiz/results/12')
    render(<RouterProvider router={resultsRouter} />)
    expect(screen.getAllByRole('link', { name: 'Start Quiz' })[0]).not.toHaveAttribute('aria-current')
    expect(screen.getAllByRole('link', { name: 'History' })[0]).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('navigation', { name: /Desktop primary navigation/i })).toBeInTheDocument()
  })

  it('uses the standard shell on quiz setup and results', () => {
    const router = createTestRouter('/quiz/setup')
    render(<RouterProvider router={router} />)
    expect(screen.getByRole('navigation', { name: /Desktop primary navigation/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Toggle navigation menu/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Exit to setup/i })).not.toBeInTheDocument()
  })

  it('contains functional skip-to-content link targeting main', () => {
    const router = createTestRouter('/')
    render(<RouterProvider router={router} />)

    const skipLink = screen.getByRole('link', { name: /Skip to main content/i })
    expect(skipLink).toHaveAttribute('href', '#main-content')
  })

  it('toggles mobile menu trigger button state', () => {
    const router = createTestRouter('/')
    render(<RouterProvider router={router} />)

    const toggleBtn = screen.getByRole('button', { name: /Toggle navigation menu/i })
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggleBtn)
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true')
  })

  it('closes the mobile drawer on Escape and restores focus to the toggle', () => {
    const router = createTestRouter('/')
    render(<RouterProvider router={router} />)

    const toggleBtn = screen.getByRole('button', { name: /Toggle navigation menu/i })
    fireEvent.click(toggleBtn)
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false')
    expect(toggleBtn).toHaveFocus()
  })

  it('traps Tab focus inside the open mobile drawer', () => {
    const router = createTestRouter('/')
    render(<RouterProvider router={router} />)

    const drawer = openMobileDrawer()
    const focusable = Array.from(
      drawer.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
    )
    expect(focusable.length).toBeGreaterThan(1)

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    last.focus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(first).toHaveFocus()

    first.focus()
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()
  })
})
