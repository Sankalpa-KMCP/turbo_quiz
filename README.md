# TurboQuiz

TurboQuiz is a private, local-first quiz preparation and practice Single Page Application (SPA). It is built as a calm study workspace: all subjects, questions, attempts, and backups stay in the browser, with full offline usability and no accounts, servers, or telemetry.

## Quiet Study Desk

The UI follows a light-first **Quiet Study Desk** visual direction:

- **Cool paper** surface (`#f4f6f8`) as the default page background
- **Near-black ink** (`#15202b`) for primary text
- **Steel teal** (`#0f766e`, hover `#115e59`) as the single accent for primary actions, focus, and selected states
- Restrained borders, radii, elevation, and badge shapes — prefer divider-led lists and sectioned layout over card-heavy dashboards
- Semantic design tokens in `src/index.css` (`surface-*`, `text-*`, `primary-*`, status colors); prefer tokens over arbitrary palette utilities

There is no dark theme in the application.

### Typography (offline)

Titles and study reading content use **Source Serif 4**. Application chrome uses **IBM Plex Sans**. Both families are self-hosted as latin WOFF2 files under `src/assets/fonts/`, loaded with `font-display: swap` and system fallbacks declared in `src/index.css`.

| Family | Role | License |
|---|---|---|
| Source Serif 4 | Page titles and study-oriented reading | SIL Open Font License 1.1 — `src/assets/fonts/licenses/SOURCE-SERIF-4-LICENSE.md` |
| IBM Plex Sans | UI chrome and controls | SIL Open Font License 1.1 — `src/assets/fonts/licenses/IBM-PLEX-SANS-LICENSE.txt` |

See also `src/assets/fonts/README.md`.

## Product Overview & Workflows

- **Local-First Privacy**: No user accounts, backend servers, or telemetry. Data belongs to the local device and browser origin.
- **Content Authoring**: Organize study materials with **Subjects**, nested **Topics**, and **Questions** (options, correct answers, explanations).
- **Quiz Sessions**:
  - **Setup**: Choose a subject, topic, and quiz mode.
  - **Practice Mode**: Immediate correctness feedback and explanations after each answer.
  - **Exam Mode**: No correctness cues or explanations until results.
- **Mistakes Review**: Incorrect answers project to Mistakes; retry groups or clear items by answering correctly.
- **History & Dashboard**: Recent attempts, filters, and aggregated local metrics.
- **Backup & Safety**: JSON export, validate-and-restore, and full database reset under Settings (in-app confirmation required).

### Navigation notes

Routes are unchanged. A few UX details worth knowing:

- `/questions` without a `subjectId` query shows an inline **subject picker** when subjects exist.
- `/quiz/play` uses a **focused shell** (no primary navigation chrome) so the session stays front-and-center.
- Quiz Results (`/quiz/results/:attemptId`) remain under the **History** navigation context.

---

## Technology Stack

- **Framework**: React 19
- **Tooling & Build**: Vite 8 & TypeScript
- **Styling**: Tailwind CSS 4 with semantic tokens
- **Local Persistence**: Dexie over IndexedDB
- **State Management**: Zustand for quiz session state
- **Form Management**: React Hook Form & Zod
- **PWA**: vite-plugin-pwa (`registerType: 'prompt'`)
- **Test Framework**: Vitest & Testing Library (`fileParallelism: false`)

---

## Setup and Development

### Prerequisites

- [Node.js](https://nodejs.org) (LTS recommended; no `engines` field is pinned in `package.json`)

### Installation

```bash
npm install
```

### Running Development Server

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

### Running Tests

Vitest is configured with `fileParallelism: false` (see `vite.config.ts`) so IndexedDB-backed suites stay isolated:

```bash
npm run test
```

Watch mode:

```bash
npm run test:watch
```

### Linting

```bash
npm run lint
```

---

## Local Data & Safety

> [!WARNING]
> TurboQuiz stores all application data in IndexedDB. Clearing site data, resetting the in-app database, or deleting IndexedDB records permanently removes subjects, questions, and attempt history. Clearing the ordinary HTTP cache for static assets does not remove IndexedDB data.

- **Download JSON Backup**: Under Settings, use **Download JSON Backup** to save a portable snapshot before destructive actions. There is no cloud account or server-side recovery.
- **Restore Backup**: Validates the selected JSON backup, then **replaces** all current local application data with the backup contents. Requires in-app confirmation.
- **Reset Database**: Removes all locally stored TurboQuiz tables. Irreversible except for a prior export. Requires in-app confirmation.

Destructive flows use the shared `ConfirmDialog` (not native `alert` / `confirm`). Status feedback uses in-app `Alert` surfaces.

---

## UI Architecture & Contribution Guidelines

Semantic tokens and shared primitives live under `src/index.css` and `src/components/ui/`. Prefer tokens and primitives over one-off styling.

| Primitive | Intended use |
|---|---|
| `Button` / `buttonStyles` | Primary, secondary, danger, and ghost actions; reuse `buttonStyles` when you need link/button chrome without the component |
| `Input`, `Select`, `Textarea` | Base form controls |
| `Field` | Labels, helper text, required/optional indication, and validation errors (`aria-invalid` / `aria-describedby`) |
| `ConfirmDialog` | Modal confirmations for destructive or consequential actions (focus trap, Escape, pending state) |
| `Card` | Interactive or grouped content containers when a surface is truly needed — avoid decorative card stacks |
| `Badge` | Compact status or mode labels |
| `Alert` | Inline success, warning, danger, and info feedback |
| `PageHeader` | Consistent page title and supporting copy |
| `LoadingState` | In-page loading copy |
| `EmptyState` | Empty lists and first-run guidance |

Contribution rules:

- Repeated page chrome should use `PageHeader`, `LoadingState`, and `EmptyState`.
- Form labels, helpers, and errors should use `Field`.
- Confirmations for covered flows should use `ConfirmDialog`; do not add native blocking `alert` / `confirm` for those flows.
- Prefer semantic tokens (`bg-surface-raised`, `text-text-muted`, `border-border-focus`, …) over hardcoded palette utilities.
- Keep focus rings (`focus-visible:ring-2 focus-visible:ring-border-focus`) and non-color state cues (borders, weights, text).
- Mobile drawer: trap focus, dismiss on Escape, restore focus to the menu trigger (`AppLayout`).

Layout shell: `src/components/layout/AppLayout.tsx`. Global render errors: `GlobalErrorBoundary`. PWA update prompt: `ReloadPrompt`.

For redesign decisions and validation notes aimed at maintainers, see [`docs/UI_REDESIGN_HANDOVER.md`](docs/UI_REDESIGN_HANDOVER.md).

---

## Deployment & PWA Notes

- **Hosting**: This is an SPA. Configure the static host so unknown paths fall back to `index.html` (deep links and reloads).
- **PWA**: `vite-plugin-pwa` registers a service worker with `registerType: 'prompt'`. Manifest theme/background colors match Quiet Study Desk (`#0f766e` / `#f4f6f8`).
- **Static assets** present under `public/`:
  - `favicon.svg`
  - `pwa-192x192.png`
  - `pwa-512x512.png`
  - `icons.svg`

There is no in-repository provider-specific deploy config (no `vercel.json` / `netlify.toml`) and no CI workflow in this repository.

---

## Known Limitations

- Browser-local data only — no account, multi-device sync, or application backend.
- Restore fully replaces existing local data; reset clears all local TurboQuiz tables.
- No repository CI/CD pipeline.
- No in-repository production-host deployment configuration; SPA hosts still need fallback routing.
- Node.js / npm versions are not pinned via `engines`.
