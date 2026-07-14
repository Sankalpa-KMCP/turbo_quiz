import 'fake-indexeddb/auto'
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Run cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup()
})

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    offlineReady: [false, vi.fn()],
    needRefresh: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}))
