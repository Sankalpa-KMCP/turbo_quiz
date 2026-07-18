import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import App from './App'

vi.mock('./components/layout/ReloadPrompt', () => ({
  ReloadPrompt: () => null
}))

describe('App Shell and Routing', () => {
  beforeEach(() => {
    // Reset history state to dashboard before each test
    window.history.pushState({}, '', '/')
  })

  it('renders the application shell and Dashboard by default', async () => {
    render(<App />)

    // Check for brand logo / title in sidebar & header
    expect(screen.getAllByText('TurboQuiz')).toHaveLength(2)

    // Check if default page (Dashboard) is rendered
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Dashboard/i })).toBeInTheDocument()
      expect(
        screen.getByText(/Track your overall performance, strengths, and subject-level proficiency/i)
      ).toBeInTheDocument()
    })
  })

  it('navigates to the Subjects page when clicking the sidebar link', async () => {
    render(<App />)

    const subjectsLinks = screen.getAllByRole('link', { name: /Subjects/i })
    expect(subjectsLinks.length).toBeGreaterThan(0)

    fireEvent.click(subjectsLinks[0])

    expect(await screen.findByRole('heading', { name: /Subjects/i })).toBeInTheDocument()
    expect(screen.getByText(/Organize your study library/i)).toBeInTheDocument()
  })

  it('renders dynamic subject route parameters safely', async () => {
    window.history.pushState({}, '', '/subjects/math-101')
    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Invalid Subject ID/i })).toBeInTheDocument()
    })
  })

  it('redirects /quiz/play without an active session to /quiz/setup', async () => {
    window.history.pushState({}, '', '/quiz/play')
    render(<App />)
    expect(await screen.findByRole('heading', { name: /Configure Quiz/i })).toBeInTheDocument()
  })

  it('redirects legacy /quiz/results without attemptId to /quiz/setup', async () => {
    window.history.pushState({}, '', '/quiz/results')
    render(<App />)
    expect(await screen.findByRole('heading', { name: /Configure Quiz/i })).toBeInTheDocument()
  })

  it('renders 404 not found page for unmatched routes', async () => {
    window.history.pushState({}, '', '/some-non-existent-route')
    render(<App />)

    expect(await screen.findByRole('heading', { name: /404/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Page Not Found/i })).toBeInTheDocument()
  })

  it('toggles mobile menu open and close accessibly', () => {
    render(<App />)

    const toggleBtn = screen.getByRole('button', { name: /Toggle navigation menu/i })
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggleBtn)
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true')

    const closeBtn = screen.getByRole('button', { name: /Close navigation menu/i })
    fireEvent.click(closeBtn)
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false')
  })

  // Keyboard Accessibility Tests
  it('closes the drawer when Escape is pressed', () => {
    render(<App />)
    const toggleBtn = screen.getByRole('button', { name: /Toggle navigation menu/i })

    // Open drawer
    fireEvent.click(toggleBtn)
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true')

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false')
  })

  it('moves focus into the drawer when it opens', () => {
    render(<App />)
    const toggleBtn = screen.getByRole('button', { name: /Toggle navigation menu/i })

    fireEvent.click(toggleBtn)

    // First focusable element should be the Close menu button
    const closeBtn = screen.getByRole('button', { name: /Close navigation menu/i })
    expect(document.activeElement).toBe(closeBtn)
  })

  it('restores focus to the toggle button when the drawer closes', () => {
    render(<App />)
    const toggleBtn = screen.getByRole('button', { name: /Toggle navigation menu/i })

    // Focus and click
    toggleBtn.focus()
    expect(document.activeElement).toBe(toggleBtn)
    fireEvent.click(toggleBtn)

    const closeBtn = screen.getByRole('button', { name: /Close navigation menu/i })
    fireEvent.click(closeBtn)

    // Focus restored
    expect(document.activeElement).toBe(toggleBtn)
  })

  it('wraps focus from last to first element on Tab, and first to last on Shift+Tab', () => {
    render(<App />)
    const toggleBtn = screen.getByRole('button', { name: /Toggle navigation menu/i })

    fireEvent.click(toggleBtn)

    const drawer = document.getElementById('mobile-drawer')
    expect(drawer).toBeInTheDocument()

    const focusable = drawer!.querySelectorAll('a, button')
    const first = focusable[0] as HTMLElement
    const last = focusable[focusable.length - 1] as HTMLElement

    // Tab wrapping (Forward)
    last.focus()
    expect(document.activeElement).toBe(last)
    fireEvent.keyDown(window, { key: 'Tab', code: 'Tab' })
    expect(document.activeElement).toBe(first)

    // Shift+Tab wrapping (Reverse)
    first.focus()
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(window, { key: 'Tab', code: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })
})
