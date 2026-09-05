import { z } from "zod";

/**
 * Browser-side management API client.
 *
 * The Vite console uses relative `/v1` requests by default and sends the
 * HttpOnly Console session cookie with `credentials: include`. `VITE_API_URL`
 * is only needed when the static console is hosted on a different origin from
 * Go.
 */

const accountSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  email_verified: z.boolean(),
  created_at: z.string(),
});

const consoleSessionSchema = z.object({
  id: z.string(),
  is_current: z.boolean(),
  expires_at: z.string(),
  created_at: z.string(),
});

const organizationMembershipRoleSchema = z.enum(["owner", "admin", "developer", "viewer", "billing"]);
const organizationMembershipManageRoleSchema = z.enum(["admin", "developer", "viewer", "billing"]);
const organizationMembershipSchema = z.object({
  organization_id: z.string(),
  account_id: z.string(),
  email: z.string().email(),
  role: organizationMembershipRoleSchema,
  created_at: z.string(),
});
const organizationInvitationSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  email: z.string().email(),
  role: organizationMembershipManageRoleSchema,
  invited_by_account_id: z.string().optional(),
  invited_by_email: z.string().email().optional(),
  status: z.enum(["pending", "expired", "accepted", "revoked"]),
  expires_at: z.string(),
  accepted_at: z.string().optional(),
  revoked_at: z.string().optional(),
  created_at: z.string(),
});
const organizationAuditEventSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  actor_account_id: z.string().optional(),
  actor_email: z.string().email().optional(),
  action: z.string(),
  target_type: z.string(),
  target_id: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string(),
});

const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  created_at: z.string(),
});

const projectSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  name: z.string(),
  created_at: z.string(),
});
const projectServiceLayoutSchema = z.object({
  project_id: z.string(),
  resource_type: z.enum(["function", "site", "database", "storage"]),
  resource_id: z.string(),
  x: z.number().int(),
  y: z.number().int(),
  updated_at: z.string(),
});

const paginationSchema = z.object({
  limit: z.number(),
  next_cursor: z.string().nullable(),
});

const accountResponseSchema = z.object({ account: accountSchema });
const registrationResponseSchema = z.object({ account: accountSchema, organization: organizationSchema });
const organizationsResponseSchema = z.object({
  organizations: z.array(organizationSchema),
  pagination: paginationSchema,
});
const projectsResponseSchema = z.object({
  projects: z.array(projectSchema),
  pagination: paginationSchema,
});
const projectUsageSchema = z.object({
  project_id: z.string(),
  captured_at: z.string(),
  application_users: z.number(),
  database_count: z.number(),
  database_table_count: z.number(),
  database_row_count: z.number(),
  storage_file_count: z.number(),
  storage_bytes: z.number(),
  storage_quota_bytes: z.number(),
  function_count: z.number(),
  function_artifact_bytes: z.number(),
  function_quota_bytes: z.number(),
  site_count: z.number(),
  site_artifact_bytes: z.number(),
  site_reserved_bytes: z.number(),
  site_quota_bytes: z.number(),
  realtime_event_count: z.number(),
  webhook_delivery_count_7d: z.number(),
  api_request_count_30d: z.number(),
  api_egress_bytes_30d: z.number(),
  function_invocation_count_30d: z.number(),
  function_failure_count_30d: z.number(),
  function_compute_ms_30d: z.number(),
}).passthrough();
const projectUsageDaySchema = z.object({
  date: z.string(),
  api_request_count: z.number(),
  api_egress_bytes: z.number(),
  function_invocation_count: z.number(),
  function_failure_count: z.number(),
  function_compute_ms: z.number(),
});
const projectUsageMeteringSchema = z.object({
  project_id: z.string(),
  from: z.string(),
  to: z.string(),
  days: z.array(projectUsageDaySchema),
  totals: projectUsageDaySchema,
});
const applicationUserSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  status: z.enum(["active", "blocked"]),
  email_verified: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
const projectAuthSettingsSchema = z.object({
  project_id: z.string(),
  registration_enabled: z.boolean(),
  cors_origins: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
});
const projectAPIKeyScopeSchema = z.enum([
  "users.read",
  "users.write",
  "databases.read",
  "databases.write",
  "storage.read",
  "storage.write",
  "functions.read",
  "functions.write",
  "sites.read",
  "sites.write",
  "webhooks.read",
  "webhooks.write",
  "realtime.read",
  "messaging.read",
  "messaging.write",
]);
const projectAPIKeySchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  prefix: z.string(),
  scopes: z.array(projectAPIKeyScopeSchema),
  expires_at: z.string().nullable(),
  revoked_at: z.string().nullable(),
  last_used_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
const projectWebhookSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  url: z.string().url(),
  events: z.array(z.string()),
  enabled: z.boolean(),
  failure_count: z.number(),
  last_delivery_at: z.string().nullable().optional(),
  last_failure_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
const projectWebhookDeliverySchema = z.object({
  id: z.string(),
  webhook_id: z.string(),
  event_id: z.string(),
  event_name: z.string(),
  status: z.enum(["pending", "running", "succeeded", "failed"]),
  attempt_count: z.number(),
  last_status_code: z.number().nullable().optional(),
  last_error: z.string().nullable().optional(),
  delivered_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
const projectDatabaseSchema = z.object({ id: z.string(), project_id: z.string(), name: z.string(), created_at: z.string(), updated_at: z.string() });
const databaseTableSchema = z.object({
  id: z.string(),
  database_id: z.string(),
  project_id: z.string(),
  name: z.string(),
  row_security: z.boolean(),
  create_permissions: z.array(z.string()),
  read_permissions: z.array(z.string()),
  update_permissions: z.array(z.string()),
  delete_permissions: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
});
const databaseColumnTypeSchema = z.enum(["varchar", "text", "integer", "double", "boolean", "datetime", "json"]);
const databaseColumnSchema = z.object({
  id: z.string(),
  table_id: z.string(),
  key: z.string(),
  type: databaseColumnTypeSchema,
  required: z.boolean(),
  varchar_size: z.number().nullable().optional(),
  default: z.unknown().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
const databaseIndexSchema = z.object({
  id: z.string(),
  table_id: z.string(),
  name: z.string(),
  type: z.enum(["key", "unique"]),
  column_keys: z.array(z.string()),
  directions: z.array(z.enum(["asc", "desc"])),
  created_at: z.string(),
  updated_at: z.string(),
});
const databaseRowSchema = z.object({
  id: z.string(),
  table_id: z.string(),
  project_id: z.string(),
  data: z.record(z.string(), z.unknown()),
  read_permissions: z.array(z.string()),
  update_permissions: z.array(z.string()),
  delete_permissions: z.array(z.string()),
  creator_project_user_id: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
const storageBucketSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  file_security: z.boolean(),
  create_permissions: z.array(z.string()),
  read_permissions: z.array(z.string()),
  update_permissions: z.array(z.string()),
  delete_permissions: z.array(z.string()),
  max_file_size_bytes: z.number(),
  quota_bytes: z.number(),
  used_bytes: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
const storageFileSchema = z.object({
  id: z.string(),
  bucket_id: z.string(),
  project_id: z.string(),
  name: z.string(),
  mime_type: z.string(),
  size_bytes: z.number(),
  checksum_sha256: z.string(),
  read_permissions: z.array(z.string()),
  update_permissions: z.array(z.string()),
  delete_permissions: z.array(z.string()),
  creator_project_user_id: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
const functionRuntimeSchema = z.enum(["node-22", "python-3.13", "go-1.24"]);
const functionSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  runtime: functionRuntimeSchema,
  entrypoint: z.string(),
  commands: z.string(),
  timeout_seconds: z.number(),
  enabled: z.boolean(),
  logging: z.boolean(),
  execute_permissions: z.array(z.string()),
  description: z.string().nullable().optional(),
  status: z.enum(["active", "disabled"]),
  artifact_quota_bytes: z.number(),
  artifact_used_bytes: z.number(),
  artifact_reserved_bytes: z.number(),
  active_deployment_id: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
const functionVariableSchema = z.object({
  id: z.string(),
  function_id: z.string(),
  project_id: z.string(),
  key: z.string(),
  kind: z.enum(["variable", "secret"]),
  is_secret: z.boolean(),
  has_value: z.boolean(),
  description: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
const functionExecutionSchema = z.object({
  id: z.string(),
  function_id: z.string(),
  deployment_id: z.string(),
  project_id: z.string(),
  status: z.enum(["accepted", "running", "succeeded", "failed", "cancelled"]),
  trigger: z.string(),
  response_status: z.number().nullable().optional(),
  error_message: z.string().nullable().optional(),
  started_at: z.string().nullable().optional(),
  finished_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
const siteSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  framework: z.literal("static"),
  enabled: z.boolean(),
  status: z.enum(["active", "disabled"]),
  artifact_quota_bytes: z.number(),
  artifact_used_bytes: z.number(),
  artifact_reserved_bytes: z.number(),
  active_deployment_id: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
const siteDomainSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  site_id: z.string(),
  hostname: z.string(),
  status: z.enum(["pending", "verified", "disabled"]),
  verification_token: z.string(),
  verification_record_name: z.string(),
  verification_record_type: z.literal("TXT"),
  verification_record_value: z.string(),
  verified_at: z.string().nullable().optional(),
  tls_status: z.enum(["external", "pending", "active", "failed"]),
  created_at: z.string(),
  updated_at: z.string(),
});
const deploymentSchema = z.object({
  id: z.string(),
  version: z.number(),
  source: z.string(),
  source_name: z.string().nullable().optional(),
  status: z.string(),
  build_status: z.string(),
  error_message: z.string().nullable().optional(),
  created_at: z.string(),
  activated_at: z.string().nullable().optional(),
}).passthrough();
const incidentSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  title: z.string(),
  severity: z.enum(["critical", "warning", "info"]),
  status: z.enum(["investigating", "identified", "monitoring", "resolved"]),
  services: z.array(z.string()),
  started_at: z.string(),
  resolved_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();
const functionExecutionLogSchema = z.object({
  id: z.string(),
  execution_id: z.string(),
  function_id: z.string(),
  project_id: z.string(),
  sequence: z.number(),
  level: z.string(),
  message: z.string(),
  created_at: z.string(),
}).passthrough();
const functionBuildLogSchema = z.object({
  id: z.string(),
  deployment_id: z.string(),
  function_id: z.string(),
  project_id: z.string(),
  sequence: z.number(),
  level: z.string(),
  message: z.string(),
  created_at: z.string(),
}).passthrough();
const siteBuildLogSchema = z.object({
  id: z.string(),
  deployment_id: z.string(),
  site_id: z.string(),
  project_id: z.string(),
  sequence: z.number(),
  level: z.string(),
  message: z.string(),
  created_at: z.string(),
}).passthrough();
const traceSchema = z.object({
  id: z.string(),
  trace_id: z.string(),
  service: z.string(),
  method: z.string(),
  route: z.string(),
  status: z.number(),
  duration_ms: z.number(),
  response_bytes: z.number(),
  started_at: z.string(),
}).passthrough();
const agentRoleSchema = z.enum(["General", "Frontend", "Reviewer", "Documentation"]);
const agentStatusSchema = z.enum(["active", "running", "idle"]);
const agentToolSchema = z.enum(["Read files", "Search code", "Edit files", "Terminal", "Run tests", "Git diff"]);
const agentStepSchema = z.object({ id: z.string(), type: z.string(), label: z.string(), target: z.string(), status: z.string() }).passthrough();
const agentChangeSchema = z.object({ path: z.string(), additions: z.number(), deletions: z.number(), status: z.string() }).passthrough();
const agentSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  project_name: z.string(),
  name: z.string(),
  description: z.string(),
  role: agentRoleSchema,
  status: agentStatusSchema,
  branch: z.string(),
  provider: z.string(),
  model: z.string(),
  current_task: z.string().nullable().optional(),
  last_active_at: z.string().nullable().optional(),
  tools: z.array(agentToolSchema),
  instructions: z.string().nullable().optional(),
  created_by_account_id: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();
const agentRunSchema = z.object({
  id: z.string(),
  agent_id: z.string(),
  project_id: z.string(),
  prompt: z.string(),
  status: z.enum(["queued", "running", "completed", "failed", "cancelled"]),
  output_text: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
  steps: z.array(agentStepSchema),
  changes: z.array(agentChangeSchema),
  created_by_account_id: z.string().nullable().optional(),
  queued_at: z.string(),
  started_at: z.string().nullable().optional(),
  finished_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();
const agentRunLogSchema = z.object({ id: z.string(), run_id: z.string(), project_id: z.string(), sequence: z.number(), level: z.enum(["debug", "info", "warn", "error"]), message: z.string(), created_at: z.string() }).passthrough();
const messagingChannelSchema = z.enum(["email", "sms", "push"]);
const messagingProviderSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  channel: messagingChannelSchema,
  provider: z.string(),
  credentials_present: z.boolean(),
  enabled: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();
const messagingTopicSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  subscriber_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();
const messagingMessageSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  topic_id: z.string().nullable(),
  channel: messagingChannelSchema,
  status: z.enum(["queued", "processing", "succeeded", "failed", "cancelled"]),
  recipient_count: z.number(),
  succeeded_count: z.number(),
  failed_count: z.number(),
  cancelled_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();
const messagingDeliverySchema = z.object({
  id: z.string(),
  project_id: z.string(),
  message_id: z.string(),
  subscriber_id: z.string().nullable().optional(),
  provider_id: z.string().nullable().optional(),
  channel: messagingChannelSchema,
  address_preview: z.string(),
  status: z.enum(["pending", "running", "succeeded", "failed", "cancelled"]),
  attempt_count: z.number(),
  last_status_code: z.number().nullable().optional(),
  last_error: z.string().nullable().optional(),
  delivered_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();

export type BrowserAccount = z.infer<typeof accountSchema>;
export type BrowserConsoleSession = z.infer<typeof consoleSessionSchema>;
export type BrowserOrganizationMembership = z.infer<typeof organizationMembershipSchema>;
export type BrowserOrganizationMembershipRole = z.infer<typeof organizationMembershipRoleSchema>;
export type BrowserOrganizationMembershipManageRole = z.infer<typeof organizationMembershipManageRoleSchema>;
export type BrowserOrganizationInvitation = z.infer<typeof organizationInvitationSchema>;
export type BrowserOrganizationAuditEvent = z.infer<typeof organizationAuditEventSchema>;
export type BrowserOrganization = z.infer<typeof organizationSchema>;
export type BrowserProject = z.infer<typeof projectSchema>;
export type BrowserProjectServiceLayout = z.infer<typeof projectServiceLayoutSchema>;
export type BrowserOrganizationsResponse = z.infer<typeof organizationsResponseSchema>;
export type BrowserProjectsResponse = z.infer<typeof projectsResponseSchema>;
export type BrowserProjectUsage = z.infer<typeof projectUsageSchema>;
export type BrowserProjectUsageDay = z.infer<typeof projectUsageDaySchema>;
export type BrowserProjectUsageMetering = z.infer<typeof projectUsageMeteringSchema>;
export type BrowserApplicationUser = z.infer<typeof applicationUserSchema>;
export type BrowserProjectAuthSettings = z.infer<typeof projectAuthSettingsSchema>;
export type BrowserAgent = z.infer<typeof agentSchema>;
export type BrowserAgentRun = z.infer<typeof agentRunSchema>;
export type BrowserAgentRole = z.infer<typeof agentRoleSchema>;
export type BrowserAgentTool = z.infer<typeof agentToolSchema>;
export type BrowserProjectAPIKey = z.infer<typeof projectAPIKeySchema>;
export type BrowserProjectAPIKeyScope = z.infer<typeof projectAPIKeyScopeSchema>;
export type BrowserProjectWebhook = z.infer<typeof projectWebhookSchema>;
export type BrowserProjectWebhookDelivery = z.infer<typeof projectWebhookDeliverySchema>;
export type BrowserProjectDatabase = z.infer<typeof projectDatabaseSchema>;
export type BrowserDatabaseTable = z.infer<typeof databaseTableSchema>;
export type BrowserDatabaseColumnType = z.infer<typeof databaseColumnTypeSchema>;
export type BrowserDatabaseColumn = z.infer<typeof databaseColumnSchema>;
export type BrowserDatabaseIndex = z.infer<typeof databaseIndexSchema>;
export type BrowserDatabaseRow = z.infer<typeof databaseRowSchema>;
export type BrowserStorageBucket = z.infer<typeof storageBucketSchema>;
export type BrowserStorageFile = z.infer<typeof storageFileSchema>;
export type BrowserFunction = z.infer<typeof functionSchema>;
export type BrowserFunctionVariable = z.infer<typeof functionVariableSchema>;
export type BrowserFunctionExecution = z.infer<typeof functionExecutionSchema>;
export type BrowserFunctionExecutionLog = z.infer<typeof functionExecutionLogSchema>;
export type BrowserFunctionBuildLog = z.infer<typeof functionBuildLogSchema>;
export type BrowserSiteBuildLog = z.infer<typeof siteBuildLogSchema>;
export type BrowserFunctionRuntime = z.infer<typeof functionRuntimeSchema>;
export type BrowserTrace = z.infer<typeof traceSchema>;
export type BrowserSite = z.infer<typeof siteSchema>;
export type BrowserSiteDomain = z.infer<typeof siteDomainSchema>;

export class BrowserAPIError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly traceID?: string,
  ) {
    super(message);
    this.name = "BrowserAPIError";
  }
}

const httpErrorMessages: Record<number, string> = {
  401: "Your Console session has expired. Sign in again.",
  403: "You do not have permission to perform this action.",
  404: "The requested resource was not found.",
  409: "This resource already exists or is already being processed.",
  422: "Some submitted values are invalid.",
  429: "Too many requests. Try again shortly.",
};

/** Turn errors crossing the browser/API boundary into safe, actionable copy. */
export function browserAPIErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof BrowserAPIError)) return fallback;
  const rawMessage = error.message.trim();
  const message = !rawMessage || rawMessage === "Stealth API request failed"
    ? httpErrorMessages[error.status] || (error.status >= 500 ? "Stealth is temporarily unavailable. Try again shortly." : fallback)
    : rawMessage;
  return error.traceID ? `${message} (Reference: ${error.traceID})` : message;
}

const configuredAPIOrigin = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/+$/, "");

function apiURL(path: string) {
  if (!configuredAPIOrigin) return path;
  return new URL(path, `${configuredAPIOrigin}/`).toString();
}

function responseTraceID(response: Response) {
  return response.headers.get("X-Trace-ID")?.trim() || undefined;
}

function invalidResponseError(traceID?: string) {
  return new BrowserAPIError(502, "invalid_api_response", "Stealth returned an unexpected response. Try again shortly.", traceID);
}

async function fetchAPI(path: string, init: RequestInit = {}) {
  try {
    return await fetch(apiURL(path), {
      ...init,
      credentials: "include",
    });
  } catch {
    throw new BrowserAPIError(0, "network_error", "Unable to reach Stealth. Check your connection and try again.");
  }
}

async function request<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !(typeof FormData !== "undefined" && init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetchAPI(path, { ...init, headers });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    throw new BrowserAPIError(
      response.status,
      payload?.error?.code ?? "upstream_error",
      payload?.error?.message ?? "Stealth API request failed",
      responseTraceID(response),
    );
  }
  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => {
    throw invalidResponseError(responseTraceID(response));
  });
  try {
    return schema.parse(payload);
  } catch {
    throw invalidResponseError(responseTraceID(response));
  }
}

async function download(path: string) {
  const response = await fetchAPI(path, { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    throw new BrowserAPIError(
      response.status,
      payload?.error?.code ?? "upstream_error",
      payload?.error?.message ?? "Stealth API request failed",
      responseTraceID(response),
    );
  }
  try {
    return await response.blob();
  } catch {
    throw invalidResponseError(responseTraceID(response));
  }
}

export const browserAPI = {
  currentAccount: () => request("/v1/account", accountResponseSchema),
  accountSessions: () => request("/v1/account/sessions", z.object({ sessions: z.array(consoleSessionSchema) })),
  revokeAccountSession: (sessionID: string) => request<void>(`/v1/account/sessions/${encodeURIComponent(sessionID)}`, z.undefined(), { method: "DELETE" }),
  revokeOtherAccountSessions: () => request("/v1/account/sessions", z.object({ revoked: z.number() }), { method: "DELETE" }),
  updateAccountPassword: (input: { current_password: string; password: string }) => request("/v1/account/password", z.object({ sessions_revoked: z.number() }), { method: "PATCH", body: JSON.stringify(input) }),
  organizations: (options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request(
      `/v1/organizations${query ? `?${query}` : ""}`,
      organizationsResponseSchema,
    );
  },
  updateOrganization: (organizationID: string, input: { name: string; slug: string }) =>
    request(`/v1/organizations/${encodeURIComponent(organizationID)}`, z.object({ organization: organizationSchema }), { method: "PATCH", body: JSON.stringify(input) }),
  organizationMemberships: (organizationID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request(`/v1/organizations/${encodeURIComponent(organizationID)}/memberships${query ? `?${query}` : ""}`, z.object({ memberships: z.array(organizationMembershipSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough());
  },
  createOrganizationMembership: (organizationID: string, input: { email: string; role: BrowserOrganizationMembershipManageRole }) =>
    request(`/v1/organizations/${encodeURIComponent(organizationID)}/memberships`, z.object({ membership: organizationMembershipSchema }), { method: "POST", body: JSON.stringify(input) }),
  updateOrganizationMembership: (organizationID: string, accountID: string, role: BrowserOrganizationMembershipManageRole) =>
    request(`/v1/organizations/${encodeURIComponent(organizationID)}/memberships/${encodeURIComponent(accountID)}`, z.object({ membership: organizationMembershipSchema }), { method: "PATCH", body: JSON.stringify({ role }) }),
  removeOrganizationMembership: (organizationID: string, accountID: string) => request<void>(`/v1/organizations/${encodeURIComponent(organizationID)}/memberships/${encodeURIComponent(accountID)}`, z.undefined(), { method: "DELETE" }),
  organizationInvitations: (organizationID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request(`/v1/organizations/${encodeURIComponent(organizationID)}/invitations${query ? `?${query}` : ""}`, z.object({ invitations: z.array(organizationInvitationSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough());
  },
  createOrganizationInvitation: (organizationID: string, input: { email: string; role: BrowserOrganizationMembershipManageRole }) =>
    request(`/v1/organizations/${encodeURIComponent(organizationID)}/invitations`, z.object({ invitation: organizationInvitationSchema, delivery: z.enum(["sent", "failed"]) }), { method: "POST", body: JSON.stringify(input) }),
  revokeOrganizationInvitation: (organizationID: string, invitationID: string) => request<void>(`/v1/organizations/${encodeURIComponent(organizationID)}/invitations/${encodeURIComponent(invitationID)}`, z.undefined(), { method: "DELETE" }),
  organizationAuditEvents: (organizationID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request(`/v1/organizations/${encodeURIComponent(organizationID)}/audit-events${query ? `?${query}` : ""}`, z.object({ events: z.array(organizationAuditEventSchema), pagination: paginationSchema }).passthrough());
  },
  projectAuditEvents: (projectID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request(`/v1/projects/${encodeURIComponent(projectID)}/audit-events${query ? `?${query}` : ""}`, z.object({ events: z.array(organizationAuditEventSchema), pagination: paginationSchema }).passthrough());
  },
  projectTraces: (projectID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request(`/v1/projects/${encodeURIComponent(projectID)}/traces${query ? `?${query}` : ""}`, z.object({ traces: z.array(traceSchema), pagination: paginationSchema }).passthrough());
  },
  projects: (organizationID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request(
      `/v1/organizations/${encodeURIComponent(organizationID)}/projects${query ? `?${query}` : ""}`,
      projectsResponseSchema,
    );
  },
  project: (projectID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}`, z.object({ project: projectSchema })),
  projectServiceLayout: (projectID: string) =>
    request(
      `/v1/projects/${encodeURIComponent(projectID)}/service-layout`,
      z.object({ layout: z.array(projectServiceLayoutSchema), can_manage: z.boolean() }),
    ),
  replaceProjectServiceLayout: (projectID: string, layout: Array<Pick<BrowserProjectServiceLayout, "resource_type" | "resource_id" | "x" | "y">>) =>
    request(
      `/v1/projects/${encodeURIComponent(projectID)}/service-layout`,
      z.object({ layout: z.array(projectServiceLayoutSchema), can_manage: z.boolean() }),
      { method: "PUT", body: JSON.stringify({ layout }) },
    ),
  updateProject: (projectID: string, input: { name: string }) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}`, z.object({ project: projectSchema }), { method: "PATCH", body: JSON.stringify(input) }),
  deleteProject: (projectID: string, confirmName: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}`, z.undefined(), { method: "DELETE", body: JSON.stringify({ confirm_name: confirmName }) }),
  projectUsage: (projectID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/usage`, z.object({ usage: projectUsageSchema })),
  projectUsageMetering: (projectID: string, options: { from?: string; to?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.from) params.set("from", options.from);
    if (options.to) params.set("to", options.to);
    const query = params.toString();
    return request(
      `/v1/projects/${encodeURIComponent(projectID)}/usage/metering${query ? `?${query}` : ""}`,
      z.object({ metering: projectUsageMeteringSchema }),
    );
  },
  downloadProjectUsageMetering: (projectID: string, options: { from?: string; to?: string } = {}) => {
    const params = new URLSearchParams({ format: "csv" });
    if (options.from) params.set("from", options.from);
    if (options.to) params.set("to", options.to);
    return download(`/v1/projects/${encodeURIComponent(projectID)}/usage/metering?${params.toString()}`);
  },
  projectUsers: (projectID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request(
      `/v1/projects/${encodeURIComponent(projectID)}/users${query ? `?${query}` : ""}`,
      z.object({ users: z.array(applicationUserSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough(),
    );
  },
  createProjectUser: (projectID: string, input: { email: string; password: string; name?: string }) =>
    request(
      `/v1/projects/${encodeURIComponent(projectID)}/users`,
      z.object({ user: applicationUserSchema }),
      { method: "POST", body: JSON.stringify(input) },
    ),
  updateProjectUserStatus: (projectID: string, userID: string, status: "active" | "blocked") =>
    request(
      `/v1/projects/${encodeURIComponent(projectID)}/users/${encodeURIComponent(userID)}/status`,
      z.object({ user: applicationUserSchema }),
      { method: "PATCH", body: JSON.stringify({ status }) },
    ),
  projectAuthSettings: (projectID: string) =>
    request(
      `/v1/projects/${encodeURIComponent(projectID)}/auth/settings`,
      z.object({ settings: projectAuthSettingsSchema, can_manage: z.boolean() }).passthrough(),
    ),
  updateProjectAuthSettings: (projectID: string, input: { registration_enabled?: boolean; cors_origins?: string[] }) =>
    request(
      `/v1/projects/${encodeURIComponent(projectID)}/auth/settings`,
      z.object({ settings: projectAuthSettingsSchema, can_manage: z.boolean() }).passthrough(),
      { method: "PATCH", body: JSON.stringify(input) },
    ),
  projectAPIKeys: (projectID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request(
      `/v1/projects/${encodeURIComponent(projectID)}/api-keys${query ? `?${query}` : ""}`,
      z.object({ keys: z.array(projectAPIKeySchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough(),
    );
  },
  createProjectAPIKey: (projectID: string, input: { name: string; scopes: BrowserProjectAPIKeyScope[]; expires_at?: string | null }) =>
    request(
      `/v1/projects/${encodeURIComponent(projectID)}/api-keys`,
      z.object({ key: projectAPIKeySchema, secret: z.string() }),
      { method: "POST", body: JSON.stringify(input) },
    ),
  revokeProjectAPIKey: (projectID: string, keyID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/api-keys/${encodeURIComponent(keyID)}`, z.undefined(), { method: "DELETE" }),
  projectWebhooks: (projectID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request(`/v1/projects/${encodeURIComponent(projectID)}/webhooks${query ? `?${query}` : ""}`, z.object({ webhooks: z.array(projectWebhookSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough());
  },
  createProjectWebhook: (projectID: string, input: { name: string; url: string; events?: string[]; enabled?: boolean }) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/webhooks`, z.object({ webhook: projectWebhookSchema, secret: z.string() }), { method: "POST", body: JSON.stringify(input) }),
  updateProjectWebhook: (projectID: string, webhookID: string, input: { enabled?: boolean; name?: string; url?: string; events?: string[] }) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/webhooks/${encodeURIComponent(webhookID)}`, z.object({ webhook: projectWebhookSchema }), { method: "PATCH", body: JSON.stringify(input) }),
  rotateProjectWebhookSecret: (projectID: string, webhookID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/webhooks/${encodeURIComponent(webhookID)}/rotate-secret`, z.object({ webhook: projectWebhookSchema, secret: z.string() }), { method: "POST", body: "{}" }),
  deleteProjectWebhook: (projectID: string, webhookID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/webhooks/${encodeURIComponent(webhookID)}`, z.undefined(), { method: "DELETE" }),
  projectWebhookDeliveries: (projectID: string, webhookID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request(`/v1/projects/${encodeURIComponent(projectID)}/webhooks/${encodeURIComponent(webhookID)}/deliveries${query ? `?${query}` : ""}`, z.object({ deliveries: z.array(projectWebhookDeliverySchema), pagination: paginationSchema }).passthrough());
  },
  projectDatabases: (projectID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request(`/v1/projects/${encodeURIComponent(projectID)}/databases${query ? `?${query}` : ""}`, z.object({ databases: z.array(projectDatabaseSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough());
  },
  createProjectDatabase: (projectID: string, input: { name: string }) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/databases`, z.object({ database: projectDatabaseSchema }), { method: "POST", body: JSON.stringify(input) }),
  deleteProjectDatabase: (projectID: string, databaseID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}`, z.undefined(), { method: "DELETE" }),
  projectDatabaseTables: (projectID: string, databaseID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables${query ? `?${query}` : ""}`, z.object({ tables: z.array(databaseTableSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough());
  },
  createProjectDatabaseTable: (projectID: string, databaseID: string, input: { name: string; row_security?: boolean; create_permissions?: string[]; read_permissions?: string[]; update_permissions?: string[]; delete_permissions?: string[] }) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables`, z.object({ table: databaseTableSchema }), { method: "POST", body: JSON.stringify(input) }),
  deleteProjectDatabaseTable: (projectID: string, databaseID: string, tableID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}`, z.undefined(), { method: "DELETE" }),
  projectDatabaseColumns: (projectID: string, databaseID: string, tableID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request(
      `/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/columns${query ? `?${query}` : ""}`,
      z.object({ columns: z.array(databaseColumnSchema), pagination: paginationSchema }).passthrough(),
    );
  },
  createProjectDatabaseColumn: (projectID: string, databaseID: string, tableID: string, input: { key: string; type: BrowserDatabaseColumnType; required?: boolean; varchar_size?: number; default?: unknown }) =>
    request(
      `/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/columns`,
      z.object({ column: databaseColumnSchema }),
      { method: "POST", body: JSON.stringify(input) },
    ),
  deleteProjectDatabaseColumn: (projectID: string, databaseID: string, tableID: string, columnID: string) =>
    request<void>(
      `/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/columns/${encodeURIComponent(columnID)}`,
      z.undefined(),
      { method: "DELETE" },
    ),
  projectDatabaseIndexes: (projectID: string, databaseID: string, tableID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request(
      `/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/indexes${query ? `?${query}` : ""}`,
      z.object({ indexes: z.array(databaseIndexSchema), pagination: paginationSchema }).passthrough(),
    );
  },
  createProjectDatabaseIndex: (projectID: string, databaseID: string, tableID: string, input: { name: string; type: "key" | "unique"; column_keys: string[]; directions?: Array<"asc" | "desc"> }) =>
    request(
      `/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/indexes`,
      z.object({ index: databaseIndexSchema }),
      { method: "POST", body: JSON.stringify(input) },
    ),
  deleteProjectDatabaseIndex: (projectID: string, databaseID: string, tableID: string, indexID: string) =>
    request<void>(
      `/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/indexes/${encodeURIComponent(indexID)}`,
      z.undefined(),
      { method: "DELETE" },
    ),
  projectDatabaseRows: (projectID: string, databaseID: string, tableID: string, options: { limit?: number; cursor?: string; order_by?: string; order_direction?: "asc" | "desc"; filters?: Record<string, string> } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    if (options.order_by) params.set("order_by", options.order_by);
    if (options.order_direction) params.set("order_direction", options.order_direction);
    for (const [key, value] of Object.entries(options.filters ?? {})) params.set(`filter.${key}`, value);
    const query = params.toString();
    return request(
      `/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows${query ? `?${query}` : ""}`,
      z.object({ rows: z.array(databaseRowSchema), pagination: paginationSchema }).passthrough(),
    );
  },
  createProjectDatabaseRow: (projectID: string, databaseID: string, tableID: string, input: { data: Record<string, unknown>; read_permissions?: string[]; update_permissions?: string[]; delete_permissions?: string[] }) =>
    request(
      `/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows`,
      z.object({ row: databaseRowSchema }),
      { method: "POST", body: JSON.stringify(input) },
    ),
  getProjectDatabaseRow: (projectID: string, databaseID: string, tableID: string, rowID: string) =>
    request(
      `/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows/${encodeURIComponent(rowID)}`,
      z.object({ row: databaseRowSchema }),
    ),
  updateProjectDatabaseRow: (projectID: string, databaseID: string, tableID: string, rowID: string, input: Partial<{ data: Record<string, unknown>; read_permissions: string[]; update_permissions: string[]; delete_permissions: string[] }>) =>
    request(
      `/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows/${encodeURIComponent(rowID)}`,
      z.object({ row: databaseRowSchema }),
      { method: "PATCH", body: JSON.stringify(input) },
    ),
  deleteProjectDatabaseRow: (projectID: string, databaseID: string, tableID: string, rowID: string) =>
    request<void>(
      `/v1/projects/${encodeURIComponent(projectID)}/databases/${encodeURIComponent(databaseID)}/tables/${encodeURIComponent(tableID)}/rows/${encodeURIComponent(rowID)}`,
      z.undefined(),
      { method: "DELETE" },
    ),
  projectStorageBuckets: (projectID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request(`/v1/projects/${encodeURIComponent(projectID)}/storage/buckets${query ? `?${query}` : ""}`, z.object({ buckets: z.array(storageBucketSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough());
  },
  createProjectStorageBucket: (projectID: string, input: { name: string; file_security?: boolean; create_permissions?: string[]; read_permissions?: string[]; update_permissions?: string[]; delete_permissions?: string[]; max_file_size_bytes?: number; quota_bytes?: number }) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/storage/buckets`, z.object({ bucket: storageBucketSchema }), { method: "POST", body: JSON.stringify(input) }),
  updateProjectStorageBucket: (projectID: string, bucketID: string, input: Partial<{ name: string; file_security: boolean; create_permissions: string[]; read_permissions: string[]; update_permissions: string[]; delete_permissions: string[]; max_file_size_bytes: number; quota_bytes: number }>) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/storage/buckets/${encodeURIComponent(bucketID)}`, z.object({ bucket: storageBucketSchema }), { method: "PATCH", body: JSON.stringify(input) }),
  deleteProjectStorageBucket: (projectID: string, bucketID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/storage/buckets/${encodeURIComponent(bucketID)}`, z.undefined(), { method: "DELETE" }),
  projectStorageFiles: (projectID: string, bucketID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request(`/v1/projects/${encodeURIComponent(projectID)}/storage/buckets/${encodeURIComponent(bucketID)}/files${query ? `?${query}` : ""}`, z.object({ files: z.array(storageFileSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough());
  },
  uploadProjectStorageFile: (projectID: string, bucketID: string, form: FormData) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/storage/buckets/${encodeURIComponent(bucketID)}/files`, z.object({ file: storageFileSchema }), { method: "POST", body: form }),
  deleteProjectStorageFile: (projectID: string, bucketID: string, fileID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/storage/buckets/${encodeURIComponent(bucketID)}/files/${encodeURIComponent(fileID)}`, z.undefined(), { method: "DELETE" }),
  downloadProjectStorageFile: (projectID: string, bucketID: string, fileID: string) =>
    download(`/v1/projects/${encodeURIComponent(projectID)}/storage/buckets/${encodeURIComponent(bucketID)}/files/${encodeURIComponent(fileID)}/download`),
  health: () => request("/healthz", z.object({ status: z.string() })),
  readiness: () => request("/readyz", z.object({ status: z.string() })),
  organizationIncidents: (organizationID: string) =>
    request(`/v1/organizations/${encodeURIComponent(organizationID)}/incidents?limit=100`, z.object({ incidents: z.array(incidentSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough()),
  organizationTraces: (organizationID: string) =>
    request(`/v1/organizations/${encodeURIComponent(organizationID)}/traces?limit=100`, z.object({ traces: z.array(traceSchema), pagination: paginationSchema }).passthrough()),
  agents: (options: { limit?: number; cursor?: string; project_id?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    if (options.project_id) params.set("project_id", options.project_id);
    const query = params.toString();
    return request(`/v1/agents${query ? `?${query}` : ""}`, z.object({ agents: z.array(agentSchema), pagination: paginationSchema }).passthrough());
  },
  agent: (agentID: string) => request(`/v1/agents/${encodeURIComponent(agentID)}`, z.object({ agent: agentSchema })),
  createAgent: (input: { project_id: string; name: string; description?: string; role: BrowserAgentRole; branch?: string; provider: string; model: string; current_task?: string | null; tools?: BrowserAgentTool[]; instructions?: string | null }) =>
    request("/v1/agents", z.object({ agent: agentSchema }), { method: "POST", body: JSON.stringify(input) }),
  updateAgent: (agentID: string, input: Partial<{ name: string; description: string; role: BrowserAgentRole; branch: string; provider: string; model: string; current_task: string | null; tools: BrowserAgentTool[]; instructions: string | null }>) =>
    request(`/v1/agents/${encodeURIComponent(agentID)}`, z.object({ agent: agentSchema }), { method: "PATCH", body: JSON.stringify(input) }),
  deleteAgent: (agentID: string) => request<void>(`/v1/agents/${encodeURIComponent(agentID)}`, z.undefined(), { method: "DELETE" }),
  agentRuns: (agentID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request(`/v1/agents/${encodeURIComponent(agentID)}/runs${query ? `?${query}` : ""}`, z.object({ runs: z.array(agentRunSchema), pagination: paginationSchema }).passthrough());
  },
  createAgentRun: (agentID: string, input: { prompt: string }) =>
    request(`/v1/agents/${encodeURIComponent(agentID)}/runs`, z.object({ run: agentRunSchema }), { method: "POST", body: JSON.stringify(input) }),
  cancelAgentRun: (agentID: string, runID: string) =>
    request(`/v1/agents/${encodeURIComponent(agentID)}/runs/${encodeURIComponent(runID)}/cancel`, z.object({ run: agentRunSchema }), { method: "POST" }),
  agentRunLogs: (agentID: string, runID: string, options: { limit?: number; after?: number } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.after !== undefined) params.set("after", String(options.after));
    const query = params.toString();
    return request(`/v1/agents/${encodeURIComponent(agentID)}/runs/${encodeURIComponent(runID)}/logs${query ? `?${query}` : ""}`, z.object({ logs: z.array(agentRunLogSchema), pagination: paginationSchema }).passthrough());
  },
  projectFunctions: (projectID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request(`/v1/projects/${encodeURIComponent(projectID)}/functions${query ? `?${query}` : ""}`, z.object({ functions: z.array(functionSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough());
  },
  projectFunction: (projectID: string, functionID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}`, z.object({ function: functionSchema })),
  createProjectFunction: (projectID: string, input: { name: string; runtime?: BrowserFunctionRuntime; entrypoint?: string; commands?: string; timeout_seconds?: number; enabled?: boolean; logging?: boolean; execute_permissions?: string[]; description?: string; artifact_quota_bytes?: number }) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/functions`, z.object({ function: functionSchema }), { method: "POST", body: JSON.stringify(input) }),
  updateProjectFunction: (projectID: string, functionID: string, input: Partial<{ name: string; runtime: BrowserFunctionRuntime; entrypoint: string; commands: string; timeout_seconds: number; enabled: boolean; logging: boolean; execute_permissions: string[]; description: string; artifact_quota_bytes: number }>) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}`, z.object({ function: functionSchema }), { method: "PATCH", body: JSON.stringify(input) }),
  deleteProjectFunction: (projectID: string, functionID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}`, z.undefined(), { method: "DELETE" }),
  projectFunctionVariables: (projectID: string, functionID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}/variables${query ? `?${query}` : ""}`, z.object({ variables: z.array(functionVariableSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough());
  },
  createProjectFunctionVariable: (projectID: string, functionID: string, input: { key: string; kind?: "variable" | "secret"; is_secret?: boolean; value: string; description?: string }) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}/variables`, z.object({ variable: functionVariableSchema }), { method: "POST", body: JSON.stringify(input) }),
  updateProjectFunctionVariable: (projectID: string, functionID: string, variableID: string, input: Partial<{ key: string; value: string; description: string }>) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}/variables/${encodeURIComponent(variableID)}`, z.object({ variable: functionVariableSchema }), { method: "PATCH", body: JSON.stringify(input) }),
  deleteProjectFunctionVariable: (projectID: string, functionID: string, variableID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}/variables/${encodeURIComponent(variableID)}`, z.undefined(), { method: "DELETE" }),
  projectSites: (projectID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request(`/v1/projects/${encodeURIComponent(projectID)}/sites${query ? `?${query}` : ""}`, z.object({ sites: z.array(siteSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough());
  },
  projectSite: (projectID: string, siteID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}`, z.object({ site: siteSchema })),
  createProjectSite: (projectID: string, input: { name: string; artifact_quota_bytes?: number }) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/sites`, z.object({ site: siteSchema }), { method: "POST", body: JSON.stringify({ ...input, framework: "static", enabled: true }) }),
  updateProjectSite: (projectID: string, siteID: string, input: Partial<{ name: string; enabled: boolean; status: "active" | "disabled"; artifact_quota_bytes: number }>) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}`, z.object({ site: siteSchema }), { method: "PATCH", body: JSON.stringify(input) }),
  deleteProjectSite: (projectID: string, siteID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}`, z.undefined(), { method: "DELETE" }),
  projectFunctionDeployments: (projectID: string, functionID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}/deployments${query ? `?${query}` : ""}`, z.object({ deployments: z.array(deploymentSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough());
  },
  uploadProjectFunctionDeployment: (projectID: string, functionID: string, form: FormData) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}/deployments`, z.object({ deployment: deploymentSchema }), { method: "POST", body: form }),
  activateProjectFunctionDeployment: (projectID: string, functionID: string, deploymentID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}/deployments/${encodeURIComponent(deploymentID)}/activate`, z.object({ function: functionSchema, deployment: deploymentSchema }), { method: "POST" }),
  deleteProjectFunctionDeployment: (projectID: string, functionID: string, deploymentID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}/deployments/${encodeURIComponent(deploymentID)}`, z.undefined(), { method: "DELETE" }),
  projectFunctionBuildLogs: (projectID: string, functionID: string, deploymentID: string, options: { limit?: number; after?: number } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.after !== undefined) params.set("after", String(options.after));
    const query = params.toString();
    return request(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}/deployments/${encodeURIComponent(deploymentID)}/logs${query ? `?${query}` : ""}`, z.object({ logs: z.array(functionBuildLogSchema), pagination: paginationSchema }).passthrough());
  },
  projectFunctionExecutions: (projectID: string, functionID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}/executions${query ? `?${query}` : ""}`, z.object({ executions: z.array(functionExecutionSchema), pagination: paginationSchema }).passthrough());
  },
  createProjectFunctionExecution: (projectID: string, functionID: string, input: { trigger?: string; input?: unknown }) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}/executions`, z.object({ execution: functionExecutionSchema }), { method: "POST", body: JSON.stringify(input) }),
  projectFunctionExecutionLogs: (projectID: string, functionID: string, executionID: string, options: { limit?: number; after?: number } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.after !== undefined) params.set("after", String(options.after));
    const query = params.toString();
    return request(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}/executions/${encodeURIComponent(executionID)}/logs${query ? `?${query}` : ""}`, z.object({ logs: z.array(functionExecutionLogSchema), pagination: paginationSchema }).passthrough());
  },
  projectSiteDeployments: (projectID: string, siteID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}/deployments${query ? `?${query}` : ""}`, z.object({ deployments: z.array(deploymentSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough());
  },
  uploadProjectSiteDeployment: (projectID: string, siteID: string, form: FormData) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}/deployments`, z.object({ deployment: deploymentSchema }), { method: "POST", body: form }),
  activateProjectSiteDeployment: (projectID: string, siteID: string, deploymentID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}/deployments/${encodeURIComponent(deploymentID)}/activate`, z.object({ site: siteSchema, deployment: deploymentSchema }), { method: "POST" }),
  deleteProjectSiteDeployment: (projectID: string, siteID: string, deploymentID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}/deployments/${encodeURIComponent(deploymentID)}`, z.undefined(), { method: "DELETE" }),
  projectSiteBuildLogs: (projectID: string, siteID: string, deploymentID: string, options: { limit?: number; after?: number } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.after !== undefined) params.set("after", String(options.after));
    const query = params.toString();
    return request(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}/deployments/${encodeURIComponent(deploymentID)}/logs${query ? `?${query}` : ""}`, z.object({ logs: z.array(siteBuildLogSchema), pagination: paginationSchema }).passthrough());
  },
  projectSiteDomains: (projectID: string, siteID: string, options: { limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    const query = params.toString();
    return request(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}/domains${query ? `?${query}` : ""}`, z.object({ domains: z.array(siteDomainSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough());
  },
  createProjectSiteDomain: (projectID: string, siteID: string, input: { hostname: string }) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}/domains`, z.object({ domain: siteDomainSchema }), { method: "POST", body: JSON.stringify(input) }),
  verifyProjectSiteDomain: (projectID: string, siteID: string, domainID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}/domains/${encodeURIComponent(domainID)}/verify`, z.object({ domain: siteDomainSchema }), { method: "POST" }),
  deleteProjectSiteDomain: (projectID: string, siteID: string, domainID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}/domains/${encodeURIComponent(domainID)}`, z.undefined(), { method: "DELETE" }),
  createProjectSiteGitDeployment: (projectID: string, siteID: string, input: { repository: string; ref?: string; build_runtime?: "node-22" | "python-3.13" | "go-1.24"; build_command: string; output_directory?: string; activate?: boolean }) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}/deployments/git`, z.object({ deployment: deploymentSchema }), { method: "POST", body: JSON.stringify(input) }),
  projectResource: (projectID: string, resource: string) => {
    const paths: Record<string, string> = {
      auth: "auth/settings",
      "api-keys": "api-keys",
      databases: "databases",
      functions: "functions",
      messaging: "messaging/providers",
      realtime: "realtime",
      sites: "sites",
      storage: "storage/buckets",
      webhooks: "webhooks",
    };
    const path = paths[resource];
    if (!path) throw new BrowserAPIError(404, "not_found", "That project resource does not exist.");
    return request(`/v1/projects/${encodeURIComponent(projectID)}/${path}`, z.object({}).passthrough());
  },
  openProjectRealtime: (projectID: string, options: { events?: string; cursor?: string; signal?: AbortSignal } = {}) => {
    const params = new URLSearchParams({ events: options.events || "*" });
    if (options.cursor) params.set("cursor", options.cursor);
    return fetchAPI(`/v1/projects/${encodeURIComponent(projectID)}/realtime?${params.toString()}`, {
      headers: { accept: "text/event-stream" },
      cache: "no-store",
      signal: options.signal,
    });
  },
  publicSiteURL: (siteID: string) => apiURL(`/v1/sites/${encodeURIComponent(siteID)}`),
  projectMessagingProviders: (projectID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/messaging/providers`, z.object({ providers: z.array(messagingProviderSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough()),
  projectMessagingTopics: (projectID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/messaging/topics`, z.object({ topics: z.array(messagingTopicSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough()),
  projectMessagingMessages: (projectID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/messaging/messages`, z.object({ messages: z.array(messagingMessageSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough()),
  createProjectMessagingMessage: (projectID: string, input: { topic_id: string; channel: z.infer<typeof messagingChannelSchema>; subject?: string; body: string; data?: Record<string, string> }, idempotencyKey: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/messaging/messages`, z.object({ message: messagingMessageSchema }), { method: "POST", headers: { "idempotency-key": idempotencyKey }, body: JSON.stringify(input) }),
  cancelProjectMessagingMessage: (projectID: string, messageID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/messaging/messages/${encodeURIComponent(messageID)}/cancel`, z.object({ message: messagingMessageSchema }), { method: "POST", body: "{}" }),
  projectMessagingDeliveries: (projectID: string, messageID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/messaging/messages/${encodeURIComponent(messageID)}/deliveries`, z.object({ deliveries: z.array(messagingDeliverySchema), pagination: paginationSchema }).passthrough()),
  login: (input: { email: string; password: string }) =>
    request<void>("/v1/sessions/email-password", z.undefined(), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  register: (input: { email: string; password: string; organization_name?: string }) =>
    request("/v1/account/registrations", registrationResponseSchema, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  requestPasswordRecovery: (input: { email: string; url?: string }) =>
    request<{ status: string }>("/v1/account/recovery", z.object({ status: z.string() }), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  resetPassword: (input: { token: string; password: string }) =>
    request("/v1/account/recovery", accountResponseSchema, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  verifyEmail: (token: string) =>
    request("/v1/account/verification", accountResponseSchema, {
      method: "PUT",
      body: JSON.stringify({ token }),
    }),
  acceptInvitation: (token: string) =>
    request("/v1/organization-invitations/accept", z.object({ membership: z.object({ organization_id: z.string(), account_id: z.string(), role: z.string() }).passthrough() }), {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  logout: () => request<void>("/v1/session", z.undefined(), { method: "DELETE" }),
  createProject: (organizationID: string, input: { name: string }) =>
    request(
      `/v1/organizations/${encodeURIComponent(organizationID)}/projects`,
      z.object({ project: projectSchema }),
      { method: "POST", body: JSON.stringify(input) },
    ),
};
