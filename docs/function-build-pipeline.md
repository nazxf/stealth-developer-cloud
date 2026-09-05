# Function build pipeline

Stealth separates a user-uploaded Function source archive from the artifact
that is executed. The source is immutable evidence of what was uploaded; the
worker-produced tar is the immutable runtime snapshot.

```text
upload source
    │
    ▼
build_status=queued ── worker lease ──▶ running
    │                                      │
    │                                      ├─ validation/build error ─▶ failed
    │                                      │
    └─ accepted executions wait             └─ publish tar + checksum ─▶ succeeded
                                                        │
                                                        ▼
                                              execution worker extracts tar
```

## Deployment contract

- Uploads reserve source bytes against `artifact_quota_bytes` and return
  immediately with `build_status=queued`.
- The deployment snapshots runtime, entrypoint, commands, timeout, and logging
  settings. It also snapshots each variable's encrypted ciphertext. Later
  edits to the Function or its variables do not mutate an already-built
  deployment.
- `commands` runs once in the isolated builder. It is cleared from the runtime
  job, so package installation or compilation is never repeated per request.
- The builder stores its output under a UUID-only path and records its size and
  SHA-256 digest transactionally. The source and build artifact both count
  toward the Function quota.
- Execution enqueue is allowed while a build is queued or running. PostgreSQL
  only leases execution rows when the deployment is active and
  `build_status=succeeded`. A failed build marks waiting executions failed.

## Worker safety

The source archive is extracted with traversal, duplicate, special-file, and
expanded-size checks. Builder output is read back through the trusted tar
extractor before publication; relative symlinks are allowed for package
manager output, but absolute and escaping targets are rejected. Runtime
containers receive a read-only artifact volume, no network, dropped
capabilities, no-new-privileges, a non-root UID, and bounded CPU, memory, PID,
and output limits.

Build leases are fenced by `build_worker_id`. A worker crash leaves a running
lease that is returned to `deferred` after `FUNCTIONS_RUNNER_LEASE_AGE`, so a
second worker can retry it. A completed artifact is never overwritten; deploy a
new version when source or build settings change.

## Operations

Inspect `build_status`, `build_started_at`, `built_at`, and `error_message` from
the deployment API. Bounded, secret-redacted build logs are available from
`GET /v1/projects/{projectID}/functions/{functionID}/deployments/{deploymentID}/logs`
with `limit` and sequence-based `after` pagination. Worker Prometheus metrics include
`stealth_functions_worker_builds_claimed_total`,
`stealth_functions_worker_builds_completed_total`,
`stealth_functions_worker_build_duration_seconds`, and stale-build requeues.
