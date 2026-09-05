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

export type BrowserAccount = z.infer<typeof accountSchema>;
export type BrowserOrganization = z.infer<typeof organizationSchema>;
export type BrowserProject = z.infer<typeof projectSchema>;
export type BrowserOrganizationsResponse = z.infer<typeof organizationsResponseSchema>;
export type BrowserProjectsResponse = z.infer<typeof projectsResponseSchema>;

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
