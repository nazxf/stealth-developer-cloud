# Project Usage

Console members can read a live project aggregate at:

```
GET /v1/projects/{projectID}/usage
```

The snapshot is computed from PostgreSQL on every request and includes
application users, databases/tables/rows, Storage files and bytes, Functions
artifact bytes, Sites published/reserved bytes, retained Realtime events, and
Webhook deliveries retained from the last seven days. Storage, Functions, and Sites show
the sum of configured project quotas so the Console can display usage
percentages without inventing plan limits.

Network egress, compute time, and invoices are intentionally not included yet:
they require durable request/compute metering rather than a derived row count.
The response includes `captured_at` so callers can label the snapshot and
refresh it when needed.
