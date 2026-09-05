# Stealth observability

The local observability profile is a production-shaped reference stack, not a
requirement for the API to boot:

```text
API ──┐                         ┌─ Prometheus ── Grafana
      ├─ /metrics ──────────────┤
Worker ┘                        ├─ Loki  ◀─ Grafana Alloy ◀─ Docker logs
API/Worker ── OTLP/HTTP ──▶ Tempo ────────────────┘
```

## Signals

- **Metrics** are served by the API at `/metrics` and by the worker on its
  private `FUNCTIONS_RUNNER_METRICS_ADDR` listener. Route labels use Chi
  templates, and worker labels use a fixed vocabulary; raw UUIDs and user
  input never become Prometheus labels. The same worker registry includes
  `stealth_agent_worker_*` queue, lease, completion, and error metrics when
  `AGENT_RUNNER_ENABLED=true`.
- **Traces** are emitted with OpenTelemetry. Set
  `OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo:4318` to enable OTLP/HTTP. The API
  extracts and returns a W3C trace ID, while worker build/execute spans use
  the same global propagator. The default sample ratio is 10%; set
  `OTEL_TRACES_SAMPLER_ARG` between `0` and `1` for another ratio.
  Authenticated organization members can query the bounded root-request index
  at `GET /v1/organizations/{organizationID}/traces`, while project members
  can use `GET /v1/projects/{projectID}/traces` for a project-scoped view. Both
  contain route, status, latency, response size, and tenant-safe names. Full
  nested spans and attributes stay in Tempo and are never copied into the
  Console database.
- **Logs** remain structured JSON on stdout. Grafana Alloy tails Docker's log
  stream, preserves `service`, `container`, and `level` labels, and forwards
  entries to Loki. Function and Site build lifecycle output is bounded and
  redacted before it is persisted or logged; Site build logs are available per
  deployment through the project API.

The worker's private listener exposes both `/metrics` and `/healthz`. The latter
is process-level readiness for the Compose supervisor; queue-loop failures exit
the worker so Docker can restart it. If `FUNCTIONS_RUNNER_ENABLED=false`, the
worker intentionally does not open the Functions metrics listener because only
the webhook and messaging loops remain active.

The Agent runner may still be enabled in that mode; with no registered
provider adapter it only repairs stale leases and leaves queued runs intact.

## Local stack

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo:4318 \
  docker compose --profile observability up --build
```

Open Grafana at `http://localhost:3000` (the credentials are controlled by
`GRAFANA_ADMIN_USER` and `GRAFANA_ADMIN_PASSWORD`). The read-only `Stealth
platform overview` dashboard is provisioned automatically with Prometheus,
Loki, and Tempo datasources, including trace-to-log links.

## Production rollout

Keep `/metrics`, Grafana, Loki, and Tempo on a private network. Use HTTPS OTLP
with collector authentication or mTLS, a non-default Grafana password, and
durable object storage for Loki/Tempo instead of the local filesystem
volumes. Set retention and alert policies explicitly; the Compose values are
short-lived local defaults. Do not add cookies, authorization headers, request
bodies, query strings, secrets, or tenant IDs to span attributes or metric
labels.
