# REFACTOR-REACT-VITE.md — Stealth Frontend Refactor

> Repository: https://github.com/Nafixhutao/stealth
>
> Mission: Refactor the Stealth frontend from its current Next.js-oriented architecture into a production-grade React + Vite application, while preserving the React ecosystem that Stealth benefits from and keeping the backend cleanly separated in Go.

---

## 0. Role

Act as a **Senior Frontend Engineer, React Architect, Design Systems Engineer, Performance Engineer, and Refactoring Lead**.

You are responsible for **actually performing the refactor**, not merely suggesting changes.

You must be highly competent with:

- React
- TypeScript
- Vite
- TanStack Router
- TanStack Query
- Zod
- Tailwind CSS 4
- Motion for React
- beUI
- Lucide React
- Recharts
- accessible dashboard applications
- responsive developer-tool interfaces
- API architecture
- authentication flows
- WebSocket / SSE
- Go backend integration
- frontend performance
- React / Next.js migration

Treat Stealth as a real production cloud/developer platform.

---

# 1. Primary Objective

Refactor Stealth into this target frontend stack:

```text
React
TypeScript
Vite

TanStack Router
TanStack Query
Zod

Tailwind CSS 4
Motion
beUI
Lucide React
Recharts where useful
```

Backend:

```text
Go API
PostgreSQL
Redis
Workers / Queues
WebSocket / SSE when needed
```

Target architecture:

```text
Browser
   ↓
React + Vite
   ↓
TanStack Router
   ↓
TanStack Query
   ↓
Typed Stealth API Client
   ↓
Go Backend
   ↓
PostgreSQL / Redis / Workers / Infrastructure
```

The frontend must be:

- fast
- maintainable
- strongly typed
- responsive
- accessible
- highly interactive
- animation-friendly
- deployable as static assets where appropriate
- independent from the Next.js server runtime

Do **not** migrate to Svelte.

Preserve the advantages Stealth already gets from the React ecosystem.

---

# 2. Architectural Decision

Stealth is primarily an authenticated cloud/developer dashboard.

The frontend needs:

- projects
- deployments
- services
- service canvas
- logs
- metrics
- domains
- agents
- settings
- admin UI
- command menus
- dialogs
- drawers
- realtime status
- charts
- animation

The backend will be handled by Go.

Therefore use:

```text
React = UI
Vite = build/dev tooling
Go = backend/business logic
```

Do not keep Next.js server complexity unless an actual product requirement depends on it.

Avoid unnecessary dependence on:

```text
Next.js App Router
React Server Components
Server Actions
Next.js server runtime
Next.js caching semantics
```

---

# 3. Required Stack

## Core

```text
react
react-dom
typescript
vite
@vitejs/plugin-react
```

## Routing

```text
@tanstack/react-router
```

Optional development tooling:

```text
@tanstack/router-devtools
```

## Server State

```text
@tanstack/react-query
```

Optional development tooling:

```text
@tanstack/react-query-devtools
```

## Validation

```text
zod
```

## Styling

```text
tailwindcss
@tailwindcss/vite
```

## UI / Animation

```text
motion
lucide-react
```

Use beUI where it materially improves the interface.

## Existing Charts

Keep Recharts initially if the existing implementation works well.

Do not replace working chart code without a real benefit.

## Optional Utilities

Only where justified:

```text
clsx
tailwind-merge
class-variance-authority
```

## Testing

Recommended:

```text
vitest
@testing-library/react
@testing-library/jest-dom
@playwright/test
```

Do not install libraries merely because they appear in this document.

Inspect the actual repository first.

---

# 4. Package Manager Policy

Inspect the repository lockfile.

Determine whether Stealth currently uses:

```text
npm
pnpm
yarn
bun
```

Keep the existing package manager unless there is a strong technical reason to switch.

Never leave multiple competing lockfiles.

---

# 5. Version Policy

Use stable production releases.

Rules:

1. Prefer current stable versions.
2. Avoid alpha/beta/RC dependencies unless required.
3. Verify peer dependency compatibility before installing.
4. Do not blindly copy stale version pins.
5. Keep React, Vite, TanStack and Tailwind mutually compatible.
6. Do not upgrade unrelated dependencies without reason.

---

# 6. UI / UX Direction

The final interface should have the quality of a modern developer platform.

Primary UX inspiration:

```text
Appwrite-class console UX
```

Additional quality references:

```text
Railway
Vercel
Linear
```

Important:

## DO NOT

- copy Appwrite source code
- copy Appwrite branding
- copy logos
- copy illustrations
- copy proprietary assets
- create a pixel-for-pixel clone

## DO

- study good information architecture
- use a clean application shell
- use compact developer-tool density
- use polished tables
- use contextual drawers/dialogs
- use clear empty/error/loading states
- use original Stealth design tokens
- preserve Stealth branding

Target feeling:

```text
Appwrite-quality UX
+
Stealth identity
```

Not:

```text
Appwrite with another color
```

---

# 7. Visual Identity

Use a dark technical/infrastructure aesthetic.

Starting tokens:

```css
:root {
  --background: #09090b;
  --foreground: #fafafa;

  --surface: #111113;
  --surface-hover: #18181b;
  --surface-elevated: #16161a;

  --border: #27272a;
  --border-strong: #3f3f46;

  --muted: #71717a;
  --muted-foreground: #a1a1aa;

  --primary: #6366f1;
  --primary-hover: #818cf8;
  --primary-foreground: #ffffff;

  --success: #22c55e;
  --warning: #f59e0b;
  --danger: #ef4444;
  --info: #38bdf8;

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;

  --sidebar-width: 240px;
  --topbar-height: 56px;
}
```

These are starting values, not hard requirements.

The Stealth visual system should be:

- dark
- compact
- technical
- restrained
- readable
- consistent

Avoid:

- giant rounded cards
- excessive gradients
- glassmorphism everywhere
- excessive glow
- massive shadows
- unnecessary animation
- oversized marketing typography inside the console

---

# 8. Global CSS Strategy

Use one main global stylesheet:

```text
src/styles/global.css
```

or:

```text
src/index.css
```

Choose one convention and keep it consistent.

The file may be large if organized well.

Recommended sections:

```css
/* Tailwind */
/* Design tokens */
/* Reset */
/* Root / Body */
/* Typography */
/* Selection */
/* Scrollbars */
/* Focus */
/* Forms */
/* Global surfaces */
/* Accessibility */
/* Animations */
/* Shared utilities */
/* Third-party overrides */
```

Use Tailwind utilities inside TSX components for:

- layout
- spacing
- alignment
- responsive behavior
- component-specific presentation

Do not create dozens of random CSS files.

---

# 9. Target Project Structure

Use a feature-oriented architecture.

```text
src/
├── main.tsx
├── app.tsx
├── router.tsx
│
├── styles/
│   └── global.css
│
├── api/
│   ├── client.ts
│   ├── errors.ts
│   ├── auth.ts
│   ├── projects.ts
│   ├── services.ts
│   ├── deployments.ts
│   ├── agents.ts
│   ├── domains.ts
│   ├── logs.ts
│   └── metrics.ts
│
├── components/
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── icon-button.tsx
│   │   ├── input.tsx
│   │   ├── textarea.tsx
│   │   ├── select.tsx
│   │   ├── checkbox.tsx
│   │   ├── switch.tsx
│   │   ├── badge.tsx
│   │   ├── card.tsx
│   │   ├── alert.tsx
│   │   ├── dialog.tsx
│   │   ├── drawer.tsx
│   │   ├── dropdown.tsx
│   │   ├── tooltip.tsx
│   │   ├── tabs.tsx
│   │   ├── breadcrumb.tsx
│   │   ├── table.tsx
│   │   ├── pagination.tsx
│   │   ├── skeleton.tsx
│   │   ├── empty-state.tsx
│   │   └── error-state.tsx
│   │
│   ├── layout/
│   │   ├── app-shell.tsx
│   │   ├── sidebar.tsx
│   │   ├── topbar.tsx
│   │   ├── mobile-navigation.tsx
│   │   ├── project-switcher.tsx
│   │   ├── page-header.tsx
│   │   └── command-menu.tsx
│   │
│   └── shared/
│
├── features/
│   ├── auth/
│   ├── projects/
│   ├── services/
│   ├── deployments/
│   ├── agents/
│   ├── admin/
│   ├── metrics/
│   └── logs/
│
├── query/
│   ├── client.ts
│   └── keys.ts
│
├── routes/
├── schemas/
├── hooks/
├── types/
└── utils/
```

Do not create empty folders just to match this document.

---

# 10. Vite Setup

Use Vite as the build system.

Example direction:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ]
});
```

Add path aliases only when useful.

Example:

```ts
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src')
  }
}
```

Keep `vite.config.ts` small and predictable.

---

# 11. TanStack Router

Replace Next.js routing with TanStack Router.

Preserve existing user-facing URLs wherever practical.

Example mapping:

```text
Next.js
src/app/projects/[projectId]/page.tsx
```

becomes conceptually:

```text
TanStack Router
/projects/$projectId
```

Expected routes include:

```text
/
/login
/forgot-password
/projects
/projects/$projectId
/projects/$projectId/services
/projects/$projectId/deployments
/projects/$projectId/domains
/projects/$projectId/settings
/agent
/agent/$agentId
/admin
```

Use type-safe route params and search params.

Do not move every API request into route loaders.

---

# 12. TanStack Query

TanStack Query owns **remote/server state**.

Use it for:

```text
projects
services
deployments
agents
domains
logs
metrics
account data
mutations
```

Do NOT use TanStack Query for:

```text
sidebar open
modal open
active tab
temporary input state
dropdown state
local selection
```

Correct separation:

```text
Remote state → TanStack Query
Local UI state → React
Validation → Zod
Routing → TanStack Router
```

---

# 13. Query Keys

Create stable query keys.

Example:

```ts
export const queryKeys = {
  projects: {
    all: ['projects'] as const,
    detail: (projectId: string) =>
      ['projects', projectId] as const
  },

  deployments: {
    all: (projectId: string) =>
      ['deployments', projectId] as const,

    detail: (projectId: string, deploymentId: string) =>
      ['deployments', projectId, deploymentId] as const
  }
};
```

Invalidate only relevant queries after mutations.

Avoid broad cache invalidation without reason.

---

# 14. Query Defaults

Configure sensible defaults.

Example direction:

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});
```

Tune by domain.

Examples:

```text
Projects → longer stale time
Deployment status → shorter stale time
Logs → streaming or event-driven
Metrics → interval/realtime according to backend support
```

Do not aggressively poll everything.

---

# 15. Central API Client

Create one central request layer.

Example:

```ts
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
  }
}
```

```ts
export async function api<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}${path}`,
    {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers
      }
    }
  );

  if (!response.ok) {
    let body: unknown;

    try {
      body = await response.json();
    } catch {
      body = null;
    }

    throw new ApiError(
      'Request failed',
      response.status,
      body
    );
  }

  return response.json() as Promise<T>;
}
```

Do not scatter raw backend URLs throughout components.

Group endpoints by domain.

---

# 16. Go Backend Boundary

The Go backend owns:

- authentication enforcement
- authorization
- business logic
- database access
- project operations
- deployments
- infrastructure orchestration
- workers
- queues
- secrets
- billing if introduced
- persistent event processing
- WebSocket / SSE endpoints

React must not duplicate backend business rules.

---

# 17. Zod

Use Zod at runtime boundaries.

Example:

```ts
import { z } from 'zod';

export const projectSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  status: z.enum([
    'active',
    'inactive',
    'error'
  ])
});

export type Project = z.infer<typeof projectSchema>;
```

Use Zod for:

- forms
- mutation payloads
- critical API responses
- external/untrusted data
- configuration where appropriate

Do not rely on frontend validation for security.

---

# 18. Authentication

Prefer secure cookie/session architecture.

Avoid long-lived authentication architecture based on:

```text
localStorage tokens
```

when HTTP-only cookie sessions are possible.

Frontend must correctly handle:

- session initialization
- logged-out state
- logged-in state
- 401
- 403
- logout
- session expiration
- protected routes
- redirect-back behavior

Authorization must always be enforced by Go.

---

# 19. Motion

Motion remains a first-class dependency.

Use React APIs where appropriate:

```ts
import { motion, AnimatePresence } from 'motion/react';
```

Use Motion for:

- dialogs
- drawers
- contextual panels
- toast transitions
- expandable surfaces
- layout animations
- shared layout transitions
- polished beUI interactions

Do not animate everything.

Animations should improve understanding and perceived responsiveness.

Typical duration for operational UI:

```text
120ms–250ms
```

Respect reduced-motion preferences.

---

# 20. beUI

beUI is allowed and encouraged where it provides real value.

Rules:

1. Adapt beUI components to Stealth design tokens.
2. Do not allow beUI to create inconsistent styling.
3. Do not paste unused components.
4. Review accessibility after integration.
5. Normalize copied source code to Stealth conventions.
6. Avoid animation gimmicks on data-heavy operational pages.

Good use cases:

```text
command palette
morphing dialog
animated overlays
context panels
tabs
toast
bottom sheet on mobile
```

---

# 21. React State Rules

Keep state local by default.

Use:

```text
useState
useReducer
context
```

when appropriate.

Do not introduce a global state library merely because the app is large.

TanStack Query already handles remote state.

Potential global frontend state may include:

```text
current workspace
current project context
theme
command palette state
```

Even these should be evaluated first.

---

# 22. React Compiler

If the selected React/Vite setup supports React Compiler cleanly, evaluate it after the application is stable.

Do not introduce compiler complexity at the beginning of the migration.

Do not manually add:

```text
memo
useMemo
useCallback
```

everywhere without profiling.

Optimize measured problems.

---

# 23. Performance Rules

## Route Code Splitting

Lazy-load heavy routes.

Examples:

```text
Metrics
Admin
Agents
Service Canvas
```

## Lazy-load Heavy Libraries

Examples:

```text
charts
large editors
canvas libraries
large animation-only modules
```

## Keep Initial Bundle Small

The first dashboard route should not download the entire application.

## Keep State Near Consumers

Avoid putting all page state at the application root.

## Use Server Pagination

Do not render enormous database result sets in one DOM tree.

## Virtualize When Needed

Use virtualization for:

```text
large logs
large tables
large event streams
```

only when profiling shows it is useful.

---

# 24. Realtime Architecture

Stealth should be prepared for realtime updates such as:

```text
deployment status
build logs
service health
agent status
metrics
events
```

Prefer:

```text
WebSocket
or
Server-Sent Events
```

when the backend supports them.

Do not poll every second by default if an event stream exists.

TanStack Query can be updated from realtime events.

Example:

```text
WebSocket event
      ↓
queryClient.setQueryData(...)
      ↓
React UI updates
```

---

# 25. Logs

Treat logs as performance-sensitive.

Requirements:

- bounded DOM size
- virtualization if needed
- pause/resume autoscroll
- copy line
- search/filter
- timestamps
- severity
- monospace typography
- responsive behavior

Do not keep an unlimited log history in React state forever.

---

# 26. Charts

Keep Recharts initially if it already works.

For chart-heavy routes:

- lazy-load chart modules
- prevent unnecessary rerenders
- bound metric arrays
- downsample large datasets where appropriate
- avoid rendering thousands of SVG elements unnecessarily

Charts require:

- loading state
- empty state
- error state
- tooltip
- responsive sizing
- clear units
- readable timestamps

---

# 27. Application Shell

Create reusable layout components:

```text
AppShell
Sidebar
Topbar
MobileNavigation
ProjectSwitcher
PageHeader
CommandMenu
```

Do not duplicate shell markup across pages.

Desktop direction:

```text
┌─────────────────────────────────────────────────────────────┐
│ STEALTH      Project / Workspace           Search   User   │
├───────────────┬─────────────────────────────────────────────┤
│ Overview      │ Breadcrumb                                  │
│ Projects      │ Page title                   Page actions   │
│               │ Description                                 │
│ Services      │ ─────────────────────────────────────────── │
│ Deployments   │                                             │
│ Databases     │ Main content                                │
│ Storage       │                                             │
│ Domains       │                                             │
│ Agents        │                                             │
│               │                                             │
│ Settings      │                                             │
└───────────────┴─────────────────────────────────────────────┘
```

---

# 28. Responsive Design

Support:

```text
mobile
tablet
laptop
desktop
large desktop
```

Desktop:

```text
persistent sidebar
```

Mobile:

```text
compact topbar
navigation drawer
```

Tables must remain usable.

Possible strategies:

- local horizontal scrolling
- prioritize important columns
- hide secondary columns
- use condensed mobile rows where appropriate

Do not simply shrink the desktop UI.

---

# 29. Data-Dense UI

Prefer tables for:

```text
deployments
domains
environment variables
members
agents
events
```

Use cards for:

```text
overview summaries
metric summaries
project/service summaries
empty states
```

Do not make every record a card.

---

# 30. Service Canvas

Treat the service canvas as a high-risk migration area.

Before changing it, inspect:

1. service data model
2. coordinate/layout state
3. dragging
4. selection
5. detail panel behavior
6. deployment interactions
7. service relationships
8. dialogs
9. localStorage/mock dependencies
10. animation behavior

Potential decomposition:

```text
features/services/
├── service-overview.tsx
├── service-canvas.tsx
├── service-node.tsx
├── service-edge.tsx
├── service-detail-panel.tsx
├── service-actions.tsx
├── service-logs.tsx
├── service-state.ts
└── service-types.ts
```

Do not build one giant component.

---

# 31. Forms

Forms require:

- visible labels
- correct input types
- Zod validation
- field errors
- submission error handling
- pending state
- disabled state
- success feedback
- keyboard accessibility

Example:

```text
Create Project
↓
Creating...
↓
Project created
```

Do not use browser alerts as the primary UX.

---

# 32. Loading / Empty / Error States

Every async page or section must handle all three.

## Loading

Use:

- skeletons
- local pending indicators
- pending button state

## Empty

Bad:

```text
No data
```

Good:

```text
No deployments yet

Deploy this project to create your first deployment.

[Deploy project]
```

## Error

Show:

- understandable message
- retry action
- useful context

Never expose backend stack traces.

---

# 33. HTTP Error Handling

Handle at least:

```text
400
401
403
404
409
422
429
500+
```

Examples:

```text
401
→ Your session has expired.

403
→ You do not have permission to perform this action.

409
→ This resource already exists.

429
→ Too many requests. Try again shortly.
```

Create centralized error translation where useful.

---

# 34. Accessibility

Required:

- semantic HTML
- keyboard navigation
- visible focus indicators
- correct buttons/links
- form labels
- accessible dialogs
- accessible drawers
- sufficient contrast
- reduced-motion support
- statuses not communicated only by color

Do not remove focus outlines without a proper replacement.

---

# 35. Security

Never:

- trust client validation
- expose secrets through `VITE_*`
- put backend secrets in frontend env files
- leak stack traces
- use hidden UI as authorization
- commit tokens
- render unsanitized untrusted HTML

Remember:

```text
VITE_* values are client-visible.
```

The Go backend owns authorization.

---

# 36. Environment Variables

Frontend-safe example:

```text
VITE_API_URL
```

Only place values there that are safe to expose in the browser.

Secrets belong to Go/backend infrastructure.

---

# 37. Next.js → Vite Migration Strategy

Do not rewrite everything in one commit.

## Phase 0 — Audit

Inspect:

- package.json
- lockfile
- current Next.js routes
- React components
- Next-specific imports
- global CSS
- Tailwind
- Motion
- Recharts
- localStorage
- mocks
- auth
- API calls
- service canvas
- admin pages

Create a migration map.

---

## Phase 1 — Vite Foundation

Create and validate:

- Vite configuration
- React entry point
- TypeScript configuration
- Tailwind CSS 4
- global CSS
- aliases
- test configuration

Do not migrate features until the base builds successfully.

---

## Phase 2 — TanStack Router

Replace:

```text
next/link
next/navigation
Next.js layouts
App Router route files
```

with TanStack Router equivalents.

Preserve URLs wherever practical.

---

## Phase 3 — App Shell

Migrate:

- sidebar
- topbar
- project switcher
- page header
- command menu
- mobile navigation

---

## Phase 4 — Authentication

Migrate:

- login
- forgot password
- session initialization
- route protection
- logout

---

## Phase 5 — Projects

Migrate:

- project list
- search
- filters
- sorting
- create/update/delete
- project details

---

## Phase 6 — Services

Migrate carefully:

- service overview
- service canvas
- details
- dialogs
- service actions
- animations

---

## Phase 7 — Deployments

Migrate:

- deployment list
- detail
- status
- actions
- logs

---

## Phase 8 — Agents

Migrate:

- agent list
- agent detail
- workspace

---

## Phase 9 — Admin

Migrate admin functionality.

Do not accidentally ship mock telemetry as real production data.

---

## Phase 10 — TanStack Query Integration

Replace scattered server-state logic with typed queries and mutations.

---

## Phase 11 — Go API Integration

Replace temporary sources such as:

```text
mock data
localStorage persistence
fake async timers
simulated deployment lifecycle
fake telemetry
```

with real API calls when endpoints exist.

If an endpoint does not exist, isolate the mock behind a clear typed adapter.

---

## Phase 12 — Remove Next.js

Only after the React + Vite application works.

Remove:

```text
next
next.config.*
Next-specific route files
Next-specific imports
Next-specific types/config
```

Do **not** remove React.

---

## Phase 13 — Cleanup

Remove:

- dead code
- obsolete routes
- duplicate styles
- stale mocks
- unused dependencies
- temporary compatibility code

---

# 38. Next.js Import Audit

Audit imports such as:

```ts
import Link from 'next/link';
import { useRouter } from 'next/navigation';
```

Replace them with TanStack Router APIs.

Avoid creating unnecessary compatibility wrappers that imitate Next.js.

---

# 39. Preserve Existing React Work

Because the application stays on React, preserve working code whenever sensible.

Prefer retaining:

- `.tsx` components
- Motion animations
- Tailwind classes
- beUI-compatible components
- Recharts
- Lucide React
- existing types
- utility functions
- business-neutral feature components

This migration should be significantly cheaper and safer than React → Svelte.

---

# 40. beUI Integration Policy

Do not refactor every component merely to force beUI usage.

Use beUI strategically for high-value interactions.

Priority candidates:

```text
command palette
animated dialogs
context overlays
advanced panels
toasts
bottom sheets
high-value transitions
```

Operational tables/forms should remain restrained and highly usable.

---

# 41. Testing

At minimum test critical flows:

```text
Login
Logout
Project listing
Project navigation
Create project
Service navigation
Deployment listing
Deployment action
Agent navigation
Protected routes
```

Use unit tests for:

```text
pure utilities
Zod schemas
formatters
query helpers
```

Use component tests for:

```text
critical forms
dialogs
navigation
```

Use Playwright for critical end-to-end journeys.

---

# 42. Validation Commands

After meaningful migration steps, run repository equivalents of:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

If Playwright exists:

```bash
npm run test:e2e
```

Do not continue on top of a knowingly broken build.

Fix:

- TypeScript errors
- broken routes
- accessibility failures
- lint issues
- dependency conflicts
- production build failures

---

# 43. Performance Validation

Measure instead of assuming.

Track:

- production JS size
- initial route bundle
- route chunks
- API request count
- duplicate requests
- render performance
- long tasks
- chart cost
- service canvas performance
- memory usage during long dashboard sessions

Do not claim the refactor is faster without measurements.

---

# 44. React Performance Rules

Do not prematurely optimize.

Avoid blindly adding:

```text
memo everywhere
useMemo everywhere
useCallback everywhere
```

First profile.

Optimize when:

- expensive child trees rerender unnecessarily
- expensive calculations rerun
- huge lists update
- charts become costly
- service canvas rerenders excessively

Prefer correct state placement before memoization.

---

# 45. Git Discipline

Prefer incremental, reviewable commits.

Example:

```text
chore: initialize vite frontend
refactor: migrate routing to tanstack router
feat: add stealth application shell
feat: migrate projects to tanstack query
refactor: migrate service navigation
feat: connect deployment api
chore: remove nextjs runtime
```

Do not rewrite unrelated repository history.

---

# 46. Definition of Done

The refactor is complete when:

- Vite production build passes
- Next.js is removed
- React remains the frontend runtime
- existing important routes work
- URLs are preserved where reasonable
- TypeScript checks pass
- TanStack Router owns navigation
- TanStack Query owns remote state
- Zod validates appropriate runtime boundaries
- Motion animations work
- beUI remains usable
- Recharts remains usable where needed
- UI is consistent
- global CSS/design tokens are organized
- responsive behavior works
- accessibility is acceptable
- API access is centralized
- Go backend integration is clean
- mocks are removed or clearly isolated
- no critical fake localStorage backend remains hidden
- loading/empty/error states are complete
- heavy routes are code split
- bundle size is reviewed
- critical user flows are tested

---

# 47. Final Target Stack

```text
STEALTH FRONTEND

React
TypeScript
Vite

TanStack Router
TanStack Query
Zod

Tailwind CSS 4
Motion
beUI
Lucide React
Recharts where appropriate

        ↓

Stealth Go API

        ↓

PostgreSQL
Redis
Workers
Queues
WebSocket / SSE
```

---

# 48. Final Instruction to the Coding Agent

Start by auditing the actual repository.

Do not immediately delete Next.js.

Do not rewrite every React component.

First identify:

```text
WHAT IS GENERIC REACT
WHAT IS NEXT-SPECIFIC
WHAT IS MOCKED
WHAT IS API-READY
WHAT MUST BE PRESERVED
```

Then execute this workflow:

```text
INSPECT
   ↓
MAP
   ↓
PREPARE VITE
   ↓
MIGRATE ROUTER
   ↓
PRESERVE REACT UI
   ↓
CENTRALIZE API
   ↓
ADD TANSTACK QUERY
   ↓
CONNECT GO
   ↓
VERIFY
   ↓
REMOVE NEXT
   ↓
OPTIMIZE
```

The finished application must feel like a serious modern cloud/developer platform console.

Preserve the React ecosystem advantages that matter to Stealth:

```text
TSX
Motion
beUI
Recharts
React component ecosystem
```

while removing unnecessary Next.js runtime complexity and gaining a simpler, high-performance Vite-based frontend architecture.
