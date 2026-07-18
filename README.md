# TurboQuiz

TurboQuiz is a private quiz practice app that runs entirely in your browser. You build subjects, topics, and questions on your own machine, run practice or exam sessions, and review mistakes and history—without creating an account or talking to a server.

Everything you write and every attempt you take stays in local browser storage (IndexedDB via Dexie). That means it works offline after the app is loaded, and it also means only you can back up or recover your data. There is no cloud sync and no remote copy of your study materials.

The interface follows a light **Quiet Study Desk** look: cool paper backgrounds, near-black ink, and a steel-teal accent, with Source Serif 4 for titles and reading text and IBM Plex Sans for chrome. Details for contributors are below.

## What you can do

Organize material into subjects and topics, then add multiple-choice questions with explanations. Start a session from Quiz Setup: **practice** gives feedback as you go; **exam** waits until the end. Wrong answers show up under Mistakes so you can retry them. The Dashboard and History pages summarize recent attempts on this device.

A few navigation details that are easy to miss:

- Opening `/questions` without a subject filter shows an inline subject picker when you already have subjects.
- `/quiz/play` hides the usual navigation so the session stays front and center.
- Results pages (`/quiz/results/:attemptId`) highlight under History in the nav.

## Getting started

You need [Node.js](https://nodejs.org) (LTS is a safe choice; this repo does not pin an `engines` version).

```bash
npm install
npm run dev
```

Then open the URL Vite prints in the terminal.

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Local development server |
| `npm run lint` | ESLint |
| `npm run test` | Full Vitest suite (one-shot) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run build` | Typecheck and production build |
| `npm run preview` | Serve the production build locally |

Tests use Vitest with `fileParallelism: false` in `vite.config.ts` so IndexedDB-backed suites do not step on each other.

## How local data works

TurboQuiz does not send your questions or scores anywhere. Durable data lives in this browser origin’s IndexedDB. A different browser, profile, or device is a separate workspace.

> [!WARNING]
> Clearing site data, deleting IndexedDB, or using Reset in Settings permanently removes your subjects, questions, and history. Clearing the ordinary HTTP cache for static files does **not** wipe that database—but site-data / storage clearing does.

There is no account and no server-side recovery. If the data matters, keep a backup file on disk.

## Backup, restore, and reset

All of this lives under **Settings**:

1. **Download JSON Backup** — saves a snapshot you can store anywhere you control. Export before restore or reset.
2. **Restore** — validates the file, then **replaces** everything currently in the app with the backup. You will get an in-app confirmation first.
3. **Reset database** — clears all local TurboQuiz tables. Same confirmation pattern; irreversible unless you already exported.

These flows use the shared `ConfirmDialog` component (not the browser’s `alert` / `confirm`). Status messages use the in-app `Alert` component.

## UI and contribution guidance

The visual system is light-first Quiet Study Desk—cool paper (`#f4f6f8`), ink (`#15202b`), steel teal (`#0f766e`, hover `#115e59`). Prefer restrained borders and sectioned layouts over stacks of decorative cards. There is no dark theme.

Fonts are self-hosted WOFF2 files under `src/assets/fonts/` (with `font-display: swap` and system fallbacks in `src/index.css`):

- **Source Serif 4** — titles and study reading · SIL OFL · `src/assets/fonts/licenses/SOURCE-SERIF-4-LICENSE.md`
- **IBM Plex Sans** — UI chrome · SIL OFL · `src/assets/fonts/licenses/IBM-PLEX-SANS-LICENSE.txt`

See also `src/assets/fonts/README.md`.

Colors and surfaces come from semantic tokens in `src/index.css`. Shared controls live in `src/components/ui/`:

- Forms: wrap labels, helpers, and errors with **`Field`**; use `Input`, `Select`, and `Textarea` underneath.
- Confirms: use **`ConfirmDialog`** for destructive or consequential actions—do not add native `alert` / `confirm` for those flows.
- Page chrome: **`PageHeader`**, **`LoadingState`**, **`EmptyState`**.
- Also available: `Button` / `buttonStyles`, `Card`, `Badge`, `Alert`.

Keep focus rings (`focus-visible:ring-2 focus-visible:ring-border-focus`) and mark selected or correct/incorrect states with more than color alone. The mobile nav drawer should trap focus, close on Escape, and return focus to the menu button (`AppLayout`). Layout shell, error boundary, and PWA reload prompt live under `src/components/layout/`.

For a maintainer-oriented summary of the redesign, see [`docs/UI_REDESIGN_HANDOVER.md`](docs/UI_REDESIGN_HANDOVER.md).

### Stack (for developers)

React 19, Vite 8, TypeScript, Tailwind CSS 4, Dexie (IndexedDB), Zustand (active quiz session), React Hook Form and Zod, vite-plugin-pwa (`registerType: 'prompt'`), Vitest and Testing Library.

## Hosting and PWA

This is a client-side SPA. If you put it on a static host, configure unknown paths to fall back to `index.html` so deep links and reloads work.

A service worker is registered with an update prompt (`registerType: 'prompt'`). Manifest theme and background colors match Quiet Study Desk (`#0f766e` / `#f4f6f8`). Icons and favicon are already in `public/`:

- `favicon.svg`
- `pwa-192x192.png`
- `pwa-512x512.png`
- `icons.svg`

This repository does not include provider-specific deploy files (no `vercel.json` / `netlify.toml`) or a CI workflow. Hosting and release are up to you.

## Known limitations

- Data stays in one browser origin—no accounts, backend, or multi-device sync.
- Restore replaces local data; reset clears it.
- No CI/CD or production-host config ships in the repo; SPA hosts still need the `index.html` fallback.
- Node and npm versions are not pinned via `engines`.
