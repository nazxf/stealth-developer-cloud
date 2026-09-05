import { z } from "zod";

/**
 * Browser-side management API client.
 *
 * The old Next entry point still has a server-only client in `stealth-api.ts`.
 * Vite cannot read Next cookies or server environment variables, so the new
 * entry point uses relative `/v1` requests by default and sends the HttpOnly
 * Console session cookie with `credentials: include`. `VITE_API_URL` is only
 * needed when the static console is hosted on a different origin from Go.
 */

const accountSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  email_verified: z.boolean(),
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
  storage_file_count: z.number(),
  function_count: z.number(),
  site_count: z.number(),
  webhook_delivery_count_7d: z.number(),
}).passthrough();
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
const functionSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  active_deployment_id: z.string().nullable().optional(),
  status: z.string(),
}).passthrough();
const siteSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  active_deployment_id: z.string().nullable().optional(),
  status: z.string(),
}).passthrough();
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
const traceSchema = z.object({
  id: z.string(),
  trace_id: z.string(),
  service: z.string(),
  method: z.string(),
  route: z.string(),
  status: z.number(),
  duration_ms: z.number(),
  started_at: z.string(),
}).passthrough();
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
export type BrowserOrganization = z.infer<typeof organizationSchema>;
export type BrowserProject = z.infer<typeof projectSchema>;
export type BrowserOrganizationsResponse = z.infer<typeof organizationsResponseSchema>;
export type BrowserProjectsResponse = z.infer<typeof projectsResponseSchema>;
export type BrowserApplicationUser = z.infer<typeof applicationUserSchema>;
export type BrowserProjectAuthSettings = z.infer<typeof projectAuthSettingsSchema>;
export type BrowserProjectAPIKey = z.infer<typeof projectAPIKeySchema>;
export type BrowserProjectAPIKeyScope = z.infer<typeof projectAPIKeyScopeSchema>;

export class BrowserAPIError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BrowserAPIError";
  }
}

const configuredAPIOrigin = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/+$/, "");

function apiURL(path: string) {
  if (!configuredAPIOrigin) return path;
  return new URL(path, `${configuredAPIOrigin}/`).toString();
}

async function request<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(apiURL(path), {
    ...init,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    throw new BrowserAPIError(
      response.status,
      payload?.error?.code ?? "upstream_error",
      payload?.error?.message ?? "Stealth API request failed",
    );
  }
  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json();
  return schema.parse(payload);
}

export const browserAPI = {
  currentAccount: () => request("/v1/account", accountResponseSchema),
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
  projectUsage: (projectID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/usage`, z.object({ usage: projectUsageSchema })),
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
  health: () => request("/healthz", z.object({ status: z.string() })),
  readiness: () => request("/readyz", z.object({ status: z.string() })),
  organizationIncidents: (organizationID: string) =>
    request(`/v1/organizations/${encodeURIComponent(organizationID)}/incidents?limit=100`, z.object({ incidents: z.array(incidentSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough()),
  organizationTraces: (organizationID: string) =>
    request(`/v1/organizations/${encodeURIComponent(organizationID)}/traces?limit=100`, z.object({ traces: z.array(traceSchema), pagination: paginationSchema }).passthrough()),
  projectFunctions: (projectID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/functions?limit=100`, z.object({ functions: z.array(functionSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough()),
  projectSites: (projectID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/sites?limit=100`, z.object({ sites: z.array(siteSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough()),
  projectFunctionDeployments: (projectID: string, functionID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}/deployments?limit=50`, z.object({ deployments: z.array(deploymentSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough()),
  projectSiteDeployments: (projectID: string, siteID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}/deployments?limit=50`, z.object({ deployments: z.array(deploymentSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough()),
  createProjectSite: (projectID: string, input: { name: string }) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/sites`, z.object({ site: siteSchema }), { method: "POST", body: JSON.stringify({ ...input, framework: "static", enabled: true }) }),
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
