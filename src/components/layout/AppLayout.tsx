import { useState, useEffect, useRef, type ReactNode, Suspense } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'

interface NavItem {
  name: string
  path: string
  icon: ReactNode
}

export default function AppLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()

  const toggleButtonRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const wasOpenedRef = useRef(false)

  // Manage drawer focus transitions (focus entry and restoration)
  useEffect(() => {
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
  }, [isMobileMenuOpen])

  // Accessibility keyboard event listeners (Escape close and Tab focus containment)
  useEffect(() => {
    if (!isMobileMenuOpen) return

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
        } else {
          if (document.activeElement === last) {
            first.focus()
            e.preventDefault()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMobileMenuOpen])


  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  const navItems: NavItem[] = [
    {
      name: 'Dashboard',
      path: '/',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    {
      name: 'Subjects',
      path: '/subjects',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
    {
      name: 'Questions',
      path: '/questions',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      name: 'Start Quiz',
      path: '/quiz/setup',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      name: 'Mistakes',
      path: '/mistakes',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )
    },
    {
      name: 'History',
      path: '/history',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      name: 'Settings',
      path: '/settings',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    }
  ]

  const isRouteActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col lg:flex-row font-sans selection:bg-indigo-500/35 selection:text-white">
      {/* Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-slate-100 focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 transition-all"
      >
        Skip to main content
      </a>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-955 border-r border-slate-800 sticky top-0 h-screen overflow-y-auto shrink-0">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <Link to="/" className="text-xl font-black bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-2">
            <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span>TurboQuiz</span>
          </Link>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1" aria-label="Desktop primary navigation">
          {navItems.map((item) => {
            const active = isRouteActive(item.path)
            return (
              <Link
                key={item.name}
                to={item.path}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                  active
                    ? 'bg-indigo-600/15 text-indigo-400 border-l-4 border-indigo-500 pl-3'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span className={active ? 'text-indigo-400' : 'text-slate-500'}>{item.icon}</span>
                {item.name}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Mobile Top Navigation Header */}
      <header className="lg:hidden flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800 sticky top-0 z-40">
        <Link to="/" className="text-lg font-black bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span>TurboQuiz</span>
        </Link>
        <button
          ref={toggleButtonRef}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-expanded={isMobileMenuOpen}
          aria-label="Toggle navigation menu"
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
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

      {/* Mobile Drawer (with slide transition & overlay backdrop) */}
      <div
        className={`fixed inset-0 z-40 lg:hidden transition-opacity duration-300 ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop overlay */}
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          aria-hidden="true"
        />
        {/* Drawer content */}
        <div
          ref={drawerRef}
          id="mobile-drawer"
          className={`absolute top-0 right-0 w-64 max-w-xs h-full bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col py-6 transition-transform duration-300 ${
            isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="px-6 mb-6 flex items-center justify-between">
            <span className="text-base font-bold text-slate-300">Navigation</span>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="p-1 text-slate-500 hover:text-slate-300 rounded cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="flex-1 px-4 space-y-1" aria-label="Mobile primary navigation">
            {navItems.map((item) => {
              const active = isRouteActive(item.path)
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                    active
                      ? 'bg-indigo-600/15 text-indigo-400 border-l-4 border-indigo-500 pl-3'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <span className={active ? 'text-indigo-400' : 'text-slate-500'}>{item.icon}</span>
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <main
        id="main-content"
        className="flex-1 p-6 lg:p-10 max-w-6xl mx-auto w-full outline-none"
        tabIndex={-1}
      >
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4 text-center" aria-live="polite">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
            <p className="text-slate-400 text-sm">Loading page...</p>
          </div>
        }>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
