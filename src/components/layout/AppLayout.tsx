import { useState, useEffect, useRef, type ReactNode, Suspense } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import {
  isNavDestinationActive,
  isQuizPlayFocusPath,
  type NavDestinationId,
} from '../../utils/navActive'

type NavSection = 'Overview' | 'Library' | 'Practice' | 'System'

interface NavItem {
  id: NavDestinationId
  name: string
  path: string
  icon: ReactNode
  section: NavSection
}

const navSections: NavSection[] = ['Overview', 'Library', 'Practice', 'System']

const navItems: NavItem[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    path: '/',
    section: 'Overview',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: 'subjects',
    name: 'Subjects',
    path: '/subjects',
    section: 'Library',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    id: 'questions',
    name: 'Questions',
    path: '/questions',
    section: 'Library',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'start-quiz',
    name: 'Start Quiz',
    path: '/quiz/setup',
    section: 'Practice',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'mistakes',
    name: 'Mistakes',
    path: '/mistakes',
    section: 'Practice',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  {
    id: 'history',
    name: 'History',
    path: '/history',
    section: 'Practice',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'settings',
    name: 'Settings',
    path: '/settings',
    section: 'System',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 font-semibold text-text-main ${className}`}>
      <svg className="w-5 h-5 shrink-0 text-primary-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
      <span>TurboQuiz</span>
    </span>
  )
}

function navItemClass(active: boolean) {
  return `flex min-h-11 items-center gap-3 px-3 py-2 text-sm rounded-lg border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised ${
    active
      ? 'bg-primary-bg text-primary-text border-primary-base/20 font-semibold'
      : 'border-transparent font-medium text-text-muted hover:text-text-main hover:bg-surface-overlay'
  }`
}

function PageSuspenseFallback() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center" role="status" aria-live="polite">
      <div className="size-9 animate-spin rounded-full border-2 border-border-strong border-t-primary-base" aria-hidden="true" />
      <p className="text-sm text-text-muted">Loading page...</p>
    </div>
  )
}

export default function AppLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()
  const isQuizFocus = isQuizPlayFocusPath(location.pathname)

  const toggleButtonRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const wasOpenedRef = useRef(false)

  // Manage drawer focus transitions (focus entry and restoration)
  useEffect(() => {
    if (isQuizFocus) return

    if (isMobileMenuOpen) {
      wasOpenedRef.current = true
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (focusable && focusable.length > 0) {
        focusable[0].focus()
      }
    } else if (wasOpenedRef.current) {
      toggleButtonRef.current?.focus()
    }
  }, [isMobileMenuOpen, isQuizFocus])

  // Accessibility keyboard event listeners (Escape close and Tab focus containment)
  useEffect(() => {
    if (!isMobileMenuOpen || isQuizFocus) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false)
        return
      }

      if (e.key === 'Tab') {
        if (!drawerRef.current) return
        const focusable = Array.from(
          drawerRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        )
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus()
            e.preventDefault()
          }
        } else if (document.activeElement === last) {
          first.focus()
          e.preventDefault()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMobileMenuOpen, isQuizFocus])

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen && !isQuizFocus) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen, isQuizFocus])

  if (isQuizFocus) {
    return (
      <div className="min-h-screen bg-surface-base text-text-main font-sans selection:bg-primary-base/30 selection:text-text-main">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary-base focus:text-text-inverse focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-base focus:ring-border-focus"
        >
          Skip to main content
        </a>

        <header className="sticky top-0 z-30 border-b border-border-subtle bg-surface-raised">
          <div className="mx-auto flex min-h-14 max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <BrandMark className="text-base" />
              <p className="mt-0.5 text-xs text-text-muted">Quiz in progress</p>
            </div>
            <Link
              to="/quiz/setup"
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg px-3 text-sm font-medium text-text-muted transition-colors hover:bg-surface-overlay hover:text-text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
            >
              Exit to setup
            </Link>
          </div>
        </header>

        <main
          id="main-content"
          className="mx-auto w-full max-w-3xl px-4 py-6 pb-24 sm:px-6 sm:py-8 sm:pb-8 outline-none"
          tabIndex={-1}
        >
          <Suspense fallback={<PageSuspenseFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-base text-text-main flex flex-col lg:flex-row font-sans selection:bg-primary-base/30 selection:text-text-main">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary-base focus:text-text-inverse focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-base focus:ring-border-focus"
      >
        Skip to main content
      </a>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 sticky top-0 h-screen overflow-y-auto border-r border-border-subtle bg-surface-raised">
        <div className="px-5 py-5 border-b border-border-subtle">
          <Link
            to="/"
            className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
          >
            <BrandMark className="text-lg" />
          </Link>
          <p className="mt-1 pl-7 text-xs text-text-muted">Your local study workspace</p>
        </div>

        <nav className="flex-1 px-3 py-5" aria-label="Desktop primary navigation">
          {navSections.map((section) => (
            <div key={section} className="mb-5 last:mb-0">
              <p className="px-3 mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
                {section}
              </p>
              <div className="space-y-0.5">
                {navItems
                  .filter((item) => item.section === section)
                  .map((item) => {
                    const active = isNavDestinationActive(item.id, location.pathname)
                    return (
                      <Link
                        key={item.id}
                        to={item.path}
                        aria-current={active ? 'page' : undefined}
                        className={navItemClass(active)}
                      >
                        <span className={active ? 'text-primary-text' : 'text-text-muted'}>{item.icon}</span>
                        {item.name}
                      </Link>
                    )
                  })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto border-t border-border-subtle px-5 py-4">
          <p className="text-xs font-medium text-text-main">Saved on this device</p>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            No account or cloud connection required.
          </p>
        </div>
      </aside>

      {/* Mobile Top Navigation Header */}
      <header className="lg:hidden sticky top-0 z-40 flex min-h-14 items-center justify-between border-b border-border-subtle bg-surface-raised px-4 py-3 sm:px-6">
        <Link
          to="/"
          className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
        >
          <BrandMark className="text-base" />
        </Link>
        <button
          ref={toggleButtonRef}
          type="button"
          onClick={() => setIsMobileMenuOpen((open) => !open)}
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-drawer"
          aria-label="Toggle navigation menu"
          className="inline-flex size-11 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-overlay hover:text-text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus cursor-pointer"
        >
          {isMobileMenuOpen ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          )}
        </button>
      </header>

      {/* Mobile Drawer */}
      <div
        aria-hidden={!isMobileMenuOpen}
        inert={!isMobileMenuOpen}
        className={`fixed inset-0 z-40 lg:hidden transition-opacity duration-300 ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="absolute inset-0 bg-text-main/40"
          aria-hidden="true"
        />
        <div
          ref={drawerRef}
          id="mobile-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className={`absolute top-0 right-0 flex h-full w-[min(20rem,88vw)] flex-col border-l border-border-subtle bg-surface-raised py-4 shadow-lg transition-transform duration-300 ${
            isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="mb-4 flex items-center justify-between px-5">
            <span className="text-sm font-semibold text-text-main">Navigation</span>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="inline-flex size-11 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-overlay hover:text-text-main cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Mobile primary navigation">
            {navSections.map((section) => (
              <div key={section} className="mb-5 last:mb-0">
                <p className="px-3 mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {section}
                </p>
                <div className="space-y-0.5">
                  {navItems
                    .filter((item) => item.section === section)
                    .map((item) => {
                      const active = isNavDestinationActive(item.id, location.pathname)
                      return (
                        <Link
                          key={item.id}
                          to={item.path}
                          aria-current={active ? 'page' : undefined}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={navItemClass(active)}
                        >
                          <span className={active ? 'text-primary-text' : 'text-text-muted'}>{item.icon}</span>
                          {item.name}
                        </Link>
                      )
                    })}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-border-subtle px-5 py-4">
            <p className="text-xs font-medium text-text-main">Saved on this device</p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              No account or cloud connection required.
            </p>
          </div>
        </div>
      </div>

      <main
        id="main-content"
        className="flex-1 w-full max-w-7xl mx-auto p-4 pb-24 sm:p-6 sm:pb-6 lg:p-10 lg:pb-10 xl:p-12 xl:pb-12 outline-none"
        tabIndex={-1}
      >
        <Suspense fallback={<PageSuspenseFallback />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
