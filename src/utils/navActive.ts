export type NavDestinationId =
  | 'dashboard'
  | 'subjects'
  | 'questions'
  | 'start-quiz'
  | 'mistakes'
  | 'history'
  | 'settings'

/**
 * Route-aware active matching for primary navigation.
 * Prefer explicit destinations over broad string prefixes to avoid false positives
 * (e.g. /quiz/results highlighting Start Quiz).
 */
export function isNavDestinationActive(id: NavDestinationId, pathname: string): boolean {
  switch (id) {
    case 'dashboard':
      return pathname === '/'
    case 'subjects':
      return pathname === '/subjects' || pathname.startsWith('/subjects/')
    case 'questions':
      return pathname === '/questions' || pathname.startsWith('/questions/')
    case 'start-quiz':
      return pathname === '/quiz/setup' || pathname === '/quiz/play'
    case 'mistakes':
      return pathname === '/mistakes' || pathname.startsWith('/mistakes/')
    case 'history':
      return (
        pathname === '/history' ||
        pathname.startsWith('/history/') ||
        pathname === '/quiz/results' ||
        pathname.startsWith('/quiz/results/')
      )
    case 'settings':
      return pathname === '/settings' || pathname.startsWith('/settings/')
    default: {
      const _exhaustive: never = id
      return _exhaustive
    }
  }
}

export function isQuizPlayFocusPath(pathname: string): boolean {
  return pathname === '/quiz/play'
}
