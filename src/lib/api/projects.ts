import { z } from "zod";
import { BrowserAPIError, download, request } from "../api-core";
import { paginationParams, paginationSchema, paginatedPath, type PaginationOptions } from "./common";
import { organizationAuditEventSchema } from "./organizations";
import { traceSchema } from "./observability";

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

export type BrowserProject = z.infer<typeof projectSchema>;
export type BrowserProjectServiceLayout = z.infer<typeof projectServiceLayoutSchema>;
export type BrowserProjectsResponse = z.infer<typeof projectsResponseSchema>;
export type BrowserProjectUsage = z.infer<typeof projectUsageSchema>;
export type BrowserProjectUsageDay = z.infer<typeof projectUsageDaySchema>;
export type BrowserProjectUsageMetering = z.infer<typeof projectUsageMeteringSchema>;
export type BrowserApplicationUser = z.infer<typeof applicationUserSchema>;
export type BrowserProjectAuthSettings = z.infer<typeof projectAuthSettingsSchema>;
export type BrowserProjectAPIKey = z.infer<typeof projectAPIKeySchema>;
export type BrowserProjectAPIKeyScope = z.infer<typeof projectAPIKeyScopeSchema>;
export type BrowserProjectWebhook = z.infer<typeof projectWebhookSchema>;
export type BrowserProjectWebhookDelivery = z.infer<typeof projectWebhookDeliverySchema>;

export const projectsAPI = {
  createProject: (organizationID: string, input: { name: string }) =>
    request(
      `/v1/organizations/${encodeURIComponent(organizationID)}/projects`,
      z.object({ project: projectSchema }),
      { method: "POST", body: JSON.stringify(input) },
    ),
  projects: (organizationID: string, options: PaginationOptions = {}) => {
    const query = paginationParams(options).toString();
    return request(paginatedPath(`/v1/organizations/${encodeURIComponent(organizationID)}/projects`, query), projectsResponseSchema);
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
      paginatedPath(`/v1/projects/${encodeURIComponent(projectID)}/usage/metering`, query),
      z.object({ metering: projectUsageMeteringSchema }),
    );
  },
  downloadProjectUsageMetering: (projectID: string, options: { from?: string; to?: string } = {}) => {
    const params = new URLSearchParams({ format: "csv" });
    if (options.from) params.set("from", options.from);
    if (options.to) params.set("to", options.to);
    return download(`/v1/projects/${encodeURIComponent(projectID)}/usage/metering?${params.toString()}`);
  },
  projectUsers: (projectID: string, options: PaginationOptions = {}) => {
    const query = paginationParams(options).toString();
    return request(
      paginatedPath(`/v1/projects/${encodeURIComponent(projectID)}/users`, query),
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
  projectAPIKeys: (projectID: string, options: PaginationOptions = {}) => {
    const query = paginationParams(options).toString();
    return request(
      paginatedPath(`/v1/projects/${encodeURIComponent(projectID)}/api-keys`, query),
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
  projectWebhooks: (projectID: string, options: PaginationOptions = {}) => {
    const query = paginationParams(options).toString();
    return request(paginatedPath(`/v1/projects/${encodeURIComponent(projectID)}/webhooks`, query), z.object({ webhooks: z.array(projectWebhookSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough());
  },
  createProjectWebhook: (projectID: string, input: { name: string; url: string; events?: string[]; enabled?: boolean }) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/webhooks`, z.object({ webhook: projectWebhookSchema, secret: z.string() }), { method: "POST", body: JSON.stringify(input) }),
  updateProjectWebhook: (projectID: string, webhookID: string, input: { enabled?: boolean; name?: string; url?: string; events?: string[] }) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/webhooks/${encodeURIComponent(webhookID)}`, z.object({ webhook: projectWebhookSchema }), { method: "PATCH", body: JSON.stringify(input) }),
  rotateProjectWebhookSecret: (projectID: string, webhookID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/webhooks/${encodeURIComponent(webhookID)}/rotate-secret`, z.object({ webhook: projectWebhookSchema, secret: z.string() }), { method: "POST", body: "{}" }),
  deleteProjectWebhook: (projectID: string, webhookID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/webhooks/${encodeURIComponent(webhookID)}`, z.undefined(), { method: "DELETE" }),
  projectWebhookDeliveries: (projectID: string, webhookID: string, options: PaginationOptions = {}) => {
    const query = paginationParams(options).toString();
    return request(paginatedPath(`/v1/projects/${encodeURIComponent(projectID)}/webhooks/${encodeURIComponent(webhookID)}/deliveries`, query), z.object({ deliveries: z.array(projectWebhookDeliverySchema), pagination: paginationSchema }).passthrough());
  },
  projectAuditEvents: (projectID: string, options: PaginationOptions = {}) => {
    const query = paginationParams(options).toString();
    return request(paginatedPath(`/v1/projects/${encodeURIComponent(projectID)}/audit-events`, query), z.object({ events: z.array(organizationAuditEventSchema), pagination: paginationSchema }).passthrough());
  },
  projectTraces: (projectID: string, options: PaginationOptions = {}) => {
    const query = paginationParams(options).toString();
    return request(paginatedPath(`/v1/projects/${encodeURIComponent(projectID)}/traces`, query), z.object({ traces: z.array(traceSchema), pagination: paginationSchema }).passthrough());
  },
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
};
