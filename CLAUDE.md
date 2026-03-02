# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is `openmrs-esm-patient-chart`, a Yarn monorepo of microfrontend modules for the OpenMRS SPA patient chart. Each package under `packages/` is an independently deployable microfrontend built with React, TypeScript, and webpack (using the `openmrs` CLI tooling).

## Commands

### Install dependencies
```bash
yarn
```

### Start dev server (single microfrontend)
```bash
yarn start --sources 'packages/esm-patient-<name>-app'
```

### Start dev server (multiple microfrontends)
```bash
yarn start --sources 'packages/esm-patient-vitals-app' --sources 'packages/esm-patient-biometrics-app'
```

### Build all packages
```bash
yarn turbo run build
```

### Lint and typecheck
```bash
yarn verify  # runs lint, typescript, and test via turbo
```

### Run all unit tests
```bash
yarn turbo run test
```

### Run tests for a specific package
```bash
yarn turbo run test --filter=@openmrs/esm-patient-conditions-app
```

### Run a specific test file
```bash
yarn turbo run test -- visit-notes-form
```

### Run tests in watch mode (interactive)
```bash
yarn turbo run test:watch --ui tui -- <optional-file-pattern>
```

### Generate coverage report
```bash
yarn turbo run coverage
```

### E2E tests setup
```bash
npx playwright install
cp example.env .env
```

### Run E2E tests
```bash
yarn test-e2e                  # headless
yarn test-e2e --headed         # with browser UI
yarn test-e2e --headed --ui    # Playwright interactive debugger
yarn test-e2e <test-name>      # specific test file
```

### Extract i18n translations (per package)
```bash
yarn extract-translations  # run from within a package
```

### Update core libraries (when out of sync with dev3)
```bash
yarn up openmrs@next @openmrs/esm-framework@next
git checkout package.json   # reset version specifiers to `next`
yarn
```

## Architecture

### Monorepo structure

- **`packages/esm-patient-chart-app`** — The shell/host app. Defines the SPA route `patient/:patientUuid/chart`, renders the overall layout (navigation menu, patient header, chart review area, workspace, side menu), and orchestrates extension slots.
- **`packages/esm-patient-common-lib`** — Shared utilities and components consumed by all other packages. Key exports: `EmptyState`, `ErrorState`, `CardHeader`, `createDashboardLink`, `launchPatientChartWithWorkspaceOpen`, `usePatientChartStore`, `useSystemVisitSetting`, shared TypeScript types.
- **`packages/esm-patient-*-app`** — Feature microfrontends (allergies, conditions, vitals, medications, orders, forms, notes, tests, programs, immunizations, flags, attachments, lists, banner, label-printing).
- **`packages/esm-form-engine-app`** / **`packages/esm-form-entry-app`** — Form rendering engines (the Angular-based form-entry app is excluded from jest runs).
- **`packages/esm-generic-patient-widgets-app`** — Generic/configurable widget support.

### Extension slot system

Extensions and slots are declared in each package's `src/routes.json`. The chart shell exposes `patient-chart-dashboard-slot` which widget packages fill by registering dashboard link extensions. Each dashboard link points to a dashboard slot (e.g., `patient-chart-allergies-dashboard-slot`) that the widget package fills with its content extensions.

### Dashboard pattern

Each widget package follows this pattern:
1. `src/dashboard.meta.ts` — defines `path`, `title`, and `slot` for the dashboard link
2. `src/index.ts` — calls `getSyncLifecycle(createDashboardLink(dashboardMeta), ...)` to register the nav link, and `getAsyncLifecycle(...)` for workspace/widget components
3. `src/routes.json` — declares extensions, modals, and workspace registrations
4. Component files use `launchWorkspace2()` from `@openmrs/esm-framework` to open workspace panels

### Global state

`PatientChartStore` (in `esm-patient-common-lib/src/store/patient-chart-store.ts`) holds `patientUuid`, `patient`, `visitContext`, and `mutateVisitContext`. Use `usePatientChartStore(patientUuid)` within patient-chart-app. Workspaces that can be mounted by external apps (e.g., ward app) should receive patient/visit context as explicit props instead.

### Workspace system

Workspaces are declared in `routes.json` under `workspaces2` / `workspaceWindows2` / `workspaceGroups2`. Launch them with `launchWorkspace2(workspaceName, additionalProps)` from `@openmrs/esm-framework`. The workspace group `patient-chart` is scoped to `/patient/:uuid/chart` routes.

### Data fetching

Packages use SWR hooks with `@openmrs/esm-framework`'s `openmrsFetch`, `restBaseUrl`, and `fhirBaseUrl`. Data resource files are conventionally named `*.resource.ts`.

### Testing conventions

- Test files: `*.test.ts` / `*.test.tsx` co-located with source
- Test setup: `tools/setup-tests.ts`
- `@openmrs/esm-framework` is mocked via `@openmrs/esm-framework/mock`
- CSS modules mocked with `identity-obj-proxy`; lodash-es mapped to lodash
- Coverage threshold: 80% for statements/branches/functions/lines across `*.component.tsx` files
- `turbo` caches test runs; use `--force` to bypass cache

### E2E test structure

Page object files live in `e2e/pages/`, test specs in `e2e/specs/`. The `example.env` file documents required environment variables (`E2E_BASE_URL`, credentials, location UUID). The Playwright version in `package.json` must match the version in `e2e/support/bamboo/playwright.Dockerfile`.

### Key conventions

- Feature flags are declared in `routes.json` under `featureFlags` and accessed via `useFeatureFlag()` from `@openmrs/esm-framework`
- Config schemas use `@openmrs/esm-framework`'s `Type` enum and are defined in `src/config-schema.ts`
- Translation keys follow the pattern `t('camelCaseKey', 'Default English text')`; translation files are in `translations/`
- Layout detection uses `useLayoutType()` returning `'tablet'`, `'small-desktop'`, or `'large-desktop'`
- The package manager is **yarn** (v4); do not use npm or pnpm
