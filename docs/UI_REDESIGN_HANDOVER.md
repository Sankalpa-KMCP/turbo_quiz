# Quiet Study Desk - UI redesign handover

Maintainer-facing summary of the completed Quiet Study Desk redesign (commits `52f4169` through `411a66a` on `main`). Product behavior, Dexie schema, repositories, Zustand quiz logic, scoring, backup/restore/reset, and routes were intentionally preserved.

## Outcome

TurboQuiz presents as a cohesive light-first study workspace: cool-paper surfaces, near-black ink, steel-teal accent, restrained elevation, offline Source Serif 4 + IBM Plex Sans, accessible shell and dialogs, and redesigned Dashboard, authoring, quiz, mistakes, history, settings, error, Not Found, and PWA update surfaces.

## Design-system decisions

| Decision | Location / notes |
|---|---|
| Semantic tokens (surfaces, text, primary, status) | `src/index.css` `@theme` |
| Self-hosted WOFF2 + SIL OFL licenses | `src/assets/fonts/`, `src/assets/fonts/licenses/` |
| Light-first document; no dark theme | `color-scheme` / body styles in `src/index.css` |
| PWA theme/background aligned to desk palette | `vite.config.ts` (`#0f766e` / `#f4f6f8`) |
| Prefer divider lists and sectioned chrome over card stacks | Page compositions under `src/pages/` |

## Shared primitives (ownership)

All under `src/components/ui/` with colocated tests where present:

`Button`, `buttonStyles`, `Input`, `Select`, `Textarea`, `Field`, `ConfirmDialog`, `Card`, `Badge`, `Alert`, `PageHeader`, `LoadingState`, `EmptyState`.

- Forms use `Field`.
- Destructive or consequential confirms use `ConfirmDialog` (Settings restore/reset).
- Page chrome uses `PageHeader`, `LoadingState`, and `EmptyState`.

## Route-specific UX

| Behavior | Evidence |
|---|---|
| `/questions` without `subjectId` shows an inline subject picker | `QuestionsPage` + tests |
| `/quiz/play` uses a focused shell (nav chrome hidden) | `isQuizPlayFocusPath` in `src/utils/navActive.ts`, `AppLayout` |
| Results remain under History nav active state | `isNavDestinationActive('history', ...)` |
| Route table unchanged | `src/app/router.tsx` |

## Accessibility foundations

- Skip link; labeled desktop nav and mobile drawer (focus trap, Escape, restore)
- Dialog naming, Cancel-first focus, Tab containment, pending guards
- Progressbar and question navigator names; correctness / bookmark state beyond color
- Semantic History table; reduced-motion rules in CSS; minimum control heights for touch

## Validation used for the redesign

```bash
npm run lint
npm run test
npm run build
git diff --check
```

Vitest uses `fileParallelism: false`. Stage 7 final review also exercised core workflows and repeated Mistakes integration checks; treat current `npm run test` as the ongoing gate.

## What did not change

- Routes, domain models, Dexie version/indexes, repository contracts
- Zustand phases, selection/shuffle, practice/exam/mistakes feedback rules
- Scoring, attempt persistence, snapshots, mistake projection, retry IDs
- Backup schema/version, full-replacement restore, reset table clearing
- Service-worker registration strategy (`registerType: 'prompt'`)

## Known limitations (unchanged product scope)

- Local IndexedDB only; no sync, accounts, or backend
- Restore replaces data; reset is destructive
- No CI/CD or provider deploy configs in-repo; SPA hosts need `index.html` fallback

## Branch readiness (documentation step)

Redesign commits live on `main` through `411a66a`. This documentation commit records the verified UI direction. **No push, merge, release, or deployment was performed as part of documentation handover.**
