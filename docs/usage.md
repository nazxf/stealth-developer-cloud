# Project Usage

Console members can read a live project aggregate at:

```
GET /v1/projects/{projectID}/usage
```

The snapshot is computed from PostgreSQL on every request and includes
application users, databases/tables/rows, Storage files and bytes, Functions
artifact bytes, Sites published/reserved bytes, retained Realtime events, and
Webhook deliveries retained from the last seven days. It also includes rolling
30-day API request/egress and Functions invocation/failure/compute counters.
Storage, Functions, and Sites show the sum of configured project quotas so the
Console can display usage percentages without inventing plan limits.

For charts and billing exports, use the durable daily metering endpoint:

```
GET /v1/projects/{projectID}/usage/metering?from=YYYY-MM-DD&to=YYYY-MM-DD
```

Both dates are optional UTC calendar dates (default: the last 30 days,
inclusive); windows are capped at 367 days. Empty days are omitted, while the
response contains exact totals for the returned buckets. Invoice calculation
and plan enforcement remain a separate billing concern.

The response includes `captured_at` so callers can label the live snapshot and
refresh it when needed.
