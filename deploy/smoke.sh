#!/usr/bin/env bash

# Small post-deploy probe for the API listener. It intentionally uses only
# unauthenticated health/metrics endpoints and never prints response bodies,
# which keeps credentials and tenant data out of CI logs.
set -Eeuo pipefail

base_url="${STEALTH_BASE_URL:-http://localhost:8080}"
base_url="${base_url%/}"
curl_args=(--silent --show-error --fail --location --max-time "${STEALTH_SMOKE_TIMEOUT:-10}")

probe() {
  local path="$1"
  local expected="$2"
  local body
  body="$(curl "${curl_args[@]}" "${base_url}${path}")"
  if [[ "$body" != *"\"status\":\"${expected}\""* ]]; then
    printf 'smoke check failed: %s did not report status=%s\n' "$path" "$expected" >&2
    return 1
  fi
}

probe /healthz ok
probe /readyz ready

# Metrics is intentionally public to the internal scraper. Verify the route
# responds without dumping the complete metrics stream into command output.
curl "${curl_args[@]}" --output /dev/null "${base_url}/metrics"
printf 'Stealth API smoke checks passed at %s\n' "$base_url"
