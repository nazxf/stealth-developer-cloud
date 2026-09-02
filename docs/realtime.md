# Realtime

Stealth exposes a project-scoped Server-Sent Events (SSE) stream at:

```
GET /v1/projects/{projectID}/realtime
```

The endpoint accepts the Console session cookie, a project API key with the
independent `realtime.read` scope, or an authenticated project application
session. Anonymous requests are rejected. Application sessions receive only
`database_row.*` events that their current table/row read permissions allow;
Console and trusted server consumers receive the complete project stream.

Events are retained for seven days. Use `cursor=<event UUID>` or the standard
`Last-Event-ID` header when reconnecting. Optional `events=a,b` filtering is
applied after authorization. The response uses normal SSE `id`, `event`, and
`data` fields, where `data` is the same JSON envelope persisted by the
transactional outbox:

```json
{
  "id": "018f27e3-5d1a-7c44-ae35-1db4ea12e6d2",
  "event": "database_row.create",
  "project_id": "018f27e3-5d1a-7c44-ae35-1db4ea12e6d2",
  "target": {"type": "database_row", "id": "018f27e3-5d1a-7c44-ae35-1db4ea12e6d3"},
  "data": {"changed_fields": ["title"]},
  "created_at": "2026-09-02T12:00:00Z"
}
```

The envelope intentionally excludes row values. Consumers should fetch the
resource through the normal permission-checked Database or Storage API after
receiving a notification. SSE connections should be closed on logout and
reopened with the last received event ID; the API sends a retry hint and
periodic keep-alive comments.

The browser SDK exposes `client.realtime.subscribe({ events })`, which returns
an `EventSource`. Trusted server consumers can call
`await client.realtime.stream({ events })`; the returned `Response.body` is a
standard Web stream and the API key is sent only in the request header.

The Console project **Realtime** page uses the same authenticated stream. It
shows the latest 100 events, supports event filters, pause/resume, cursor-aware
reconnects, and copies the selected JSON envelope without storing event data
in `localStorage`.
