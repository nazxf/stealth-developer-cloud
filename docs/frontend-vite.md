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

The migration is incremental. `dev:next` and `build:next` remain available
until every feature route has moved. New routes must use the feature-oriented
Vite tree, the browser API client, runtime Zod schemas, and TanStack Query
keys rather than adding another Next server proxy.
