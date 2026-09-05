# Vite Console

The default frontend entry is a React + TypeScript Vite SPA. It keeps the
management session in the Go API's HttpOnly cookie; browser requests use
`credentials: include` and never put a Console or project secret in local
storage.

## Local development

Start the API on `127.0.0.1:8080`, then run:

```bash
npm install
npm run dev
```

Vite serves the console at `http://127.0.0.1:5173` and proxies `/v1`,
`/healthz`, `/readyz`, and `/metrics` to the API. The dev proxy strips the
browser `Origin` because the request is same-origin from the browser. For a
direct cross-origin API, set `VITE_API_URL=https://api.example.com` and set
`CONSOLE_CORS_ORIGINS=https://console.example.com` in the API environment.

## Production

```bash
npm run build
npm run preview # local verification only
```

Publish `dist/` behind a static host or reverse proxy with SPA fallback to
`index.html`. Prefer serving the API and console from one origin; otherwise
use an explicit exact-origin `CONSOLE_CORS_ORIGINS` list and HTTPS with
`COOKIE_SECURE=true`. Never use `*` with credentialed requests.

Project overview, the API-backed Services workspace, Usage, deployments, Auth,
Databases, Storage, Functions, Sites, Webhooks, Messaging, Realtime, API keys,
Settings, Agents, and every Admin section use the feature-oriented Vite tree.
Next.js and the server-only bridge are removed from the frontend runtime. New
routes must use the browser API client, runtime Zod schemas, and TanStack Query
keys rather than adding a server proxy.
