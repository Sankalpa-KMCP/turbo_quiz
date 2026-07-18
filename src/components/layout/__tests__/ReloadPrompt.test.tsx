import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReloadPrompt } from '../ReloadPrompt'

const updateServiceWorker = vi.fn()
const setOfflineReady = vi.fn()
const setNeedRefresh = vi.fn()

const swState = {
  offlineReady: false,
  needRefresh: false,
}

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    offlineReady: [swState.offlineReady, setOfflineReady],
    needRefresh: [swState.needRefresh, setNeedRefresh],
    updateServiceWorker,
  }),
}))

describe('ReloadPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    swState.offlineReady = false
    swState.needRefresh = false
  })

  it('renders nothing when idle', () => {
    const { container } = render(<ReloadPrompt />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows offline-ready status and dismisses without reload', () => {
    swState.offlineReady = true
    render(<ReloadPrompt />)

    expect(screen.getByRole('status')).toHaveTextContent(/ready to work offline/i)
    expect(screen.queryByRole('button', { name: /^Reload$/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Dismiss/i }))
    expect(setOfflineReady).toHaveBeenCalledWith(false)
    expect(setNeedRefresh).toHaveBeenCalledWith(false)
    expect(updateServiceWorker).not.toHaveBeenCalled()
  })

  it('shows update messaging and reloads via the service worker helper', () => {
    swState.needRefresh = true
    render(<ReloadPrompt />)

    expect(screen.getByRole('status')).toHaveTextContent(/new version is available/i)
    fireEvent.click(screen.getByRole('button', { name: /^Reload$/i }))
    expect(updateServiceWorker).toHaveBeenCalledWith(true)

    fireEvent.click(screen.getByRole('button', { name: /Dismiss/i }))
    expect(setOfflineReady).toHaveBeenCalledWith(false)
    expect(setNeedRefresh).toHaveBeenCalledWith(false)
  })
})