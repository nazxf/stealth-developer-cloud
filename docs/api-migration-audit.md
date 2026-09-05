# Stealth Console — API Migration Audit

The active architecture is:

```
Stealth Console (React + Vite)
        ↓
Stealth JavaScript SDK / API client
        ↓
Stealth API
        ↓
Stealth backend
```

The Vite browser must **not** use `localStorage` as the source of truth
for projects, deployments, agents, usage, or any other product data. This
document retains the historical inventory from the Next migration; the files
listed as legacy are no longer imported by the Vite application. Active
screens use `src/lib/browser-api.ts`, runtime Zod schemas, and TanStack Query.

Legend: **[LS]** = localStorage is the authoritative datastore, **[H]** =
hardcoded constant data, **[M]** = generated/simulated mock data, **[S]** =
simulated async behavior (timers standing in for network calls).

---

## Projects & deployments

### Connected project list/create — migrated
- `/` now validates the HttpOnly API session in the browser through the Go API,
  lists organizations and organization-scoped projects, and creates projects
  through the central browser client. This path does not use seed projects,
  timers, or localStorage authority.

### `src/features/projects/project-store.ts` — [LS][H] (legacy deployment UI only)
- Storage key: `"projects-list-v1"`.
- Authoritative datastore for the project list. Creating a project via the
  "New project" dialog writes here; the Projects page reads it and merges it
  with the hardcoded seed list from `data.ts`.
- Migration: project CRUD → Stealth API (`projects` resource). Seeded entries
  become real projects owned by the authenticated account.

### `src/features/projects/data.ts` — [H]
- Hardcoded seed project (`app_ig`) and hardcoded `usageRows` (egress,
  database size, MAU, file storage) shown in the project usage panel.
- Migration: projects from the API; usage metrics from the usage/billing
  endpoints.

### Connected project shell and resource routes — migrated in Vite
- `/projects/[projectId]` and its resource routes authenticate and resolve the
  project through the API. The project identity, organization ID, and access
  boundary are real. Project Auth identity management and owner/admin-only
  registration settings are connected to the API: members can list users,
  while owners/admins create users, block/unblock status, and toggle public
  registration. The list/settings responses return safe `can_manage`
  capabilities and never expose password hashes. Project API-key management is
  also connected: owner/admin Console members can create and revoke scoped
  server-to-server keys, while members can inspect safe metadata. Secrets are
  shown once and stored only as SHA-256 hashes. Database core is now connected:
  Console members can inspect databases, tables, typed columns, real indexes,
  and permission-filtered rows; owner/admin members can mutate the schema and
  rows. Server keys use independent `databases.read` and `databases.write`
  scopes, and the dependency-free server SDK exposes the same operations.
  Storage is connected with bucket/file controls and streamed local artifacts.
  The Vite Functions control plane and isolated worker are connected for
  configuration, encrypted write-only variables, versioned source uploads,
  immutable asynchronous builds with deployment-scoped variable snapshots,
  atomic activation, asynchronous execution, bounded results, and redacted
  logs; the Functions Deployments and Executions tabs now read bounded,
  secret-redacted build and execution log streams from the worker. The Vite
  Sites control plane is now connected for pre-built static archive and public
  Git source deployments, bounded safe extraction, isolated builds, immutable
  deployments, atomic activation, quota accounting, per-deployment redacted
  build logs, and public serving of only the active publication. Webhooks are
  now connected end to end: signed transactional outbox events, leased delivery
  retries,
  project-scoped API/Console controls, and the Webhooks Console page. Realtime
  is now available as a permission-filtered, cursor-aware SSE stream backed by
  the same seven-day event outbox. Relationships, transactions, backups,
  full-text, bulk/import/export, and message delivery actions remain explicitly
  disabled until their backend modules exist. Messaging provider/topic/subscriber
  configuration is now connected end to end, while the trusted sending worker
  remains a separate milestone. Project Settings now updates the
  project slug through an owner/admin API mutation and exposes stable project
  and organization identifiers. Destructive project deletion is available
  through the owner-only API; billing remains out of scope.
  Organization identity settings (name and slug) now use
  the owner/admin organization API, while Console account session
  listing/revocation and current-password-verified password changes are
  available from the authenticated account API and Admin Settings without
  exposing bearer tokens; password changes revoke other sessions. Organization membership
  management now supports adding existing Console accounts, role changes, and
  non-owner removal with owner/admin policy checks. Organization and project
  audit Logs now read durable events; request/trace telemetry remains separate.
  Usage now reads live resource aggregates and rolling API/Function counters from
  PostgreSQL; the daily metering API records request egress and Function compute
  time durably. Invoice calculation and plan enforcement remain future work.

### Deployment overview — migrated
- `/projects/[projectId]/deployments` now aggregates the real Site and Function
  deployment endpoints into one project-scoped timeline. Resource cards link
  back to the existing upload, Git, build, and activation controls.
- Owners and admins can start a public Git deployment from the same timeline;
  the form creates a static Site when needed, then submits the repository,
  ref, runtime, build command, output directory, and activation preference to
  the existing Site API.
- The page refreshes and polls only while a deployment is queued or building;
  it never fabricates progress, versions, or worker output in the browser.
- The browser API client exposes typed `projectSiteDeployments` and
  `projectFunctionDeployments` list methods and keeps the same project-scoped
  authorization boundary as the resource pages.
- Site deployment rows open a live, sequence-cursor build-log viewer backed by
  `GET /v1/projects/{projectID}/sites/{siteID}/deployments/{deploymentID}/logs`;
  the worker emits only bounded lifecycle messages and failures are redacted.

### Project Logs — migrated
- `/projects/{projectID}/logs` loads project-scoped audit events through
  `GET /v1/projects/{projectID}/audit-events`. Project mutations and resource
  operations stamp the project ID into their audit metadata so events from
  another project cannot appear in this view.
- The page supports cursor pagination, action/service/level filters, and
  detail inspection of the stored actor, target, timestamp, and metadata. It
  also reads the bounded root-request index through
  `GET /v1/projects/{projectID}/traces`, with cursor pagination and status,
  route, duration, egress, timestamp, and trace ID metadata. Nested spans and
  full attributes remain private telemetry; no synthetic live-tail entries are
  generated.

### Project Settings — migrated identity slice
- `/projects/{projectID}/settings` loads the project through the authenticated
  API and lets owners/admins rename its lowercase slug with
  `PATCH /v1/projects/{projectID}`. The mutation is transactional, enforces
  organization uniqueness, is idempotent, and emits a durable `project.update`
  audit/webhook event with the old and new name.
- The page displays the immutable project ID, organization ID, and creation
  date. The danger zone enables owner-only deletion after exact project-name
  confirmation; billing still requires a separate API.
  Organization invitations live in Admin
  Users rather than project settings.

### Services workspace — migrated in Vite
- `/projects/{projectID}/services` fans out to the authenticated Function, Site,
  Database, and Storage bucket APIs and renders a live service inventory plus an
  interactive canvas with selection, resource links, pointer dragging, and
  keyboard arrow movement.
- Canvas positions are stored by the Go API in the project-scoped
  `project_service_layouts` projection (`GET/PUT /v1/projects/{projectID}/service-layout`).
  The repository validates every polymorphic resource ID against the current
  project and atomically replaces the layout; stale rows for deleted resources
  are hidden from reads. Only project owners/admins may save positions, while
  all project members can inspect the canvas. No service data or coordinates are
  authoritative in localStorage.

### `src/features/projects/pre-deploy/` — [S][LS]
- `pre-deploy-model.ts` + `pre-deploy-flow.tsx`: simulated source/connect
  steps; deployment config and progress are persisted by
  `use-service-overview.ts` under the per-project workflow storage key so the
  flow survives reloads.
- Migration: real deploy creation from a git source; workflow state server-side.

### `src/features/projects/projects-page.tsx` — [LS][H] (legacy deployment UI only)
- Reads the localStorage project list and merges it with `data.ts` seeds;
  project deletion mutates the localStorage store.
- Migration: list/delete via API.

### Project overview and usage panel — migrated
- `/projects/{projectID}` loads the project identity and live aggregate usage
  in parallel from `GET /v1/projects/{projectID}` and
  `GET /v1/projects/{projectID}/usage`.
- The Vite project overview renders application users, database count, storage
  files, Functions, and Sites from the PostgreSQL snapshot; it has no hardcoded
  `usageRows` or local project store.
- The dedicated `/projects/{projectID}/usage` route is now the Vite
  `usage-route` and reads the durable `/usage/metering` endpoint with TanStack
  Query. It renders live resource totals, a daily request chart, a bounded
  table, and the authenticated CSV export. Invoice calculation remains future
  work.

## Agents

### Agent configuration control plane — migrated
- PostgreSQL migration `000021_agents` stores project-scoped agent
  configuration, role, branch, provider/model labels, tool grants, and
  instructions. Provider credentials and run output are intentionally separate
  resources and are not accepted by this endpoint.
- `GET/POST /v1/agents` and `GET/PATCH/DELETE /v1/agents/{agentID}` enforce
  Console session authentication, project membership isolation, and owner/admin
  writes. Mutations emit audit and transactional webhook events.
- `/agent` loads the roster and project selector from the API. Create/delete
  mutations use the central browser client; the workspace Settings tab
  persists mutable fields through PATCH.

### Agent run queue — migrated for durable state
- Migration `000022_agent_runs` stores prompts, queue/worker lifecycle, bounded
  output, worker-produced steps/changes, and sequence-numbered logs. Composite
  tenant/agent foreign keys and membership checks prevent cross-project reads.
- `GET/POST /v1/agents/{agentID}/runs`, `GET /.../{runID}`, cancellation, and
  log polling are session-authenticated. Owners/admins may enqueue or cancel;
  members may read. Repository worker primitives provide atomic claim,
  worker fencing, terminal transitions, log append, and stale-run requeue.
- The workspace now renders only API-backed runs and polls queued/running state;
  no localStorage seed, timer playback, or fabricated file changes remain.

### Agent workspace — migrated
- Fetches an API-authorized agent and its latest run page with TanStack Query.
  Settings writes and new prompts use the central browser client.
- Provider connections and the trusted execution worker remain a separate
  milestone; until then, accepted prompts honestly remain `queued`.

### Agent provider catalog — intentionally bounded
- Project options now come from the authenticated organization/project API and
  no longer include hardcoded project names.
- Provider/model options remain a UI catalog placeholder until provider
  connections and model capabilities have a durable API contract.

### Agent roster — migrated
- The overview list is initialized from `GET /v1/agents`; it does not read or
  write the `stealth-agents-v1` localStorage key. Summary values are derived
  from returned records rather than hardcoded counts.

## Auth

### Login, signup, and recovery — migrated
- Login and signup call the browser API client and receive only HttpOnly
  session cookies. Forgot-password, verification, and reset pages use the
  API's one-time token endpoints. The Vite shell gates every non-auth route on
  the current Console session and redirects a 401 to sign-in before rendering
  protected data.

### Project application Auth boundary — connected core
- Project identity management and the owner/admin registration setting are
  real Console/API resources. Public project registration, email/password
  sessions, current-account, and logout are separate API routes backed by
  hashed project session tokens; they never use the Console session cookie.
- `packages/sdk-js` provides a dependency-free typed browser client. The
  registration, email/password session, current-account, logout, verification,
  password recovery, and public Site URL lifecycle is complete for the current
  API contract. It requires a same-origin endpoint or same-origin reverse
  proxy. Project-scoped credentialed CORS origin allowlists are now connected;
  one-time email verification and password recovery are backed by PostgreSQL
  token hashes and the pluggable mailer. Custom Site
  domain ownership and Host-based serving are managed by the Sites Console
  panel or the server SDK.

### Project API keys — connected server-to-server slice
- PostgreSQL migration `000004_project_api_keys` stores only a SHA-256 secret
  digest, canonical supported scopes, optional bounded expiry, revocation, and
  usage timestamps.
- `/projects/[projectId]/api-keys` is backed by the project API-key management
  endpoints. It lists safe metadata, creates one-time `stl_key_...` secrets,
  and revokes keys with owner/admin permission checks; viewers remain
  read-only. Keys authorize the project Auth, Database, Storage, Functions, and
  Sites operations through `X-Stealth-Key`; each module has independent
  read/write scopes, including `sites.read` for deployment build logs.
- `packages/sdk-js/server.ts` is a separate dependency-free server-oriented
  client. It never persists or logs a key and must not be bundled into browser
  code. It now exposes the database/table/column/index/row methods with
  independent Database, Storage, Functions, and Sites read/write
  authorization, including cursor-based Function and Site build-log reads.
  Advanced database features and other modules remain unavailable.

## Admin (Vite route tree)

The admin area now requires an authenticated Console session. The Overview
health strip queries the API's liveness/readiness probes directly; raw
Prometheus metrics remain private to the observability network. Workspace
usage, agent runs, members, invitations, audit events, organization incidents,
account sessions, organization settings, and the bounded root-request trace
index are query-backed by the Vite route tree.

### `src/features/admin/data/admin-mock-data.ts` — [M][H]
- Seeded-PRNG generators (mulberry32) remain only for preview telemetry series,
  hosts, providers, and model usage.
- Repository names (`stealth-console`, `stealth-docs-site`,
  `stealth-admin-ui`) and `@stealth.dev` user emails are mock values.
- Migration: replace with admin/observability endpoints.

### `src/features/admin/hooks/use-live-updates.ts` — [M]
- Simulated "live" value drift on an interval for preview-only aggregate
  charts/workers. Migration: realtime feed (SSE/WebSocket) from the API.

### Authenticated health probe — migrated
- `/admin` polls `/healthz` and `/readyz` every 15 seconds with the same
  HttpOnly session boundary. It never proxies `/metrics` or leaks raw
  Prometheus labels to the browser.

### Admin Overview workspace aggregates — migrated
- `/admin` loads the authenticated account's organizations and projects on the
  server, then aggregates the existing `GET /v1/projects/{projectID}/usage`
  snapshots. Application users, database rows/tables, storage, Functions,
  Sites, Realtime events, and webhook deliveries therefore reflect the current
  workspace rather than generated constants.
- Projects whose usage snapshot cannot be read are counted in the coverage
  tile instead of contributing guessed zeroes. The Recent Agent Runs card
  loads each visible agent's durable run page through the same authenticated
  API contract used by `/admin/runs`; failed agent reads are reported as
  unavailable rather than replaced with generated runs. The resource section
  now shows current durable usage/quota aggregates; historical CPU and memory
  time series remain unavailable until their query contracts exist. The project
  metering API provides daily API egress and Function compute buckets. Recent
  incidents are loaded from the organization incident API.

### Admin Agent Runs — migrated
- `/admin/runs` loads the authenticated workspace's agents and their durable
  run pages through `GET /v1/agents` and `GET /v1/agents/{agentID}/runs`.
- Filters and detail drawers now use persisted status, prompt, timestamps,
  worker steps, output, errors, and file changes. Unknown token/cost,
  repository, and trace fields are not invented; they remain unavailable until
  provider billing and telemetry query contracts are added.
- If one agent's run list fails, the page shows the records that were read and
  reports the unavailable-agent count instead of substituting fixtures.

### Admin Usage — migrated
- `/admin/usage` shares the API-backed workspace usage loader with Overview,
  so its users, database, storage, Functions, Sites, and webhook totals come
  from the same PostgreSQL-backed project usage snapshots.
- Capacity bars use the durable artifact/file quota fields. Token spend,
  sandbox compute breakdowns, and historical charts are not yet rendered in
  this page; the API metering endpoint remains available for exact daily
  request/egress and Function compute data.

### Admin Status Page — migrated
- `/admin/status` uses the authenticated API health/readiness endpoints and
  clearly reports probe failures.
- Synthetic uptime history is not persisted by the current backend, so the
  page does not manufacture 45-day percentages. Incident records are managed
  separately through the durable organization incident API below.

### Admin Infrastructure — migrated runtime slice
- `/admin/infrastructure` now consumes the same authenticated liveness and
  readiness probes instead of rendering generated host, CPU, memory, storage,
  or worker-heartbeat values.
- The page labels Prometheus/OpenTelemetry as private deployment dependencies
  and explicitly marks host inventory, historical resource charts, and uptime
  history unavailable until durable query contracts are added. Legacy mock-only
  child components remain unmounted.

### Admin Users — migrated
- `/admin/users` loads the authenticated account's organizations and each
  organization's paginated membership list through
  `GET /v1/organizations/{organizationID}/memberships`.
- Membership responses include the account email, role, organization, member
  timestamp, and a `can_manage` capability. The page keeps the cross-org
  directory but also lets owners/admins add an existing Console account,
  invite a teammate by email, change regular-member roles, or remove non-owner
  memberships through the corresponding authenticated mutation endpoints.
  Invitation tokens are stored only as SHA-256 hashes, expire after the
  verification TTL, bind to the recipient email, and are consumed atomically;
  owner memberships remain protected and ownership transfer is separate.
- Partial reads and pagination safety limits are reported in the UI instead of
  being replaced with fixture members.

### Admin Logs — migrated
- `/admin/logs` loads the authenticated workspace's durable audit events from
  `GET /v1/organizations/{organizationID}/audit-events`, merges streams across
  visible organizations, and supports action/service/level filtering.
- Event details preserve the stored actor, target, timestamp, and JSON
  metadata. Synthetic live-tail entries, request IDs, and trace IDs are not
  fabricated; those require a separate telemetry query contract.

### Admin Settings — migrated account and organization identity slice
- `/admin/settings` loads the authenticated account and its organizations from
  the Console API. Account email, account ID, and verification state are
  displayed from server data; unverified accounts can request a new one-time
  verification email through `POST /v1/account/verification`.
- Owners and admins can rename an organization and change its lowercase slug
  through `PATCH /v1/organizations/{organizationID}`. The mutation is
  transactional, enforces membership policy and slug uniqueness, is
  idempotent, and emits a durable `organization.update` audit event.
- Deployment variables are intentionally read-only reference labels. Browser
  state never claims to change server runtime configuration; production values
  remain managed by the deployment environment and manifests.

### Admin Incidents — migrated
- `/admin/incidents` loads incidents for every organization visible to the
  authenticated account through `GET /v1/organizations/{organizationID}/incidents`.
- Owners and admins can create incidents and update metadata/status through the
  authenticated browser API. Each mutation is transactional, appends a timeline
  update, sets or clears `resolved_at` consistently, and emits a durable
  `organization.incident.*` audit event. Other organization members retain
  read-only access.
- Partial organization reads are reported in the page. The board no longer
  synthesizes IDs, timestamps, durations, or timeline entries in the browser.

### Admin Workers — migrated queue slice
- `/admin/workers` now reads the same durable Agent Run records as
  `/admin/runs`, exposing queued, running, and terminal work without inventing
  a worker fleet, CPU values, or heartbeat timestamps.
- Provider calls, tool execution, sandbox lifecycle, and host telemetry remain
  trusted-worker concerns. The page labels those deployment boundaries rather
  than presenting generated workers.

### Admin Errors — migrated Function failure slice
- `/admin/errors` walks the authenticated workspace's organizations, projects,
  Functions, and durable execution pages, then groups only executions whose
  persisted status is `failed`. Exact error messages, function/project
  identity, triggers, response status, and timestamps remain attached to each
  occurrence; no users, traces, stack frames, resolution state, or synthetic
  rates are inferred.
- Partial reads are reported with their organization/project/Function counts.
  The page links back to the project Functions surface for remediation and
  retains the API's tenant and membership boundaries.

### Admin Traces — migrated root-request index
- `/admin/traces` loads `GET /v1/organizations/{organizationID}/traces` for
  every visible organization and merges the tenant-scoped rows into the
  Console table. Pagination safety limits and partial organization reads are
  shown explicitly.
- The page derives latency percentiles and error rate from persisted request
  rows, and the detail drawer exposes the HTTP status, response size, scope,
  and root-span waterfall. Nested spans and full attributes remain in the
  private OpenTelemetry/Tempo backend; the UI does not invent them.

### Other admin pages — migrated
- Usage, Users, Runs, Workers, Incidents, Traces, and Settings render durable
  API data with explicit loading, empty, and error states. Provider-specific
  metrics remain intentionally out of scope until their backend contract exists.

### Platform observability — connected foundation
- API and Functions worker expose bounded Prometheus metrics and emit optional
  OpenTelemetry server/consumer spans with W3C trace propagation. The
  `observability` Compose profile provisions Prometheus, Grafana, Loki, Tempo,
  and Grafana Alloy log shipping with a preloaded overview dashboard.
- Migration: replace the remaining admin mock pages with authenticated
  query-backed views over the remaining metrics, logs, and provider data; add retention and
  alert-management APIs before exposing them to tenant operators.

## Navigation chrome

### Vite application shell — migrated
- The shared Vite shell fetches the authenticated Console account, renders the
  project navigation rail, and logs out through the HttpOnly session. No fake
  plan-loading timer or avatar data is shipped.
- Provider/billing plan data is intentionally not displayed until a durable
  account-plan contract exists.

## Dev tooling (not product UI)

### `ai-token-usage.html` — [LS][H]
- Standalone AI token-usage tracker used during development of this repo.
  Seed entries are estimates; its own storage keys (`ai-token-usage-*-v1`).
  Not part of the Stealth product — candidate for extraction from the repo,
  but harmless (not shipped by Vite).
