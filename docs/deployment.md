# Production deployment

This repository ships a self-hosted, production-shaped Docker Compose
deployment. It runs the Go API, the static Vite Console, PostgreSQL, Redis,
the trusted Functions/Sites worker, and (optionally) the observability stack.
It is a reference deployment for one operator; a multi-node installation
should move PostgreSQL, Redis, object storage, and the worker onto managed or
isolated infrastructure.

## Before the first rollout

Install Docker Engine with Compose v2 and make sure the host can resolve the
Console and API DNS names. Put an HTTPS reverse proxy or load balancer in front
of the API and Console. Do not expose PostgreSQL, Redis, the worker Docker
socket, or `/metrics` to the public internet. Compose binds PostgreSQL and the
optional Prometheus/Grafana/Loki/Tempo ports to `127.0.0.1` by default; keep
that loopback binding unless an authenticated internal proxy is intentional.

Create a private `.env` from the checked-in template:

```bash
cp .env.example .env
openssl rand -base64 32 # use the output for FUNCTIONS_SECRET_KEY
```

At minimum, replace `POSTGRES_PASSWORD`, `FUNCTIONS_SECRET_KEY`, and
`GRAFANA_ADMIN_PASSWORD`. For an HTTPS deployment also set:

```dotenv
COOKIE_SECURE=true
PUBLIC_APP_URL=https://console.example.com
CONSOLE_CORS_ORIGINS=https://console.example.com
VITE_API_URL=https://api.example.com
EMAIL_DELIVERY_MODE=smtp
```

`VITE_API_URL` is baked into the Console image at build time, so rebuild the
Console after changing it. `FUNCTIONS_SECRET_KEY` must be a Base64-encoded
32-byte key; the API refuses to become ready when it is invalid.

For more than one API/worker node, use an S3-compatible blob store instead of
the default local volume. Set `STORAGE_DRIVER=s3` and all `STORAGE_S3_*`
credentials in `.env`; keep the S3 bucket private. Configure SMTP before
enabling verification or password recovery in a real environment.

The worker mounts `/var/run/docker.sock` because it builds and runs isolated
Function workloads. Run it on a dedicated host or node, pin every
`FUNCTIONS_RUNNER_*_IMAGE` by digest, and pre-pull those images. Never mount
the Docker socket into the API or Console container.

## Validate and start

Render the complete configuration before starting anything. This catches
missing required secrets without launching containers:

```bash
docker compose --profile console --profile observability config --quiet
```

Start the API, worker, database, and Redis. Add the Console and observability
profiles when those surfaces are needed:

```bash
docker compose up -d --build
docker compose --profile console up -d --build
docker compose --profile observability up -d
```

The API applies embedded PostgreSQL migrations before serving traffic. Wait
for all required services to become healthy, then inspect the rollout:

```bash
docker compose ps
docker compose logs --tail=100 api worker
```

Run the post-deploy probe against the public API origin. It checks health,
dependency readiness, and the metrics listener without printing response
bodies:

```bash
STEALTH_BASE_URL=https://api.example.com ./deploy/smoke.sh
```

The Console is a static SPA served by Nginx. Its `/healthz` endpoint only
checks that the static server is running; API readiness is checked separately
by the smoke script.

## What users can deploy

The current product deployment surfaces are project-scoped **Sites** and
**Functions**. A Site deployment accepts a bounded static archive or a Git
source and publishes an immutable active release. Function source is built by
the trusted worker, then invoked through the project API. The Console
deployment timeline and resource pages show queued, building, ready, failed,
and active states from durable API records.

The platform itself (API, Console, PostgreSQL, Redis, and worker) is deployed
by the operator with this Compose stack. Arbitrary user Docker services are
not exposed as a general-purpose container host.

## Backups and rollback

Use the project Databases page or the database backup API to create bounded
logical snapshots and restore a database namespace atomically. Logical
database backups contain schema, rows, indexes, and relationships; they do not
replace PostgreSQL volume backups or blob-store versioning. Back up the
PostgreSQL volume and the S3 bucket according to the operator's retention
policy.

Keep the previously deployed API and Console image digests available for a
rollback. Roll back the application image only after checking migration
compatibility; migrations are applied forward by the API at startup. For a
data incident, stop writes, create a fresh backup, restore the selected
namespace, and rerun the smoke probe before reopening traffic.

## Security checklist

- Use HTTPS and `COOKIE_SECURE=true` in every non-local environment.
- Set `CONSOLE_CORS_ORIGINS` to exact Console origins; do not use `*` with
  credentialed browser requests.
- Keep `/metrics`, Grafana, Prometheus, Loki, Tempo, PostgreSQL, and Redis on
  private networks or behind authenticated internal access.
- Store `.env` in a secret manager or protected host path; never commit it.
- Pin application and Functions runtime images by immutable digest before a
  production rollout.
- Rotate `FUNCTIONS_SECRET_KEY` only with a deliberate migration plan because
  existing encrypted Function variables become undecryptable after rotation.
- Review worker host access separately because Docker socket access is
  equivalent to host-level control.
