import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import type { AgentRecord, AgentRole, AgentRunLogRecord, AgentRunRecord, AgentTool } from "@/features/agents/types";

const apiURL = process.env.STEALTH_API_URL ?? "http://127.0.0.1:8080";
const cookieName = process.env.STEALTH_SESSION_COOKIE_NAME ?? "stealth_session";

export type Account = { id: string; email: string; email_verified: boolean; created_at: string };
export type ConsoleSession = { id: string; is_current: boolean; expires_at: string; created_at: string };
export type Organization = { id: string; name: string; slug: string; created_at: string };
export type OrganizationMembership = { organization_id: string; account_id: string; email: string; role: "owner" | "admin" | "developer" | "viewer" | "billing"; created_at: string };
export type OrganizationMembershipRole = Exclude<OrganizationMembership["role"], "owner">;
export type OrganizationInvitationStatus = "pending" | "expired" | "accepted" | "revoked";
export type OrganizationInvitation = {
  id: string;
  organization_id: string;
  email: string;
  role: OrganizationMembershipRole;
  invited_by_account_id?: string;
  invited_by_email?: string;
  status: OrganizationInvitationStatus;
  expires_at: string;
  accepted_at?: string;
  revoked_at?: string;
  created_at: string;
};
export type OrganizationIncidentSeverity = "critical" | "warning" | "info";
export type OrganizationIncidentStatus = "investigating" | "identified" | "monitoring" | "resolved";
export type OrganizationIncidentUpdate = {
  id: string;
  incident_id: string;
  author_account_id?: string;
  author_email?: string;
  status: OrganizationIncidentStatus;
  message: string;
  created_at: string;
};
export type OrganizationIncident = {
  id: string;
  organization_id: string;
  created_by_account_id?: string;
  created_by_email?: string;
  title: string;
  severity: OrganizationIncidentSeverity;
  status: OrganizationIncidentStatus;
  services: string[];
  started_at: string;
  resolved_at?: string;
  updates: OrganizationIncidentUpdate[];
  created_at: string;
  updated_at: string;
};
export type OrganizationTrace = {
  id: string;
  trace_id: string;
  span_id?: string;
  organization_id?: string;
  project_id?: string;
  organization_name?: string;
  project_name?: string;
  service: string;
  method: string;
  route: string;
  status: number;
  duration_ms: number;
  response_bytes: number;
  started_at: string;
  finished_at: string;
  created_at: string;
};
export type OrganizationAuditEvent = {
  id: string;
  organization_id: string;
  actor_account_id?: string;
  actor_email?: string;
  action: string;
  target_type: string;
  target_id?: string;
  metadata: Record<string, unknown>;
  created_at: string;
};
export type Project = { id: string; organization_id: string; name: string; created_at: string };
export type { AgentRecord, AgentRunLogRecord, AgentRunRecord } from "@/features/agents/types";
export type CreateAgentInput = {
  project_id: string;
  name: string;
  description?: string;
  role: AgentRole;
  branch?: string;
  provider: string;
  model: string;
  current_task?: string | null;
  tools?: AgentTool[];
  instructions?: string | null;
};
export type UpdateAgentInput = Partial<Omit<CreateAgentInput, "project_id">>;
export type CreateAgentRunInput = { prompt: string };
export type ApplicationUser = {
  id: string;
  project_id: string;
  email: string;
  name: string | null;
  status: "active" | "blocked";
  email_verified: boolean;
  created_at: string;
  updated_at: string;
};
export type Pagination = { limit: number; next_cursor: string | null };
export type ProjectAuthSettings = {
  project_id: string;
  registration_enabled: boolean;
  cors_origins: string[];
  created_at: string;
  updated_at: string;
};
export type ProjectUsage = {
  project_id: string;
  captured_at: string;
  application_users: number;
  database_count: number;
  database_table_count: number;
  database_row_count: number;
  storage_file_count: number;
  storage_bytes: number;
  storage_quota_bytes: number;
  function_count: number;
  function_artifact_bytes: number;
  function_quota_bytes: number;
  site_count: number;
  site_artifact_bytes: number;
  site_reserved_bytes: number;
  site_quota_bytes: number;
  realtime_event_count: number;
  webhook_delivery_count_7d: number;
  api_request_count_30d: number;
  api_egress_bytes_30d: number;
  function_invocation_count_30d: number;
  function_failure_count_30d: number;
  function_compute_ms_30d: number;
};
export type ProjectUsageDay = {
  date: string;
  api_request_count: number;
  api_egress_bytes: number;
  function_invocation_count: number;
  function_failure_count: number;
  function_compute_ms: number;
};
export type ProjectUsageMetering = {
  project_id: string;
  from: string;
  to: string;
  days: ProjectUsageDay[];
  totals: ProjectUsageDay;
};
export type ProjectAPIKey = {
  id: string;
  project_id: string;
  name: string;
  prefix: string;
  scopes: ProjectAPIKeyScope[];
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};
export type ProjectAPIKeyScope = "users.read" | "users.write" | "databases.read" | "databases.write" | "storage.read" | "storage.write" | "functions.read" | "functions.write" | "sites.read" | "sites.write" | "webhooks.read" | "webhooks.write" | "realtime.read" | "messaging.read" | "messaging.write";
export type CreateProjectAPIKeyInput = {
  name: string;
  scopes: ProjectAPIKeyScope[];
  expires_at?: string | null;
};
export type ProjectWebhook = { id: string; project_id: string; name: string; url: string; events: string[]; enabled: boolean; failure_count: number; last_delivery_at: string | null; last_failure_at: string | null; created_at: string; updated_at: string };
export type ProjectWebhookDelivery = { id: string; webhook_id: string; event_id: string; event_name: string; status: "pending" | "running" | "succeeded" | "failed"; attempt_count: number; last_status_code: number | null; last_error: string | null; delivered_at: string | null; created_at: string; updated_at: string };
export type CreateProjectWebhookInput = { name: string; url: string; events?: string[]; enabled?: boolean };
export type UpdateProjectWebhookInput = Partial<CreateProjectWebhookInput>;
export type ProjectMessagingProvider = { id: string; project_id: string; name: string; channel: "email" | "sms" | "push"; provider: string; credentials_present: boolean; enabled: boolean; created_at: string; updated_at: string };
export type CreateProjectMessagingProviderInput = { name: string; channel: ProjectMessagingProvider["channel"]; provider: string; credentials?: Record<string, string>; enabled?: boolean };
export type UpdateProjectMessagingProviderInput = Partial<CreateProjectMessagingProviderInput>;
export type ProjectMessagingTopic = { id: string; project_id: string; name: string; description: string; enabled: boolean; subscriber_count: number; created_at: string; updated_at: string };
export type CreateProjectMessagingTopicInput = { name: string; description?: string; enabled?: boolean };
export type UpdateProjectMessagingTopicInput = Partial<CreateProjectMessagingTopicInput>;
export type ProjectMessagingSubscriber = { id: string; project_id: string; topic_id: string; channel: ProjectMessagingProvider["channel"]; address_preview: string; enabled: boolean; created_at: string; updated_at: string };
export type CreateProjectMessagingSubscriberInput = { channel: ProjectMessagingProvider["channel"]; address: string; enabled?: boolean };
export type ProjectMessagingMessage = { id: string; project_id: string; topic_id: string | null; channel: ProjectMessagingProvider["channel"]; status: "queued" | "processing" | "succeeded" | "failed" | "cancelled"; recipient_count: number; succeeded_count: number; failed_count: number; cancelled_at?: string; created_at: string; updated_at: string };
export type CreateProjectMessagingMessageInput = { topic_id: string; channel: ProjectMessagingProvider["channel"]; subject?: string; body: string; data?: Record<string, string> };
export type ProjectMessagingDelivery = { id: string; project_id: string; message_id: string; subscriber_id?: string; provider_id?: string; channel: ProjectMessagingProvider["channel"]; address_preview: string; status: "pending" | "running" | "succeeded" | "failed" | "cancelled"; attempt_count: number; last_status_code?: number; last_error?: string; delivered_at?: string; created_at: string; updated_at: string };

export type DatabaseColumnType = "varchar" | "text" | "integer" | "double" | "boolean" | "datetime" | "json";
export type DatabasePermission = "any" | "users" | `user:${string}`;
export type ProjectDatabase = { id: string; project_id: string; name: string; created_at: string; updated_at: string };
export type DatabaseTable = {
  id: string;
  database_id: string;
  project_id: string;
  name: string;
  row_security: boolean;
  create_permissions: string[];
  read_permissions: string[];
  update_permissions: string[];
  delete_permissions: string[];
  created_at: string;
  updated_at: string;
};
export type DatabaseColumn = { id: string; table_id: string; key: string; type: DatabaseColumnType; required: boolean; varchar_size?: number | null; default?: unknown; created_at: string; updated_at: string };
export type DatabaseIndex = { id: string; table_id: string; name: string; type: "key" | "unique"; column_keys: string[]; directions: Array<"asc" | "desc">; created_at: string; updated_at: string };
export type DatabaseRow = { id: string; table_id: string; project_id: string; data: Record<string, unknown>; read_permissions: string[]; update_permissions: string[]; delete_permissions: string[]; creator_project_user_id?: string; created_at: string; updated_at: string };
export type DatabasePage<T> = { pagination: Pagination; can_manage?: boolean } & Record<string, T[] | Pagination | boolean | undefined>;
export type CreateDatabaseTableInput = { name: string; row_security?: boolean; create_permissions?: string[]; read_permissions?: string[]; update_permissions?: string[]; delete_permissions?: string[] };
export type CreateDatabaseColumnInput = { key: string; type: DatabaseColumnType; required?: boolean; varchar_size?: number | null; default?: unknown };
export type CreateDatabaseIndexInput = { name: string; type: "key" | "unique"; column_keys: string[]; directions?: Array<"asc" | "desc"> };
export type CreateDatabaseRowInput = { data: Record<string, unknown>; read_permissions?: string[]; update_permissions?: string[]; delete_permissions?: string[] };
export type UpdateDatabaseRowInput = { data?: Record<string, unknown>; read_permissions?: string[]; update_permissions?: string[]; delete_permissions?: string[] };
export type StorageBucket = { id: string; project_id: string; name: string; file_security: boolean; create_permissions: string[]; read_permissions: string[]; update_permissions: string[]; delete_permissions: string[]; max_file_size_bytes: number; quota_bytes: number; used_bytes: number; created_at: string; updated_at: string };
export type StorageFile = { id: string; bucket_id: string; project_id: string; name: string; mime_type: string; size_bytes: number; checksum_sha256: string; read_permissions: string[]; update_permissions: string[]; delete_permissions: string[]; creator_project_user_id?: string; created_at: string; updated_at: string };
export type FunctionRuntime = "node-22" | "python-3.13" | "go-1.24";
export type ProjectFunction = {
  id: string;
  project_id: string;
  name: string;
  runtime: FunctionRuntime;
  entrypoint: string;
  commands: string;
  timeout_seconds: number;
  enabled: boolean;
  logging: boolean;
  execute_permissions: string[];
  description?: string;
  status: "active" | "disabled";
  artifact_quota_bytes: number;
  artifact_used_bytes: number;
  active_deployment_id?: string;
  created_at: string;
  updated_at: string;
};
export type FunctionDeploymentStatus = "queued" | "building" | "ready" | "active" | "superseded" | "failed" | "cancelled";
export type FunctionDeployment = {
  id: string;
  function_id: string;
  project_id: string;
  version: number;
  source: string;
  source_name?: string;
  size_bytes: number;
  checksum_sha256: string;
  status: FunctionDeploymentStatus;
  build_status: "queued" | "running" | "deferred" | "succeeded" | "failed";
  error_message?: string;
  created_by_account_id?: string;
  queued_at: string;
  build_started_at?: string;
  built_at?: string;
  activated_at?: string;
  finished_at?: string;
  created_at: string;
  updated_at: string;
};
export type FunctionVariable = {
  id: string;
  function_id: string;
  project_id: string;
  key: string;
  kind: "variable" | "secret";
  is_secret: boolean;
  has_value: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
};
export type FunctionExecution = {
  id: string;
  function_id: string;
  deployment_id: string;
  project_id: string;
  status: "accepted" | "running" | "succeeded" | "failed" | "cancelled";
  trigger: string;
  response_status?: number;
  error_message?: string;
  started_at?: string;
  finished_at?: string;
  created_at: string;
  updated_at: string;
};
export type SiteDeploymentStatus = "queued" | "ready" | "active" | "superseded" | "failed" | "cancelled";
export type ProjectSite = {
  id: string;
  project_id: string;
  name: string;
  framework: "static";
  enabled: boolean;
  status: "active" | "disabled";
  artifact_quota_bytes: number;
  artifact_used_bytes: number;
  artifact_reserved_bytes: number;
  active_deployment_id?: string;
  created_at: string;
  updated_at: string;
};
export type SiteDomain = {
  id: string;
  project_id: string;
  site_id: string;
  hostname: string;
  status: "pending" | "verified" | "disabled";
  verification_token: string;
  verification_record_name: string;
  verification_record_type: "TXT";
  verification_record_value: string;
  verified_at?: string;
  tls_status: "external" | "pending" | "active" | "failed";
  created_at: string;
  updated_at: string;
};
export type SiteDeployment = {
  id: string;
  site_id: string;
  project_id: string;
  version: number;
  source: string;
  source_name?: string;
  git_repository?: string;
  git_ref?: string;
  size_bytes: number;
  archive_size_bytes: number;
  checksum_sha256: string;
  status: SiteDeploymentStatus;
  build_runtime?: "node-22" | "python-3.13" | "go-1.24";
  build_command?: string;
  output_directory?: string;
  build_status: "queued" | "running" | "deferred" | "succeeded" | "failed";
  reserved_bytes?: number;
  activate_requested?: boolean;
  error_message?: string;
  created_by_account_id?: string;
  queued_at: string;
  build_started_at?: string;
  built_at?: string;
  activated_at?: string;
  finished_at?: string;
  created_at: string;
  updated_at: string;
};
export type CreateSiteGitDeploymentInput = {
  repository: string;
  ref?: string;
  build_runtime?: "node-22" | "python-3.13" | "go-1.24";
  build_command: string;
  output_directory?: string;
  activate?: boolean;
};

export class StealthAPIError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const store = await cookies();
  const token = store.get(cookieName)?.value;
  const headers = new Headers(init.headers);
  if (token) headers.set("cookie", `${cookieName}=${token}`);
  const response = await fetch(new URL(path, apiURL), { ...init, headers, cache: "no-store" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
    throw new StealthAPIError(response.status, payload?.error?.code ?? "upstream_error", payload?.error?.message ?? "Stealth API request failed");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const stealthAPI = {
  currentAccount: () => request<{ account: Account }>("/v1/account"),
  accountSessions: () => request<{ sessions: ConsoleSession[] }>("/v1/account/sessions"),
  revokeAccountSession: (sessionID: string) => request<void>(`/v1/account/sessions/${encodeURIComponent(sessionID)}`, { method: "DELETE" }),
  revokeOtherAccountSessions: () => request<{ revoked: number }>("/v1/account/sessions", { method: "DELETE" }),
  updateAccountPassword: (input: { current_password: string; password: string }) => request<{ sessions_revoked: number }>("/v1/account/password", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  organizations: (options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ organizations: Organization[]; pagination: Pagination }>(`/v1/organizations${query ? `?${query}` : ""}`);
  },
  updateOrganization: (organizationID: string, input: { name: string; slug: string }) =>
    request<{ organization: Organization }>(`/v1/organizations/${encodeURIComponent(organizationID)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  organizationMemberships: (organizationID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ memberships: OrganizationMembership[]; pagination: Pagination; can_manage: boolean }>(`/v1/organizations/${encodeURIComponent(organizationID)}/memberships${query ? `?${query}` : ""}`);
  },
  createOrganizationMembership: (organizationID: string, input: { email: string; role: OrganizationMembershipRole }) =>
    request<{ membership: OrganizationMembership }>(`/v1/organizations/${encodeURIComponent(organizationID)}/memberships`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  updateOrganizationMembership: (organizationID: string, accountID: string, role: OrganizationMembershipRole) =>
    request<{ membership: OrganizationMembership }>(`/v1/organizations/${encodeURIComponent(organizationID)}/memberships/${encodeURIComponent(accountID)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ role }) }),
  removeOrganizationMembership: (organizationID: string, accountID: string) =>
    request<void>(`/v1/organizations/${encodeURIComponent(organizationID)}/memberships/${encodeURIComponent(accountID)}`, { method: "DELETE" }),
  organizationInvitations: (organizationID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ invitations: OrganizationInvitation[]; pagination: Pagination; can_manage: boolean }>(`/v1/organizations/${encodeURIComponent(organizationID)}/invitations${query ? `?${query}` : ""}`);
  },
  createOrganizationInvitation: (organizationID: string, input: { email: string; role: OrganizationMembershipRole }) =>
    request<{ invitation: OrganizationInvitation; delivery: "sent" | "failed" }>(`/v1/organizations/${encodeURIComponent(organizationID)}/invitations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  revokeOrganizationInvitation: (organizationID: string, invitationID: string) =>
    request<void>(`/v1/organizations/${encodeURIComponent(organizationID)}/invitations/${encodeURIComponent(invitationID)}`, { method: "DELETE" }),
  organizationIncidents: (organizationID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ incidents: OrganizationIncident[]; pagination: Pagination; can_manage: boolean }>(`/v1/organizations/${encodeURIComponent(organizationID)}/incidents${query ? `?${query}` : ""}`);
  },
  organizationIncident: (organizationID: string, incidentID: string) =>
    request<{ incident: OrganizationIncident; can_manage: boolean }>(`/v1/organizations/${encodeURIComponent(organizationID)}/incidents/${encodeURIComponent(incidentID)}`),
  createOrganizationIncident: (organizationID: string, input: { title: string; severity: OrganizationIncidentSeverity; status?: OrganizationIncidentStatus; services: string[]; message?: string }) =>
    request<{ incident: OrganizationIncident }>(`/v1/organizations/${encodeURIComponent(organizationID)}/incidents`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  updateOrganizationIncident: (organizationID: string, incidentID: string, input: { title?: string; severity?: OrganizationIncidentSeverity; status?: OrganizationIncidentStatus; services?: string[]; message?: string }) =>
    request<{ incident: OrganizationIncident }>(`/v1/organizations/${encodeURIComponent(organizationID)}/incidents/${encodeURIComponent(incidentID)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  organizationTraces: (organizationID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ traces: OrganizationTrace[]; pagination: Pagination }>(`/v1/organizations/${encodeURIComponent(organizationID)}/traces${query ? `?${query}` : ""}`);
  },
  acceptOrganizationInvitation: (token: string) =>
    request<{ membership: OrganizationMembership }>("/v1/organization-invitations/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) }),
  organizationAuditEvents: (organizationID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ events: OrganizationAuditEvent[]; pagination: Pagination }>(`/v1/organizations/${encodeURIComponent(organizationID)}/audit-events${query ? `?${query}` : ""}`);
  },
  projects: (organizationID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ projects: Project[]; pagination: Pagination }>(`/v1/organizations/${encodeURIComponent(organizationID)}/projects${query ? `?${query}` : ""}`);
  },
  project: cache((projectID: string) => request<{ project: Project }>(`/v1/projects/${encodeURIComponent(projectID)}`)),
  updateProject: (projectID: string, input: { name: string }) =>
    request<{ project: Project }>(`/v1/projects/${encodeURIComponent(projectID)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  deleteProject: (projectID: string, confirmName: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm_name: confirmName }) }),
  projectAuditEvents: (projectID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ events: OrganizationAuditEvent[]; pagination: Pagination }>(`/v1/projects/${encodeURIComponent(projectID)}/audit-events${query ? `?${query}` : ""}`);
  },
  agents: (options: { limit?: number; cursor?: string; project_id?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    if (options.project_id) params.set("project_id", options.project_id);
    const query = params.toString();
    return request<{ agents: AgentRecord[]; pagination: Pagination }>(`/v1/agents${query ? `?${query}` : ""}`);
  },
  agent: cache((agentID: string) => request<{ agent: AgentRecord }>(`/v1/agents/${encodeURIComponent(agentID)}`)),
  createAgent: (input: CreateAgentInput) =>
    request<{ agent: AgentRecord }>("/v1/agents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  updateAgent: (agentID: string, input: UpdateAgentInput) =>
    request<{ agent: AgentRecord }>(`/v1/agents/${encodeURIComponent(agentID)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  deleteAgent: (agentID: string) => request<void>(`/v1/agents/${encodeURIComponent(agentID)}`, { method: "DELETE" }),
  agentRuns: (agentID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ runs: AgentRunRecord[]; pagination: Pagination }>(`/v1/agents/${encodeURIComponent(agentID)}/runs${query ? `?${query}` : ""}`);
  },
  agentRun: (agentID: string, runID: string) =>
    request<{ run: AgentRunRecord }>(`/v1/agents/${encodeURIComponent(agentID)}/runs/${encodeURIComponent(runID)}`),
  createAgentRun: (agentID: string, input: CreateAgentRunInput) =>
    request<{ run: AgentRunRecord }>(`/v1/agents/${encodeURIComponent(agentID)}/runs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  cancelAgentRun: (agentID: string, runID: string) =>
    request<{ run: AgentRunRecord }>(`/v1/agents/${encodeURIComponent(agentID)}/runs/${encodeURIComponent(runID)}/cancel`, { method: "POST" }),
  agentRunLogs: (agentID: string, runID: string, options: { limit?: number; after?: number } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.after !== undefined) params.set("after", String(options.after));
    const query = params.toString();
    return request<{ logs: AgentRunLogRecord[]; pagination: Pagination }>(`/v1/agents/${encodeURIComponent(agentID)}/runs/${encodeURIComponent(runID)}/logs${query ? `?${query}` : ""}`);
  },
  projectUsers: (projectID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ users: ApplicationUser[]; pagination: Pagination; can_manage: boolean }>(`/v1/projects/${encodeURIComponent(projectID)}/users${query ? `?${query}` : ""}`);
  },
  deleteProjectUser: (projectID: string, userID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/users/${encodeURIComponent(userID)}`, { method: "DELETE" }),
  projectAuthSettings: (projectID: string) =>
    request<{ settings: ProjectAuthSettings; can_manage: boolean }>(`/v1/projects/${encodeURIComponent(projectID)}/auth/settings`),
  projectUsage: (projectID: string) =>
    request<{ usage: ProjectUsage }>(`/v1/projects/${encodeURIComponent(projectID)}/usage`),
  projectUsageMetering: (projectID: string, options: { from?: string; to?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.from) params.set("from", options.from);
    if (options.to) params.set("to", options.to);
    const query = params.toString();
    return request<{ metering: ProjectUsageMetering }>(`/v1/projects/${encodeURIComponent(projectID)}/usage/metering${query ? `?${query}` : ""}`);
  },
  projectAPIKeys: (projectID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ keys: ProjectAPIKey[]; pagination: Pagination; can_manage: boolean }>(`/v1/projects/${encodeURIComponent(projectID)}/api-keys${query ? `?${query}` : ""}`);
  },
  projectAPIKey: (projectID: string, keyID: string) =>
    request<{ key: ProjectAPIKey }>(`/v1/projects/${encodeURIComponent(projectID)}/api-keys/${encodeURIComponent(keyID)}`),
  createProjectAPIKey: (projectID: string, input: CreateProjectAPIKeyInput) =>
    request<{ key: ProjectAPIKey; secret: string }>(`/v1/projects/${encodeURIComponent(projectID)}/api-keys`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  revokeProjectAPIKey: (projectID: string, keyID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/api-keys/${encodeURIComponent(keyID)}`, { method: "DELETE" }),
  projectWebhooks: (projectID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ webhooks: ProjectWebhook[]; pagination: Pagination; can_manage: boolean }>(`/v1/projects/${encodeURIComponent(projectID)}/webhooks${query ? `?${query}` : ""}`);
  },
  projectWebhook: (projectID: string, webhookID: string) =>
    request<{ webhook: ProjectWebhook }>(`/v1/projects/${encodeURIComponent(projectID)}/webhooks/${encodeURIComponent(webhookID)}`),
  createProjectWebhook: (projectID: string, input: CreateProjectWebhookInput) =>
    request<{ webhook: ProjectWebhook; secret: string }>(`/v1/projects/${encodeURIComponent(projectID)}/webhooks`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  updateProjectWebhook: (projectID: string, webhookID: string, input: UpdateProjectWebhookInput) =>
    request<{ webhook: ProjectWebhook }>(`/v1/projects/${encodeURIComponent(projectID)}/webhooks/${encodeURIComponent(webhookID)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  rotateProjectWebhookSecret: (projectID: string, webhookID: string) =>
    request<{ webhook: ProjectWebhook; secret: string }>(`/v1/projects/${encodeURIComponent(projectID)}/webhooks/${encodeURIComponent(webhookID)}/rotate-secret`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }),
  deleteProjectWebhook: (projectID: string, webhookID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/webhooks/${encodeURIComponent(webhookID)}`, { method: "DELETE" }),
  projectWebhookDeliveries: (projectID: string, webhookID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ deliveries: ProjectWebhookDelivery[]; pagination: Pagination }>(`/v1/projects/${encodeURIComponent(projectID)}/webhooks/${encodeURIComponent(webhookID)}/deliveries${query ? `?${query}` : ""}`);
  },
  projectMessagingProviders: (projectID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ providers: ProjectMessagingProvider[]; pagination: Pagination; can_manage: boolean }>(`/v1/projects/${encodeURIComponent(projectID)}/messaging/providers${query ? `?${query}` : ""}`);
  },
  projectMessagingProvider: (projectID: string, providerID: string) =>
    request<{ provider: ProjectMessagingProvider }>(`/v1/projects/${encodeURIComponent(projectID)}/messaging/providers/${encodeURIComponent(providerID)}`),
  createProjectMessagingProvider: (projectID: string, input: CreateProjectMessagingProviderInput) =>
    request<{ provider: ProjectMessagingProvider }>(`/v1/projects/${encodeURIComponent(projectID)}/messaging/providers`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  updateProjectMessagingProvider: (projectID: string, providerID: string, input: UpdateProjectMessagingProviderInput) =>
    request<{ provider: ProjectMessagingProvider }>(`/v1/projects/${encodeURIComponent(projectID)}/messaging/providers/${encodeURIComponent(providerID)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  deleteProjectMessagingProvider: (projectID: string, providerID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/messaging/providers/${encodeURIComponent(providerID)}`, { method: "DELETE" }),
  projectMessagingTopics: (projectID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ topics: ProjectMessagingTopic[]; pagination: Pagination; can_manage: boolean }>(`/v1/projects/${encodeURIComponent(projectID)}/messaging/topics${query ? `?${query}` : ""}`);
  },
  projectMessagingTopic: (projectID: string, topicID: string) =>
    request<{ topic: ProjectMessagingTopic }>(`/v1/projects/${encodeURIComponent(projectID)}/messaging/topics/${encodeURIComponent(topicID)}`),
  createProjectMessagingTopic: (projectID: string, input: CreateProjectMessagingTopicInput) =>
    request<{ topic: ProjectMessagingTopic }>(`/v1/projects/${encodeURIComponent(projectID)}/messaging/topics`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  updateProjectMessagingTopic: (projectID: string, topicID: string, input: UpdateProjectMessagingTopicInput) =>
    request<{ topic: ProjectMessagingTopic }>(`/v1/projects/${encodeURIComponent(projectID)}/messaging/topics/${encodeURIComponent(topicID)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  deleteProjectMessagingTopic: (projectID: string, topicID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/messaging/topics/${encodeURIComponent(topicID)}`, { method: "DELETE" }),
  projectMessagingSubscribers: (projectID: string, topicID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ subscribers: ProjectMessagingSubscriber[]; pagination: Pagination; can_manage: boolean }>(`/v1/projects/${encodeURIComponent(projectID)}/messaging/topics/${encodeURIComponent(topicID)}/subscribers${query ? `?${query}` : ""}`);
  },
  projectMessagingSubscriber: (projectID: string, topicID: string, subscriberID: string) =>
    request<{ subscriber: ProjectMessagingSubscriber }>(`/v1/projects/${encodeURIComponent(projectID)}/messaging/topics/${encodeURIComponent(topicID)}/subscribers/${encodeURIComponent(subscriberID)}`),
  createProjectMessagingSubscriber: (projectID: string, topicID: string, input: CreateProjectMessagingSubscriberInput) =>
    request<{ subscriber: ProjectMessagingSubscriber }>(`/v1/projects/${encodeURIComponent(projectID)}/messaging/topics/${encodeURIComponent(topicID)}/subscribers`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  deleteProjectMessagingSubscriber: (projectID: string, topicID: string, subscriberID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/messaging/topics/${encodeURIComponent(topicID)}/subscribers/${encodeURIComponent(subscriberID)}`, { method: "DELETE" }),
  projectMessagingMessages: (projectID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ messages: ProjectMessagingMessage[]; pagination: Pagination; can_manage: boolean }>(`/v1/projects/${encodeURIComponent(projectID)}/messaging/messages${query ? `?${query}` : ""}`);
  },
  projectMessagingMessage: (projectID: string, messageID: string) =>
    request<{ message: ProjectMessagingMessage }>(`/v1/projects/${encodeURIComponent(projectID)}/messaging/messages/${encodeURIComponent(messageID)}`),
  createProjectMessagingMessage: (projectID: string, input: CreateProjectMessagingMessageInput, idempotencyKey?: string) =>
    request<{ message: ProjectMessagingMessage }>(`/v1/projects/${encodeURIComponent(projectID)}/messaging/messages`, { method: "POST", headers: { "content-type": "application/json", ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}) }, body: JSON.stringify(input) }),
  cancelProjectMessagingMessage: (projectID: string, messageID: string) =>
    request<{ message: ProjectMessagingMessage }>(`/v1/projects/${encodeURIComponent(projectID)}/messaging/messages/${encodeURIComponent(messageID)}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }),
  projectMessagingDeliveries: (projectID: string, messageID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ deliveries: ProjectMessagingDelivery[]; pagination: Pagination }>(`/v1/projects/${encodeURIComponent(projectID)}/messaging/messages/${encodeURIComponent(messageID)}/deliveries${query ? `?${query}` : ""}`);
  },
  projectDatabases: (projectID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ databases: ProjectDatabase[]; pagination: Pagination; can_manage: boolean }>(`/v1/projects/${encodeURIComponent(projectID)}/databases${query ? `?${query}` : ""}`);
  },
  projectDatabase: (projectID: string, databaseID: string) => request<{ database: ProjectDatabase }>(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}`),
  createProjectDatabase: (projectID: string, input: { name: string }) => request<{ database: ProjectDatabase }>(`/v1/projects/${encodeURIComponent(projectID)}/databases`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  deleteProjectDatabase: (projectID: string, databaseID: string) => request<void>(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}`, { method: "DELETE" }),
  projectStorageBuckets: (projectID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ buckets: StorageBucket[]; pagination: Pagination; can_manage: boolean }>(`/v1/projects/${encodeURIComponent(projectID)}/storage/buckets${query ? `?${query}` : ""}`);
  },
  projectStorageBucket: (projectID: string, bucketID: string) => request<{ bucket: StorageBucket }>(`/v1/projects/${encodeURIComponent(projectID)}/storage/buckets/${encodeURIComponent(bucketID)}`),
  createProjectStorageBucket: (projectID: string, input: { name: string; file_security?: boolean; create_permissions?: string[]; read_permissions?: string[]; update_permissions?: string[]; delete_permissions?: string[]; max_file_size_bytes?: number; quota_bytes?: number }) => request<{ bucket: StorageBucket }>(`/v1/projects/${encodeURIComponent(projectID)}/storage/buckets`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  updateProjectStorageBucket: (projectID: string, bucketID: string, input: Partial<{ name: string; file_security: boolean; create_permissions: string[]; read_permissions: string[]; update_permissions: string[]; delete_permissions: string[]; max_file_size_bytes: number; quota_bytes: number }>) => request<{ bucket: StorageBucket }>(`/v1/projects/${encodeURIComponent(projectID)}/storage/buckets/${encodeURIComponent(bucketID)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  deleteProjectStorageBucket: (projectID: string, bucketID: string) => request<void>(`/v1/projects/${encodeURIComponent(projectID)}/storage/buckets/${encodeURIComponent(bucketID)}`, { method: "DELETE" }),
  projectFunctions: (projectID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ functions: ProjectFunction[]; pagination: Pagination; can_manage: boolean }>(`/v1/projects/${encodeURIComponent(projectID)}/functions${query ? `?${query}` : ""}`);
  },
  projectFunctionDeployments: (projectID: string, functionID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ deployments: FunctionDeployment[]; pagination: Pagination; can_manage: boolean }>(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}/deployments${query ? `?${query}` : ""}`);
  },
  projectFunctionExecutions: (projectID: string, functionID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ executions: FunctionExecution[]; pagination: Pagination }>(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}/executions${query ? `?${query}` : ""}`);
  },
  projectSites: (projectID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ sites: ProjectSite[]; pagination: Pagination; can_manage: boolean }>(`/v1/projects/${encodeURIComponent(projectID)}/sites${query ? `?${query}` : ""}`);
  },
  projectSiteDeployments: (projectID: string, siteID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ deployments: SiteDeployment[]; pagination: Pagination; can_manage: boolean }>(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}/deployments${query ? `?${query}` : ""}`);
  },
  projectSiteDomains: (projectID: string, siteID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ domains: SiteDomain[]; pagination: Pagination; can_manage: boolean }>(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}/domains${query ? `?${query}` : ""}`);
  },
  createProjectSiteDomain: (projectID: string, siteID: string, input: { hostname: string }) => request<{ domain: SiteDomain }>(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}/domains`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  verifyProjectSiteDomain: (projectID: string, siteID: string, domainID: string) => request<{ domain: SiteDomain }>(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}/domains/${encodeURIComponent(domainID)}/verify`, { method: "POST" }),
  deleteProjectSiteDomain: (projectID: string, siteID: string, domainID: string) => request<void>(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}/domains/${encodeURIComponent(domainID)}`, { method: "DELETE" }),
  createProjectSiteGitDeployment: (projectID: string, siteID: string, input: CreateSiteGitDeploymentInput) => request<{ deployment: SiteDeployment }>(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}/deployments/git`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  projectFunction: (projectID: string, functionID: string) => request<{ function: ProjectFunction }>(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}`),
  projectDatabaseTables: (projectID: string, databaseID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ tables: DatabaseTable[]; pagination: Pagination; can_manage: boolean }>(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables${query ? `?${query}` : ""}`);
  },
  projectDatabaseTable: (projectID: string, databaseID: string, tableID: string) => request<{ table: DatabaseTable }>(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}`),
  createProjectDatabaseTable: (projectID: string, databaseID: string, input: CreateDatabaseTableInput) => request<{ table: DatabaseTable }>(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  updateProjectDatabaseTable: (projectID: string, databaseID: string, tableID: string, input: CreateDatabaseTableInput) => request<{ table: DatabaseTable }>(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  deleteProjectDatabaseTable: (projectID: string, databaseID: string, tableID: string) => request<void>(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}`, { method: "DELETE" }),
  projectDatabaseColumns: (projectID: string, databaseID: string, tableID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ columns: DatabaseColumn[]; pagination: Pagination }>(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/columns${query ? `?${query}` : ""}`);
  },
  createProjectDatabaseColumn: (projectID: string, databaseID: string, tableID: string, input: CreateDatabaseColumnInput) => request<{ column: DatabaseColumn }>(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/columns`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  deleteProjectDatabaseColumn: (projectID: string, databaseID: string, tableID: string, columnID: string) => request<void>(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/columns/${encodeURIComponent(columnID)}`, { method: "DELETE" }),
  projectDatabaseIndexes: (projectID: string, databaseID: string, tableID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request<{ indexes: DatabaseIndex[]; pagination: Pagination }>(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/indexes${query ? `?${query}` : ""}`);
  },
  createProjectDatabaseIndex: (projectID: string, databaseID: string, tableID: string, input: CreateDatabaseIndexInput) => request<{ index: DatabaseIndex }>(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/indexes`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  deleteProjectDatabaseIndex: (projectID: string, databaseID: string, tableID: string, indexID: string) => request<void>(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/indexes/${encodeURIComponent(indexID)}`, { method: "DELETE" }),
  projectDatabaseRows: (projectID: string, databaseID: string, tableID: string, options: { limit?: number; cursor?: string; order_by?: string; order_direction?: "asc" | "desc"; filters?: Record<string, string> } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    if (options.order_by) params.set("order_by", options.order_by);
    if (options.order_direction) params.set("order_direction", options.order_direction);
    for (const [key, value] of Object.entries(options.filters ?? {})) params.set(`filter.${key}`, value);
    const query = params.toString();
    return request<{ rows: DatabaseRow[]; pagination: Pagination }>(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows${query ? `?${query}` : ""}`);
  },
  projectDatabaseRow: (projectID: string, databaseID: string, tableID: string, rowID: string) => request<{ row: DatabaseRow }>(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows/${encodeURIComponent(rowID)}`),
  createProjectDatabaseRow: (projectID: string, databaseID: string, tableID: string, input: CreateDatabaseRowInput) => request<{ row: DatabaseRow }>(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  updateProjectDatabaseRow: (projectID: string, databaseID: string, tableID: string, rowID: string, input: UpdateDatabaseRowInput) => request<{ row: DatabaseRow }>(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows/${encodeURIComponent(rowID)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  deleteProjectDatabaseRow: (projectID: string, databaseID: string, tableID: string, rowID: string) => request<void>(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows/${encodeURIComponent(rowID)}`, { method: "DELETE" }),
};
