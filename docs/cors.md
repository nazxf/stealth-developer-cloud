# Browser CORS

Each project has an explicit credentialed browser-origin allowlist. Configure
it from Console → Auth → Browser origins or through:

```
PATCH /v1/projects/{projectID}/auth/settings
{
  "cors_origins": ["https://app.example.com", "http://localhost:3000"]
}
```

Origins contain only an `http` or `https` scheme, host, and optional port.
Paths, query strings, credentials, wildcards, and more than 32 entries are
rejected. The API echoes `Access-Control-Allow-Origin` only for an exact
configured origin and enables credentials for project application sessions.
In production `COOKIE_SECURE=true` emits `SameSite=None; Secure` for the
project session cookie; local HTTP development keeps `SameSite=Lax`.

Preflight requests may use `GET`, `POST`, `PATCH`, or `DELETE`; the allowlist
covers `Last-Event-ID` for Realtime reconnects. Project API keys stay
server-only and are never enabled as browser CORS credentials. Requests from
an unconfigured origin receive no CORS access and unsafe requests are rejected
with `cors_forbidden`.
The Console same-origin bridge strips `Origin` and continues to use the
HttpOnly Console session independently.

## Vite Console

The Vite build calls the management API with `credentials: include`. When the
static Console is served from a different origin than Go, set the API's
`CONSOLE_CORS_ORIGINS` to a comma-separated exact-origin list, for example:

```
CONSOLE_CORS_ORIGINS=https://console.example.com,http://localhost:5173
```

This allowlist is separate from project `cors_origins`: it authorizes only the
trusted management UI and never accepts wildcards, paths, credentials, or
unvalidated request origins. `Idempotency-Key` and `Authorization` are exposed
for browser preflight because the Console's message queue and SDK clients use
them where appropriate.
