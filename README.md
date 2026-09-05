# Stealth Console and API

The web console for **Stealth**, a developer cloud platform. Deploy services,
inspect a live service workspace, follow deployment state, inspect usage and
requests, and run AI agents against your projects.

## Stack

- React + TypeScript + Vite (TanStack Router/Query) as the only frontend runtime
- Tailwind CSS 4 with a token-based theme in `src/styles/`
- motion/react for interaction animation, recharts for admin telemetry charts
- Geist, Inter Variable, and Source Code Pro as the font stack
- Go 1.26 API using Chi, pgx/v5, PostgreSQL, Argon2id, Redis-backed rate limits, and opaque cookie sessions
- Prometheus-compatible API/worker metrics, with an optional Compose scrape profile
- Docker Compose provisions PostgreSQL and Redis for the API and public Auth protection

## Architecture

```
Stealth Console (Vite SPA)
        ↓
browser API client (credentials + runtime schemas)
        ↓
Go API (cookie session, CORS, OpenAPI)
        ↓
```

The Vite entry point is the `dev`, `build`, and `start` path. It uses
TanStack Router for route state, TanStack Query for server state, and Zod at
the API boundary. Set `VITE_API_URL` when the static console is hosted on a
different origin; configure the API's exact `CONSOLE_CORS_ORIGINS` allowlist in
that deployment. The browser calls Go directly with the HttpOnly session
cookie; there is no Next server proxy or server-only API bridge.

The connected identity, project console, deployment timeline, and Agent
configuration/run surfaces use the Stealth API. The shared Vite shell also
uses the authenticated account identity and logout session. Site and Function
releases are shown from durable deployment records, and owners/admins can start
a Git deployment from the project timeline. Agent prompts are persisted in a durable queue; provider
connections and the trusted execution worker are intentionally separate, so a
queued run is never shown as completed without real worker output. The
historical migration inventory is kept in
[docs/api-migration-audit.md](docs/api-migration-audit.md).
The admin Overview is session-protected and reads workspace usage aggregates;
the Agent Runs, Usage, Users, and audit Logs pages read durable
records/aggregates from the same workspace APIs. Users are organization
memberships merged by account, and organization owners/admins can add existing
Console accounts, invite teammates by email, change regular-member roles, or
remove non-owner members. Invitation tokens are one-time, email-bound hashes;
ownership transfer remains a separate contract. The Admin Traces page now
shows the durable root-request index; nested spans and historical aggregate
charts remain unavailable until their query contracts exist.
Historical observability panels are explicitly marked preview until their
authenticated query contracts are implemented.

## Structure

- `src/vite/` — React + Vite route tree (`/`, auth flows, projects, Services, deployments, Auth, Databases, Storage, Functions, Sites, Webhooks, Messaging, Realtime, API keys, Settings, Agents, and Admin)
- `src/lib/browser-api.ts` — the browser-safe, Zod-validated Go API client
- `src/styles/`, `src/main.tsx` — global tokens, Vite entry, TanStack Router route tree, Query client, and shell
- `services/api/cmd/api` — API process entry point and graceful shutdown
- `services/api/internal/auth` — Argon2id password and opaque session helpers
- `services/api/internal/apikey` — high-entropy project API key generation, hashing, scope, and expiry validation
- `services/api/internal/repository` — pgx repositories and transactional control-plane writes
- `services/api/internal/httpapi` — Chi routes, cookie authentication, validation, and error envelope
- `services/api/internal/migrate/migrations` — embedded, transactional PostgreSQL migrations
- `services/api/internal/db/queries` and `services/api/sqlc.yaml` — reproducible sqlc query definitions for read projections
- `packages/openapi/openapi.yaml` — OpenAPI 3.1 contract consumed by future Console/API clients
- `docs/observability.md` — signal flow, privacy boundaries, and Compose rollout for telemetry
- `docs/sites.md` — static publication, immutable rollout, quota, and serving contract
- `docs/realtime.md` — authenticated SSE subscriptions, cursors, and permission filtering
- `docs/cors.md` — per-project browser origin allowlists and credential rules
- `docs/frontend-vite.md` — Vite deployment, proxy, and migration contract
- `docs/usage.md` — live project resource aggregates and metering boundary
- `docs/auth.md` — one-time verification, recovery, organization invitations, and SMTP delivery
- `docs/agents.md` — project-scoped Agent configuration, run queue, and execution boundary

## Local API development

Create your local environment file, then start the complete local stack. The
API applies embedded migrations before it begins serving traffic.

```bash
cp .env.example .env
# edit .env, replace the development password, and generate the Functions key:
# openssl rand -base64 32
docker compose up --build
```

The Compose stack starts `api`, PostgreSQL, Redis, a one-shot `storage-init`
volume-permission job, and the trusted `stealth-worker`. The API image runs as
the non-root `stealth` user; only the init job and worker need root-level
container privileges. Before invoking a function, pre-pull the exact runtime images
configured by your deployment policy (`node:22-alpine`, `python:3.13-alpine`,
and `golang:1.24-alpine`); the worker uses `--pull=never` so an execution can
never trigger an unexpected network pull. In production, pin those images by
digest through the `FUNCTIONS_RUNNER_*_IMAGE` settings and isolate the worker
host because it is the only service with access to Docker's socket.

The API is available at `http://localhost:8080` by default:

```bash
curl http://localhost:8080/healthz
curl http://localhost:8080/readyz
# Post-deploy probe (fails if dependencies are not ready):
./deploy/smoke.sh

curl -i -c cookies.txt \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"correct-horse-battery-staple"}' \
  http://localhost:8080/v1/account/registrations

curl -b cookies.txt http://localhost:8080/v1/organizations

# Project application identities (owner/admin membership required to write)
curl -b cookies.txt http://localhost:8080/v1/projects/<project-id>/users
curl -b cookies.txt -H 'content-type: application/json' \
  -d '{"email":"app-user@example.com","password":"correct-horse-battery-staple","name":"App User"}' \
  http://localhost:8080/v1/projects/<project-id>/users

# Owner/admin: enable public project registration, then use project Auth routes.
curl -b cookies.txt -X PATCH -H 'content-type: application/json' \
  -d '{"registration_enabled":true}' \
  http://localhost:8080/v1/projects/<project-id>/auth/settings
curl -i -c app-cookies.txt -H 'content-type: application/json' \
  -d '{"email":"person@example.com","password":"correct-horse-battery-staple","name":"Person"}' \
  http://localhost:8080/v1/projects/<project-id>/account/registrations
curl -b app-cookies.txt http://localhost:8080/v1/projects/<project-id>/account

# Owner/admin: create a server-to-server key. The full secret is shown once.
curl -b cookies.txt -H 'content-type: application/json' \
  -d '{"name":"worker","scopes":["users.read","users.write"]}' \
  http://localhost:8080/v1/projects/<project-id>/api-keys

# Use the one-time secret only from a trusted server; never put it in browser code.
curl -H 'X-Stealth-Key: stl_key_<one-time-secret>' \
  http://localhost:8080/v1/projects/<project-id>/users

# Enqueue an active Function deployment from a trusted server. Poll the
# returned execution id with functions.read; source code runs asynchronously.
curl -H 'X-Stealth-Key: stl_key_<one-time-secret>' \
  -H 'content-type: application/json' \
  -d '{"trigger":"manual","input":{"hello":"world"}}' \
  http://localhost:8080/v1/projects/<project-id>/functions/<function-id>/executions

# Publish a pre-built static Site (the archive must contain root index.html).
curl -b cookies.txt -H 'content-type: application/json' \
  -d '{"name":"landing"}' \
  http://localhost:8080/v1/projects/<project-id>/sites
curl -b cookies.txt -F source=@dist.tar.gz -F activate=true \
  http://localhost:8080/v1/projects/<project-id>/sites/<site-id>/deployments
curl http://localhost:8080/v1/sites/<site-id>/

# Configure a signed project webhook. The whsec_ secret is returned once.
curl -b cookies.txt -H 'content-type: application/json' \
  -d '{"name":"orders","url":"https://hooks.example.com/stealth","events":["database_row.create"]}' \
  http://localhost:8080/v1/projects/<project-id>/webhooks

# Create a project-scoped Agent configuration (Console session; owner/admin).
# Provider credentials and run execution are configured separately.
curl -b cookies.txt -H 'content-type: application/json' \
  -d '{"project_id":"<project-id>","name":"Frontend Engineer","role":"Frontend","provider":"OpenAI","model":"GPT-5.6","branch":"main","tools":["Read files","Edit files","Run tests"]}' \
  http://localhost:8080/v1/agents

# Queue a prompt. The response is 202/queued until a trusted provider worker
# is configured; no model call or source edit happens in this request.
curl -b cookies.txt -H 'content-type: application/json' \
  -d '{"prompt":"Inspect the project and propose the next safe improvement."}' \
  http://localhost:8080/v1/agents/<agent-id>/runs
```

For local Go iteration, keep PostgreSQL running and supply a database URL:

```bash
docker compose up -d postgres redis
DATABASE_URL='postgres://stealth:replace-with-a-local-development-secret@localhost:5432/stealth?sslmode=disable' \
  go run ./services/api/cmd/api
```

Run backend verification from the API module:

```bash
cd services/api
go test ./...
TEST_DATABASE_URL='postgres://stealth:replace-with-a-local-development-secret@localhost:5432/stealth?sslmode=disable' go test ./internal/httpapi -run Integration
go vet ./...
# Generated SQL code is reproducible when it becomes needed by a handler:
go run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.30.0 generate
```

`sqlc generate` only writes generated Go into `services/api/internal/db/sqlc`;
the hand-written pgx repository currently owns transactional signup/session
writes because they span multiple resources and audit events.

Set `COOKIE_SECURE=true` in every HTTPS/production deployment. The Compose
default is deliberately `false` only so browser cookies work against local HTTP.
`SESSION_TTL` controls Console sessions; `APP_SESSION_TTL` separately controls
project application sessions and is bounded to 720 hours. `REDIS_URL` is
required by the production process: if Redis is unavailable, public Auth fails
closed and `/readyz` reports `503`.

After a rollout, run `STEALTH_BASE_URL=https://api.example.com ./deploy/smoke.sh`.
The probe checks `/healthz`, `/readyz`, and `/metrics`, prints no response
bodies, and exits non-zero when a dependency or listener is not ready. Keep
`/metrics` reachable only from the internal scraper network or an authenticated
reverse-proxy policy.

Storage uses the local filesystem for bytes and PostgreSQL for tenant-scoped
metadata/accounting. `STORAGE_ROOT` is the private root directory; objects are
written to UUID-only paths using a fsynced temporary file and atomic rename.
`STORAGE_MAX_FILE_SIZE` is the global hard limit and
`STORAGE_DEFAULT_QUOTA_BYTES` is the default bucket quota. Both accept plain
bytes or IEC quantities such as `50MiB` and `1GiB`. Compose mounts
`stealth-storage-data` at this root and the API image prepares it for the
non-root `stealth` user. Keep the root on durable storage and back it up with
the database metadata; PostgreSQL never stores blob content.

### Observability

Every API process exposes Prometheus metrics at `GET /metrics`. The endpoint
records request count, duration, response bytes, in-flight requests, and Go /
process telemetry. Route labels use templates such as
`/v1/projects/{projectID}` rather than raw UUIDs, so tenant identifiers cannot
create unbounded metric series. The trusted worker has a separate internal
listener at `FUNCTIONS_RUNNER_METRICS_ADDR` (default `:9091`) with queue polls,
claims, terminal execution results, build claims/results, lease requeues,
processing duration, and fixed-operation error counters.

Start the optional local Prometheus, Grafana, Loki, and Tempo stack with:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo:4318 \
  docker compose --profile observability up --build
```

Prometheus is then available at `http://localhost:9090` by default and scrapes
`api:8080/metrics` and `worker:9091/metrics` over the private Compose network.
The API metrics route intentionally has no application-session requirement so
Prometheus can scrape it; in production, allow it only through an internal
network, reverse-proxy policy, or firewall rule. Grafana dashboards, Loki log
shipping, and OpenTelemetry traces to Tempo are provisioned by the same
profile: Grafana is at `http://localhost:3000`, Loki at `http://localhost:3100`,
and Tempo's query API at `http://localhost:3200`. Grafana loads the
`Stealth platform overview` dashboard and links traces to matching logs.
The OTLP endpoint is optional; when it is blank the API and worker keep the
same instrumentation with no-op spans. Change the default Grafana password
before exposing this profile outside a local network, and use a TLS endpoint
plus OTLP headers/mTLS in production.

## Connected Console contract

The default Vite Console uses the browser-safe `VITE_API_URL` origin (or
relative `/v1` requests in a same-origin deployment) and the central
`src/lib/browser-api.ts` client. Its authenticated browser integration uses
`credentials: "include"` and the endpoints in
`packages/openapi/openapi.yaml`. Session tokens and password hashes are never
returned to JavaScript. The connected Console path is: register/login → `GET
/v1/account` → `GET /v1/organizations` → organization-scoped projects →
project Auth identity management, owner/admin-only Auth settings, owner/admin
project API-key management, and the Agent configuration control plane. Project
application Auth is a separate cookie/session boundary: public registration,
email/password login, current-account, verification, recovery, and logout live under
`/v1/projects/{projectID}/...` and never use the Console `stealth_session`
cookie. The dependency-free client in
[`packages/sdk-js`](packages/sdk-js/README.md) covers those public routes.
Verification, recovery, and organization invitation links are one-time,
expiring secrets; configure the
SMTP delivery settings described in [`docs/auth.md`](docs/auth.md) before
enabling them in production. Password recovery revokes all existing sessions.
The browser client sends the HttpOnly Console cookie with `credentials:
include`, validates response envelopes with Zod, and uses the Go API's exact
CORS allowlist when deployed cross-origin. Public project application Auth is
intentionally a separate cookie boundary. The client also supports the
long-lived project Realtime SSE stream and forwards reconnect cursors. The SDK
can use a same-origin browser endpoint or a configured project CORS origin;
wildcard and arbitrary cross-origin origins remain disabled. Sites support verified
custom hostnames through the server API. Optional in-process ACME termination
can issue and renew certificates automatically for those verified names; leave
`ACME_ENABLED=false` when TLS is handled by a reverse proxy.
The server-only SDK entry point (`packages/sdk-js/server.ts`) sends
`X-Stealth-Key` for the supported `users.read`, `users.write`,
`databases.read`, `databases.write`, `storage.read`, `storage.write`,
`functions.read`, `functions.write`, `sites.read`, `sites.write`, `webhooks.read`,
`webhooks.write`, `realtime.read`, `messaging.read`, and `messaging.write` scopes
and never persists the key. Database core now supports typed databases/tables/columns, real key/unique
indexes, and permission-aware row CRUD. Database `write` does not imply
`read`; callers must grant both scopes when they need both. Realtime is
available as an authenticated, cursor-aware Server-Sent Events stream; see
[`docs/realtime.md`](docs/realtime.md) for its permission and reconnect
contract. Messaging configuration is available for providers, topics, and
masked subscribers; delivery adapters and the trusted sending worker remain a
separate milestone. Relationships, transactions, backups, full-text,
bulk/import/export, and other future modules remain unavailable.

### Webhooks contract

Project Webhooks are managed at `/v1/projects/{projectID}/webhooks`. A webhook
accepts only an HTTPS URL and an event allowlist (empty means `*`). Console
owners/admins or keys with `webhooks.write` can create, update, pause, rotate,
and delete endpoints; `webhooks.read` is independent and only exposes safe
configuration plus bounded delivery history. The `whsec_` signing secret is
returned once at creation or rotation and is encrypted at rest with
`FUNCTIONS_SECRET_KEY`.

Mutations append a transactional outbox event and delivery rows in PostgreSQL.
The trusted worker claims rows with leases, resolves DNS while blocking private,
loopback, link-local, multicast, and unspecified addresses, disables redirects,
and signs `timestamp.payload` with HMAC-SHA256 (`X-Stealth-Signature:
v1=<hex>`). Responses in delivery history are truncated; network errors,
timeouts, 408/425/429, and 5xx responses retry with exponential backoff (up to
12 attempts), while other 4xx responses are terminal. See
[`docs/webhooks.md`](docs/webhooks.md) for the event envelope and verification
example.

### Messaging contract

Project Messaging is managed at `/v1/projects/{projectID}/messaging`. The
control plane stores email, SMS, and push provider metadata, encrypted
credentials, topics, encrypted recipient addresses, and an asynchronous
send/status/cancel queue. Owners/admins or `messaging.write` keys can mutate the
resources; `messaging.read` is independent and returns only safe metadata and
masked subscriber previews. The trusted worker ships SMTP and Twilio adapters
plus explicit development log adapters; message content and full addresses
never leave the worker boundary. Push currently requires a real provider
adapter beyond the built-in `push/log` development adapter. See
[`docs/messaging.md`](docs/messaging.md) for the queue, retry, and provider
contract.

### Sites contract

Sites accept pre-built static archives (`.zip`, `.tar`, `.tar.gz`, or `.tgz`) or
source archives with a `build_command`. Pre-built uploads are extracted only as
regular files with bounded expanded bytes and file count, require a root
`index.html`, reject traversal/symlink/special-file entries, and are stored in
a private immutable UUIDv7 directory. Source uploads are queued for the
isolated worker, which runs the command in a network-disabled non-root
container and publishes the validated `output_directory` atomically. Uploads
can be activated atomically; the public `/v1/sites/{siteID}/...` route serves
only the active deployment with safe content and cache headers. The API never
executes uploaded Site content. Set `SITES_MAX_ARTIFACT_SIZE`,
`SITES_MAX_EXPANDED_BYTES`, `SITES_MAX_FILES`, and
`SITES_DEFAULT_QUOTA_BYTES` to tune the production limits. Set
`SITES_GIT_FETCH_CONCURRENCY` (default `4`) to bound simultaneous upstream Git
downloads.
Git deployments are available at
`POST /v1/projects/{projectID}/sites/{siteID}/deployments/git` for public
HTTPS GitHub/GitLab repositories. The endpoint validates the repository/ref,
downloads only a provider-generated archive from an allow-listed host, keeps
repository/ref metadata, and sends the source through the same network-
isolated worker; provider credentials and arbitrary clone URLs are rejected.
When `ACME_ENABLED=true`, the API serves HTTPS on `ACME_TLS_ADDR` and the
ACME HTTP-01 challenge listener on `ACME_HTTP_CHALLENGE_ADDR`. Persist
`ACME_CERT_CACHE_DIR` (the default is under `STORAGE_ROOT`) because it contains
the ACME account key and certificate private keys. Put ports 80/443 or an
equivalent load balancer in front of those listeners; certificate requests
are allowed only after the custom domain's DNS TXT verification succeeds.
The complete rollout, custom-domain, and storage contract is in [`docs/sites.md`](docs/sites.md).

### Storage contract

Storage bucket management is Console/API-key-only (`storage.read` for metadata
reads and `storage.write` for mutations). File data endpoints also accept a
project application session or anonymous caller when bucket/file grants allow
the operation. Permissions are default-deny. With `file_security=true`, a
bucket grant or file grant authorizes read/update/delete; with it disabled,
bucket grants are the only file permissions. Anonymous uploads must explicitly
send `read_permissions`, `update_permissions`, and `delete_permissions`.
Uploads are multipart and stream through the API; the response includes MIME,
size, and a verified SHA-256 checksum. Downloads use a safe attachment header,
`nosniff`, and private no-store caching. Bucket quota and per-bucket maximum
file size are serialized transactionally with row locks, and failed metadata
creation removes the already-published blob.

S3-compatible adapters, resumable/chunked uploads, image transforms, antivirus
scanning, CDN delivery, and crash-time orphan reconciliation are intentionally
deferred. The current local store can leave an invisible orphan after a
process crash between filesystem publication and metadata insertion; operators
should reconcile UUID object paths against `storage_files` before deleting any
unreferenced data.

### Functions contract

Functions is a production-oriented control plane plus an isolated execution
worker: Console members and server API keys can create function configuration,
manage write-only encrypted variables, stream versioned source archives, select
exactly one active deployment, enqueue executions, and inspect bounded input /
output metadata. Source archives are stored opaquely beneath the private
storage root and are extracted only by the separate worker. `FUNCTIONS_MAX_ARTIFACT_SIZE`
bounds one upload and `FUNCTIONS_DEFAULT_QUOTA_BYTES` bounds the source plus
the immutable built artifact stored per function.
`FUNCTIONS_RUNNER_BUILD_TIMEOUT` (default `15m`) bounds one build lease; tune it
with the worker lease age so a timed-out builder can be retried safely.
`FUNCTIONS_SECRET_KEY` must decode to exactly 32 bytes and is required before
the API starts; losing or rotating it without a migration makes existing
variable values undecryptable. Store it in a deployment secret manager, never
in the repository.

The worker is a separately deployed `stealth-worker` process. Each deployment
first leases a build job with PostgreSQL row locks, extracts the source in a
trusted staging area, runs `commands` once in an isolated Docker container, and
publishes a checksum-addressed tar artifact. Invocations are accepted while a
build is queued, but the execution queue only claims deployments whose
`build_status` is `succeeded`; this makes deploys asynchronous without ever
running an unbuilt or partially written workspace. A failed build records a
bounded error and fails executions that were waiting on that deployment.
The worker then extracts only the trusted artifact and launches one short-lived
Docker container per execution with `--network=none`, a read-only root
filesystem, dropped Linux capabilities, no-new-privileges, a non-root UID,
PID/memory/CPU limits, bounded output, and secret redaction. The worker is the
only service that mounts `/var/run/docker.sock`; user containers never see that
socket or the artifact store. Runtime images are fixed to Node 22, Python 3.13,
or Go 1.24 and must be pre-pulled/pinned by the operator. API-key invocations
use `functions.write`; project-user/anonymous invocations use the function's
`execute_permissions` (`user:<id>`, `users`, or `any`).
The runtime contract is deliberately small: execution input is provided as
UTF-8 JSON on stdin, configured variables are exposed as environment variables,
and stdout is captured as JSON when valid (otherwise as a bounded text string).
Stderr is retained only as redacted, bounded execution logs.

## Development

```bash
npm install
npm run dev          # Vite dev server
npm run typecheck    # TypeScript check for the Vite application
npm run build        # Vite production build
npm run check        # typecheck + Vite build
```
