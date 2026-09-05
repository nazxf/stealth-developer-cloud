# Sites

Sites are the static publishing surface of Stealth. A deployment can be a
pre-built archive or a source archive built asynchronously by the isolated
worker; the API process never executes uploaded code.

## Publish flow

1. Create a Site under a project (`POST /v1/projects/{projectID}/sites`).
2. Upload a `.zip`, `.tar`, `.tar.gz`, or `.tgz` archive as the `source`
   multipart field (`POST .../sites/{siteID}/deployments`).
3. For a pre-built publication, omit `build_command`; the archive must contain
   a regular `index.html` at its root and is extracted immediately.
4. For a source build, provide `build_command` and optionally
   `build_runtime` (`node-22`, `python-3.13`, or `go-1.24`) and
   `output_directory` (default `.`). The API stores the compressed source in
   the private `site-archives` namespace and returns a queued deployment.
5. The Sites worker extracts the source, runs the command in a network-disabled
   non-root container, validates the output, and atomically renames it to the
   immutable UUIDv7 deployment path. PostgreSQL moves the reserved quota into
   the final expanded-byte usage in the same transaction.
6. `activate=true` (the default) requests activation after a source build
   succeeds. A later ready deployment can be activated with
   `POST .../deployments/{deploymentID}/activate`.

While a source deployment is queued or running, the Console can stream its
bounded lifecycle messages from
`GET /v1/projects/{projectID}/sites/{siteID}/deployments/{deploymentID}/logs`.
The `after` query parameter is the last sequence received; messages are
ordered, capped, and secret-redacted before they are persisted.

## Git deployments

Use `POST /v1/projects/{projectID}/sites/{siteID}/deployments/git` with a JSON
body containing `repository`, `ref` (default `main`), `build_command`, and
optional `build_runtime`, `output_directory`, and `activate`. The first
release supports public HTTPS repositories on `github.com` and `gitlab.com`.
The API reconstructs the provider archive URL from validated components,
rejects redirects and private DNS addresses, bounds the download by
`SITES_MAX_ARTIFACT_SIZE`, and stores the resulting archive in the same
immutable source namespace as uploads. Provider archives are normalized by
removing their synthetic top-level directory before the isolated build runs.
Repository and ref metadata are retained on the deployment for auditability;
provider credentials and arbitrary clone URLs are intentionally unsupported.

The public route is `/v1/sites/{siteID}/{path}` (the empty path serves
`index.html`). It resolves the active deployment in PostgreSQL before opening a
file, rejects traversal and symlink components, and never exposes the private
artifact path or source archive. HTML is `no-cache`; other assets receive a
short public cache lifetime and the archive checksum is returned as an ETag.

## Custom domains

Create a binding with `POST /v1/projects/{projectID}/sites/{siteID}/domains`.
The response contains a TXT challenge at
`_stealth-verification.<hostname>`. Publish the returned value, then call the
`/{domainID}/verify` endpoint. Only `verified` domains resolve the original
`Host` header to the Site's active immutable deployment; unknown, disabled, or
unpublished hostnames return `404`.

TLS can be terminated in-process with the optional ACME manager. Set
`ACME_ENABLED=true`, a valid `ACME_EMAIL`, and persist `ACME_CERT_CACHE_DIR`.
The API listens on `ACME_TLS_ADDR` (default `:8443`) and serves HTTP-01
challenges on `ACME_HTTP_CHALLENGE_ADDR` (default `:8081`); route public ports
443 and 80 to those listeners or use a reverse proxy. The ACME directory
defaults to Let's Encrypt production and can be changed with
`ACME_DIRECTORY_URL` (for example, its staging directory during testing).
autocert renews certificates before expiry using the durable cache. Its host
policy queries PostgreSQL for a verified Site domain before both issuance and
challenge responses, and unknown hosts are rejected without contacting the CA.
`tls_status` reports `pending`, `active`, or `failed` transitions; an existing
active certificate is not downgraded by a transient renewal failure. With
ACME disabled, `tls_status` remains `external` for a reverse proxy or other
certificate manager.

## Limits and storage

`SITES_MAX_ARTIFACT_SIZE` limits compressed uploads and worker output streams.
`SITES_MAX_EXPANDED_BYTES` and `SITES_MAX_FILES` bound both source and output
extraction; `SITES_DEFAULT_QUOTA_BYTES` is the default per-Site expanded-byte
quota. `SITES_GIT_FETCH_CONCURRENCY` bounds simultaneous provider downloads
(default `4`) so a burst of authorized Git deployments cannot exhaust API
bandwidth or temporary storage. Source builds reserve up to the configured expanded limit while queued,
then release unused bytes on completion or failure. Quota accounting includes
every retained deployment, so remove old inactive releases after a successful
rollout. The storage layout is:

```text
${STORAGE_ROOT}/site-archives/   # retained source archives for builds
${STORAGE_ROOT}/sites/{project}/{site}/{deployment}/
```

Only API-owned UUIDv7 path segments are accepted by the stores. Untrusted
source archives and worker output reject absolute paths, `..` escapes,
duplicate entries, links, and special files. Site content is therefore served
as data and build commands run only in the hardened worker container, never in
the API process.

## Authorization

Console owners/admins can manage Sites. Server-to-server project keys use
independent `sites.read` and `sites.write` scopes; `sites.write` does not imply
`sites.read`. Public serving requires no project session, but a disabled Site,
missing active deployment, or deleted Site returns `404`.

Framework presets, edge/CDN caching, previews, and redirects remain separate
follow-up milestones. Custom domain resolution and certificate issuance are
layered on the immutable deployment contract without allowing arbitrary code
to run in the API process.
