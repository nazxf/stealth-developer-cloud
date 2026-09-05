# TanStack Start Console

The frontend runtime is React + TanStack Start in SPA-first mode. TanStack
Start owns the document and build pipeline while TanStack Router, TanStack
Query, and the existing Go API client continue to own navigation, data
fetching, and the management session. The Go API's HttpOnly cookie remains the
authentication boundary; browser requests use `credentials: include` and
never put a Console or project secret in local storage.

## Local development

Start the API on `127.0.0.1:8080`, then run:

```bash
npm install
npm run dev
```

Vite's development server serves the console at `http://127.0.0.1:5173` and
proxies `/v1`,
`/healthz`, `/readyz`, and `/metrics` to the API. The dev proxy strips the
browser `Origin` because the request is same-origin from the browser. For a
direct cross-origin API, set `VITE_API_URL=https://api.example.com` and set
`CONSOLE_CORS_ORIGINS=https://console.example.com` in the API environment.

## Production

```bash
npm run build
npm run preview # local verification only
```

The frontend smoke suite exercises the typed browser API boundary with a
browser-like runtime:

```bash
npm test
```

The browser output is `dist/client/`. Publish that directory behind a static
host or reverse proxy with SPA fallback to `_shell.html`. Prefer serving the
API and console from one origin; otherwise
use an explicit exact-origin `CONSOLE_CORS_ORIGINS` list and HTTPS with
`COOKIE_SECURE=true`. Never use `*` with credentialed requests.

For a self-contained local/container deployment, the repository also ships a
static Nginx image. It can be started alongside the Go stack with:

```bash
docker compose --profile console up --build
```

The image bakes only the browser-safe `VITE_API_URL`, serves hashed assets with
long-lived cache headers, returns a separate `/healthz`, and falls back unknown
document paths to `_shell.html`. Use a CDN or reverse proxy instead of this
image when production traffic needs edge caching or TLS termination.

The Start file routes now own the console layout, project overview/resource
screens, authentication pages, the API-backed Services workspace (including
its persisted project canvas), Usage, Logs, deployments, Auth, the Databases
workspace (typed columns, indexes, and permission-filtered row CRUD), Storage,
Functions, Sites, Webhooks, Messaging, Realtime, API keys, Settings, Agents,
and every Admin section. These routes lazy-load the existing feature-oriented
components and browser API client, so the Go API contract and UI behavior stay
stable without a second frontend router. Unknown protected URLs render a Start
not-found surface after the same session guard. New routes should use runtime
Zod schemas and TanStack Query keys rather than adding a server proxy. Server
functions are intentionally not used in this phase because direct
browser-to-Go requests preserve the existing cookie flow and API contract.
