# TurboQuiz

TurboQuiz is a private, local-first quiz preparation and practice Single Page Application (SPA) designed to provide a focused, calm study environment. All data is kept strictly inside the user's browser, enabling full offline usability.

## Product Overview & Workflows

- **Local-First Privacy**: No user accounts, backend servers, database servers, or telemetry tracking. All information belongs entirely to the local device.
- **Content Authoring**: Organize your study materials by creating **Subjects**, nested **Topics**, and customized **Questions** with dynamic option fields, correct answer mappings, and learning explanations.
- **Quiz Sessions**:
  - **Setup**: Choose a subject, topic, and quiz mode.
  - **Practice Mode**: Provides immediate feedback (correct/incorrect answer highlights) and displays explanation text as you answer.
  - **Exam Mode**: Simulates actual exam conditions with no immediate correctness cues or explanations.
- **Mistakes Review**: Incorrectly answered questions are automatically projected to the Mistakes panel, allowing you to retry incorrect groups or clear them by answering correctly.
- **Analytics & History**: Track aggregated metrics (accuracy, completed count, total time spent) via progress bars and recent attempts, with filters on the History review page.
- **Backup & Safety**: Clear database resets or backup restore procedures can be performed under Settings.

---

## Technology Stack

- **Framework**: React 19 (v19.2.7)
- **Tooling & Build**: Vite 8 (v8.1.1) & TypeScript
- **Styling**: Tailwind CSS 4 (v4.3.2) utilizing semantic tokens
- **Local Persistence**: Dexie.js (v4.4.4) over IndexedDB
- **State Management**: Zustand (v5.0.14) for quiz session state machines
- **Form Management**: React Hook Form (v7.81.0) & Zod (v4.4.3)
- **Test Framework**: Vitest (v4.1.10) & Testing Library

---

## Setup and Development

### Prerequisites
- [Node.js](https://nodejs.org) (Recommended: LTS version. No specific node engine is pinned in package.json)

### Installation
Install project dependencies using your package manager:
```bash
npm install
```

### Running Development Server
Start the local server (Vite):
```bash
npm run dev
```

### Production Build
Compile TypeScript and build the production-ready assets:
```bash
npm run build
```

### Preview Production Build
Run a local server to preview the built application:
```bash
npm run preview
```

### Running Tests
Execute the full test suite in parallel:
```bash
npm run test
```

For continuous watch mode during development:
```bash
npm run test:watch
```

### Linting
Validate code style and syntax matching ESLint rule definitions:
```bash
npm run lint
```

---

## Local Data & Safety

> [!WARNING]
> Since TurboQuiz stores all databases locally within IndexedDB, clearing your browser's site data, clearing the application's stored database, or deleting IndexedDB records will permanently remove all subjects, questions, and attempt history. Regular HTTP browser cache clearing (for static assets) does not affect IndexedDB databases.

- **Backup Export**: Before performing destructive actions, go to **Settings** and click **Export Backup** to save a JSON snapshot of your data to your local machine.
- **Restore Backup**: Overwrites the current local database with contents of a selected backup file.
- **Reset Database**: Clears all records in the local browser IndexedDB. This action is irreversible.

---

## UI Architecture & Contribution Guidelines

- **Semantic Tokens**: Styled custom attributes (such as surfaces, text, overlays, and status alerts) are defined as semantic CSS properties inside `src/index.css`. Avoid hardcoded Tailwind palette overrides (e.g. `bg-slate-900`) in favor of tokens like `bg-surface-raised`.
- **UI Primitives**: All shared controls and surfaces must utilize the reusable primitives located in `src/components/ui/` (`Button`, `Input`, `Textarea`, `Select`, `Card`, `Badge`, `Alert`).
- **Layout Shell**:
  - The desktop layout and responsive mobile drawers are managed in `src/components/layout/AppLayout.tsx`.
  - Global error triggers are captured by `src/components/layout/GlobalErrorBoundary.tsx`.
- **Keyboard Navigation & Accessibility**:
  - Always maintain high-contrast focus rings (`focus-visible:ring-2 focus-visible:ring-border-focus`).
  - Active elements must be distinguished by visual markers (borders/weights) in addition to colors.
  - The mobile drawer menu must trap tab key focus, exit on `Escape` key, and restore focus back to the menu trigger button.
  - Form validations must bind to the `aria-invalid` attribute and include description IDs.

---

## Deployment & PWA Notes

- **Hosting Requirements**: Since this is a Single Page Application (SPA), ensure your static hosting provider (Vercel, Netlify, GitHub Pages, etc.) is configured to route all unknown path requests back to `index.html` to support client-side deep links and reloads.
- **PWA Assets**: Progressive Web App manifests and workbox cache workers are pre-configured. Icon assets (`pwa-192x192.png`, `pwa-512x512.png`, and `favicon.svg`) are stored within the `/public` root folder.

---

## Known Limitations

- **No Device Sync**: Since data is stored client-side in browser storage, progress is not synchronized across different devices or profiles.
- **Single-User Workspace**: There is no multi-user profile separation or built-in authentication support.
- **Node.js Environment**: The project does not pin a specific minimum Node.js or npm version inside engine configurations.
- **No Remote Database**: The database exists entirely as a local indexed storage inside the current client origin.
- **No CI/CD Integration**: No GitHub Actions or automated CI/CD pipeline configurations are set up.
- **No Deployment Configuration**: There is no provider-specific hosting file (e.g., `vercel.json` or `netlify.toml`) included in the project template.
