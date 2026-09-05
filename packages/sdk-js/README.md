# Stealth JavaScript SDK

`StealthClient` is a small dependency-free browser client for the project
application Auth routes. It keeps the opaque project session in the browser's
HttpOnly cookie jar (`credentials: "include"`); it does not use localStorage,
sessionStorage, or accept a session secret.

```ts
import { StealthClient } from "./index";

// The same-origin host must expose the API's /v1 paths directly (for example,
// through a reverse proxy). Project application Auth uses its own cookie
// boundary and is never mixed with the Console session.
const client = new StealthClient({ endpoint: window.location.origin, projectID });
await client.account.create({ email, password, name });
await client.account.createEmailPasswordSession({ email, password });
const account = await client.account.get();
await client.account.createVerification(); // sends a one-time verification link
await client.account.confirmVerification(verificationToken);
await client.account.createRecovery({ email }); // always resolves with an accepted response
await client.account.confirmRecovery(recoveryToken, "new-correct-horse-battery");
await client.account.deleteSession();
const rows = await client.rows.list(databaseID, tableID, { limit: 20 });
await client.rows.create(databaseID, tableID, {
  data: { title: "hello" },
  read_permissions: ["users"],
  update_permissions: ["user:" + account.id],
  delete_permissions: ["user:" + account.id],
});
const file = await client.storage.files.upload(bucketID, {
  file: new File(["hello"], "hello.txt", { type: "text/plain" }),
});
const verifiedMetadata = await client.storage.files.get(bucketID, file.id);
const bytes = await client.storage.files.download(bucketID, file.id);
const execution = await client.functions.execute(functionID, {
  trigger: "http",
  input: { hello: "world" },
});
const events = client.realtime.subscribe({ events: ["database_row.create", "database_row.update"] });
events.addEventListener("database_row.create", (message) => {
  const event = JSON.parse((message as MessageEvent).data);
  console.log("new row", event.target.id);
});
// Close the stream when the application unmounts or logs out:
// events.close();
const publicURL = client.sites.url(siteID, "assets/app.js");
```

The endpoint may be same-origin with the browser application or be exposed by
an origin configured in the project's Auth settings. The API returns
credentialed CORS headers only for that exact HTTP(S) origin; wildcard and
arbitrary cross-origin requests are rejected. Custom Site domains are managed
from the server client and require a DNS TXT verification record before the
hostname serves the active release.
Ready but inactive Site deployments can be opened with `sites.previewURL`;
the preview remains unavailable after the Site is disabled.

## Server-side API-key client

`server.ts` is a separate server-only-oriented entry point for project
automation. Keep the API key in a server secret manager or environment
variable; never import this module into browser code, bundle the key, persist
it in localStorage, or log it.

```ts
import { createServerStealthClient } from "./server";

const client = createServerStealthClient({
  endpoint: process.env.STEALTH_API_URL!,
  projectID,
  apiKey: process.env.STEALTH_PROJECT_API_KEY!,
});
const page = await client.users.list({ limit: 20 }); // users.read
const user = await client.users.create({ email, password }); // users.write
await client.users.updateStatus(user.id, { status: "blocked" }); // users.write
await client.users.delete(user.id); // users.write
const databases = await client.databases.list(); // databases.read
const rows = await client.databases.rows.list(databaseID, tableID); // databases.read
await client.databases.rows.create(databaseID, tableID, { data: { title: "hello" } }); // databases.write
const fn = await client.functions.create({ // functions.write
  name: "welcome-email",
  runtime: "node-22",
  entrypoint: "src/main.js",
});
await client.functions.variables.create(fn.id, {
  key: "MAIL_TOKEN",
  value: process.env.MAIL_TOKEN!,
  kind: "secret",
  is_secret: true,
});
const deployment = await client.functions.deployments.upload(fn.id, {
  source: new Blob([sourceArchive]),
  filename: "source.zip",
});
await client.functions.deployments.activate(fn.id, deployment.id);
// Builds are asynchronous; poll deployments.get until build_status is
// "succeeded" before treating the active deployment as runnable.
const buildLogs = await client.functions.deployments.logs(fn.id, deployment.id, { after: 0 });
console.log(buildLogs.logs.map((entry) => `[${entry.level}] ${entry.message}`));
const execution = await client.functions.executions.create(fn.id, {
  trigger: "manual",
  input: { hello: "world" },
});
const logs = await client.functions.executions.logs(fn.id, execution.id);
const domain = await client.sites.domains.create(siteID, { hostname: "www.example.com" });
console.log(domain.verification_record_name, domain.verification_record_value);
await client.sites.domains.verify(siteID, domain.id);
const gitDeployment = await client.sites.deployments.fromGit(siteID, {
  repository: "https://github.com/acme/landing",
  ref: "main",
  buildRuntime: "node-22",
  buildCommand: "npm run build",
  outputDirectory: "dist",
});
// Poll deployments.get until build_status is "succeeded".
const siteBuildLogs = await client.sites.deployments.logs(siteID, gitDeployment.id, { after: 0 });
console.log(siteBuildLogs.logs.map((entry) => `[${entry.level}] ${entry.message}`));
const webhook = await client.webhooks.create({
  name: "orders",
  url: "https://hooks.example.com/stealth",
  events: ["database_row.create"],
});
// Store webhook.secret immediately; it is never returned by list/get.
const deliveries = await client.webhooks.deliveries(webhook.webhook.id);
```

`client.realtime.subscribe()` opens an authenticated Server-Sent Events
stream. Events are retained for seven days for cursor-based reconnects; an
application session receives only database row events allowed by its table and
row read grants. The server SDK exposes the same stream through
`await client.realtime.stream()` for trusted consumers and requires the
independent `realtime.read` API-key scope.

`client.account.createVerification()` and `confirmVerification(token)` manage
one-time email verification. `createRecovery({ email })` always resolves with
an accepted response, and `confirmRecovery(token, password)` consumes the link
and revokes every existing project session.

The browser client exposes application-facing file data only; bucket
management stays server-side. Its upload is multipart and the API streams it,
computes SHA-256, and returns metadata. Application callers may use
`storage.files.update` to rename a file when the effective update grant allows
it, but only Console members and server keys may change file grants. The
server client exposes bucket management and uses `storage.read` and
`storage.write` API-key scopes. Write does not implicitly grant read; grant
both scopes when an automation needs to list/fetch and mutate. API keys are
accepted only by the server-oriented client and are never returned by API
responses.

The Database core currently supports typed columns, key/unique/full-text
indexes, rows, equality filters, indexed search, bounded JSON/CSV export,
atomic row import and create/update/delete row transactions, enforced
many-to-one relationships, and permission grants
(`any`, `users`, and `user:<uuid>`). Relationship source values are target row
UUIDs; target deletion is restricted while a source row points at it.
The server client also exposes the Functions control plane with
`functions.read`/`functions.write`. Function variable values are write-only,
source archives are uploaded as multipart data, and one ready deployment can
be active at a time. Execution requests are queued for the isolated runtime
worker; the SDK never pretends to execute untrusted source in the API process.
Poll the execution record until it is `succeeded` or `failed`, then inspect
bounded output and redacted logs.
The Webhooks control plane uses independent `webhooks.read` and
`webhooks.write` scopes. Webhook secrets are encrypted at rest, returned only
on create/rotation, and deliveries are signed with HMAC-SHA256 by the trusted
worker. Configure endpoints with HTTPS and verify the timestamped raw request
body before accepting an event.
The Messaging control plane uses independent `messaging.read` and
`messaging.write` scopes. Provider credentials and subscriber addresses are
encrypted at rest; the SDK returns only provider metadata and masked subscriber
previews. `client.messaging` manages providers, topics, and subscribers. It
does not claim that a message was sent: provider adapters and the trusted
delivery worker are a separate deployment milestone.
The browser client also exposes a safe public URL helper for active Sites;
Site creation, uploads, Git deployments, activation, and deletion stay in the
server-only client because they require a project API key. Git deployments
accept only public HTTPS GitHub/GitLab repositories and run their build in the
same isolated worker as uploaded source archives.

Logical database backups are available from the server client through
`client.databases.backups`: create a bounded checksummed snapshot, download it,
restore it atomically, list metadata, or delete it. Backup blobs never expose
their local/S3 storage paths. Resumable uploads, image transforms, and
antivirus/CDN integration remain later milestones.
