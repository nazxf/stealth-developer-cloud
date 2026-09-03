# Messaging

Messaging is the project-scoped control plane for provider credentials, topics,
and recipients. It deliberately stops at durable configuration: a configured
provider does not imply that a message was sent. A trusted delivery worker and
provider adapters can consume these records in a later milestone.

## Providers

Providers are managed at `/v1/projects/{projectID}/messaging/providers`.
Console owners/admins or a project API key with `messaging.write` can create,
update, pause, and delete them. A key with `messaging.read` can list or fetch
safe provider metadata.

```http
POST /v1/projects/{projectID}/messaging/providers
X-Stealth-Key: stl_key_...
Content-Type: application/json

{
  "name": "Transactional email",
  "channel": "email",
  "provider": "ses",
  "credentials": { "access_key": "...", "secret_key": "..." }
}
```

Credentials are encrypted with `FUNCTIONS_SECRET_KEY` before storage. List,
create, and update responses expose only `credentials_present`; plaintext
credentials and ciphertext are never returned. Sending, retries, and provider
health are not part of this API yet.

## Topics and subscribers

Topics are durable recipient lists at
`/v1/projects/{projectID}/messaging/topics`. A topic has a name, description,
enabled state, and active subscriber count. Subscribers are nested under a
topic:

```http
POST /v1/projects/{projectID}/messaging/topics/{topicID}/subscribers
X-Stealth-Key: stl_key_...
Content-Type: application/json

{ "channel": "email", "address": "person@example.com" }
```

Subscriber addresses are encrypted at rest and deduplicated by a SHA-256 hash
within a topic/channel pair. Responses expose only a masked
`address_preview` (for example, `p***@example.com`). A read scope can inspect
the preview, while a write scope is required for create/delete mutations.
Email addresses, E.164 SMS numbers, and push tokens have channel-specific
validation; arbitrary whitespace and control characters are rejected.

All mutations append an audit event and transactional outbox event. The outbox
event is a configuration change, not a delivery request, so consumers must
apply their own idempotency and sending policy.
