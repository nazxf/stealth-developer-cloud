# Webhooks

Webhooks let a project receive signed notifications without coupling the API
request to an external endpoint. The API writes the mutation, audit record,
outbox event, and initial delivery rows in one PostgreSQL transaction.

## Configure an endpoint

Create an endpoint with a Console owner/admin session or a project API key that
has `webhooks.write`:

```http
POST /v1/projects/{projectID}/webhooks
Content-Type: application/json
X-Stealth-Key: stl_key_...

{
  "name": "orders worker",
  "url": "https://hooks.example.com/stealth",
  "events": ["database_row.create", "function_execution.succeeded"],
  "enabled": true
}
```

The response contains safe metadata and a `whsec_...` secret. It is returned
only once; rotate it with `POST .../webhooks/{webhookID}/rotate-secret` if it is
lost or compromised. `webhooks.read` and `webhooks.write` are independent API
key scopes.

Supported event names are lowercase identifiers with `.`, `_`, and `-`; `*`
subscribes to every event. Current events include project, project-user,
project API-key, Auth settings, Database, Storage, Functions, and Sites audit
actions (for example `storage_file.create` and `site_deployment.activate`).

## Envelope and verification

Each delivery is a JSON object like:

```json
{
  "id": "018f...",
  "event": "database_row.create",
  "project_id": "018f...",
  "target": { "type": "database_row", "id": "018f..." },
  "data": { "actor": "project_user", "project_user_id": "018f..." },
  "created_at": "2026-09-02T12:00:00.000Z"
}
```

The worker sends these headers:

- `X-Stealth-Webhook-ID`
- `X-Stealth-Delivery`
- `X-Stealth-Event`
- `X-Stealth-Timestamp` (Unix seconds)
- `X-Stealth-Signature: v1=<hex>`

Verify the signature over the exact request bytes, using
`timestamp + "." + body` as the HMAC-SHA256 message. Compare the digest in
constant time and reject timestamps outside your replay window (five minutes
is a reasonable default). A delivery is successful for any 2xx response.

## Retry and safety policy

Delivery rows are leased with `FOR UPDATE SKIP LOCKED`; a crashed worker's
lease is requeued. Network failures, timeouts, 408, 425, 429, and 5xx responses
retry with exponential backoff, honoring a bounded integer `Retry-After` value.
Other 4xx responses are marked failed. The default maximum is 12 attempts and
the maximum delay is 24 hours. Delivery history stores at most 4 KiB of the
remote response and never stores the signing secret or request body separately.

URLs must use HTTPS. Before every connection the worker resolves the hostname
and refuses private, loopback, link-local, multicast, and unspecified IP
addresses. Redirects are disabled, proxy environment variables are ignored,
and TLS requires at least 1.2. Keep the worker on a trusted network and expose
only the API/metrics listeners.

List delivery history with:

```http
GET /v1/projects/{projectID}/webhooks/{webhookID}/deliveries?limit=20
```

The Console's Webhooks page exposes endpoint status, failure counters, pause,
secret rotation, deletion, and the one-time secret notice.
