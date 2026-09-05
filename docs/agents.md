# Agent configuration

Stealth Agents are project-scoped coding-agent configurations. The current
control plane stores the identity and execution policy; it does not claim to
run a model until a provider connection and trusted execution worker are
configured.

## Console API

All routes require the Console `stealth_session` cookie:

```text
GET    /v1/agent-catalog
GET    /v1/agents?limit=20&project_id=<optional-project-id>
POST   /v1/agents
GET    /v1/agents/<agent-id>
PATCH  /v1/agents/<agent-id>
DELETE /v1/agents/<agent-id>
GET    /v1/agents/<agent-id>/runs?limit=20&cursor=<optional-run-id>
POST   /v1/agents/<agent-id>/runs
GET    /v1/agents/<agent-id>/runs/<run-id>
POST   /v1/agents/<agent-id>/runs/<run-id>/cancel
GET    /v1/agents/<agent-id>/runs/<run-id>/logs?after=0
```

An agent belongs to one project. Any project member may read its configuration;
only organization owners and admins may create, update, or delete it. A caller
from another tenant receives a hidden-resource `404` for reads and writes.

Create an agent with JSON:

```json
{
  "project_id": "018f27e3-5d1a-7c44-ae35-1db4ea12e6d2",
  "name": "Frontend Engineer",
  "description": "Build and review the web console.",
  "role": "Frontend",
  "branch": "main",
  "provider": "openai",
  "model": "GPT-5.6",
  "tools": ["Read files", "Search code", "Edit files", "Run tests"],
  "instructions": "Inspect the repository before editing."
}
```

The supported roles are `General`, `Frontend`, `Reviewer`, and
`Documentation`. Tool values are `Read files`, `Search code`, `Edit files`,
`Terminal`, `Run tests`, and `Git diff`. Provider credentials, secrets, and
run/chat history are never part of the configuration response.

`GET /v1/agent-catalog` is the source of truth for provider IDs and model
options shown by the Console. The API returns only public metadata and the
current execution boundary (`queue_only`, `ready: false` on this release).
Deployments may replace the default catalog with the JSON
`AGENT_PROVIDER_CATALOG` setting; that setting must contain provider `id`,
display `name`, and a non-empty `models` array, and must never contain API
keys or other credentials.

The `/agent` Console page uses the API for roster, project selection, create,
delete, Settings writes, and run history. Posting a prompt creates a durable
`queued` run and the workspace polls its status; it never presents local
timers or fabricated file changes. A trusted worker can claim queued runs,
append logs, and persist terminal output/steps/changes through the repository
worker primitives. Provider execution remains a separate connection/worker
milestone, so queued runs stay honest until that capability is configured.
