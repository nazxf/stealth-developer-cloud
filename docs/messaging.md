# Messaging

Messaging is the project-scoped delivery plane for provider credentials, topics,
recipients, and asynchronous message delivery. The API encrypts message bodies,
provider credentials, and recipient addresses before writing a durable queue;
only the trusted worker decrypts them for a registered provider adapter.

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
credentials and ciphertext are never returned. Provider identifiers select a
fixed worker adapter, so a project cannot turn a credential field into an
arbitrary outbound URL.

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
event is a configuration change. Message creation additionally writes an
encrypted payload and one delivery row per active subscriber in the same
transaction, so a `202 Accepted` response is durable queue acceptance rather
than a claim that a provider has accepted the message.

## Send and track a message

Send to one channel of a topic with a Console owner/admin session or a project
API key that has `messaging.write`:

```http
POST /v1/projects/{projectID}/messaging/messages
X-Stealth-Key: stl_key_...
Idempotency-Key: order-123-confirmation
Content-Type: application/json

{
  "topic_id": "018f...",
  "channel": "email",
  "subject": "Order confirmed",
  "body": "Your order is on its way.",
  "data": { "order_id": "123" }
}
```

The first accepted request returns `202` and a safe message projection. Reusing
the same `Idempotency-Key` and request returns `200` with the original message;
reusing it for different content returns `409`. Message content is never in a
message or delivery response. `GET /messaging/messages` lists statuses
(`queued`, `processing`, `succeeded`, `failed`, or `cancelled`), and
`GET /messaging/messages/{messageID}/deliveries` lists per-recipient attempts
with only masked address previews. `POST .../cancel` cancels queued recipients;
a provider call already in progress may finish and remains recorded.

## Trusted delivery worker

The `stealth-worker` process runs the messaging runner alongside Functions and
Webhooks. It leases one delivery at a time with PostgreSQL `FOR UPDATE SKIP
LOCKED`, increments the attempt before the provider call, and requeues expired
leases after `FUNCTIONS_RUNNER_LEASE_AGE`. Network/time-out failures and
provider `408`, `425`, `429`, and `5xx` responses retry with exponential
backoff (30 seconds up to 24 hours) for at most 12 attempts. Permanent adapter,
credential, or other `4xx` failures become `failed`; every transition updates
the aggregate message counters transactionally.

Built-in adapters are deliberately explicit:

- `email/smtp`: `host`, optional `port` (default 587), optional `username` and
  `password`, and `from`. Public SMTP hosts are resolved with private,
  loopback, link-local, multicast, and unspecified addresses blocked.
- `sms/twilio`: `account_sid`, `auth_token`, and either `from` or
  `messaging_service_sid`; requests go only to Twilio's fixed HTTPS endpoint.
- `email/log`, `sms/log`, and `push/log`: development adapters that record only
  channel, provider, masked preview, subject, and body size. They never log the
  plaintext recipient or body and should not be used for production delivery.

`push` currently has the explicit `log` adapter only; configure a real push
provider adapter before queueing production push traffic. The worker requires
the same `FUNCTIONS_SECRET_KEY`, `FUNCTIONS_WORKER_ID`,
`FUNCTIONS_RUNNER_POLL`, and `FUNCTIONS_RUNNER_LEASE_AGE` settings as the other
trusted workers.
