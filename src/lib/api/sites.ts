import { z } from "zod";
import { apiURL, request } from "../api-core";
import { paginationParams, paginationSchema, paginatedPath, type PaginationOptions } from "./common";

export const siteSchema = z.object({
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

export { siteBuildLogSchema };

export type BrowserSite = z.infer<typeof siteSchema>;
export type BrowserSiteDomain = z.infer<typeof siteDomainSchema>;

export const sitesAPI = {
  projectSites: (projectID: string, options: PaginationOptions = {}) => {
    const query = paginationParams(options).toString();
    return request(paginatedPath(`/v1/projects/${encodeURIComponent(projectID)}/sites`, query), z.object({ sites: z.array(siteSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough());
  },
  projectSite: (projectID: string, siteID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}`, z.object({ site: siteSchema })),
  createProjectSite: (projectID: string, input: { name: string; artifact_quota_bytes?: number }) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/sites`, z.object({ site: siteSchema }), { method: "POST", body: JSON.stringify({ ...input, framework: "static", enabled: true }) }),
  updateProjectSite: (projectID: string, siteID: string, input: Partial<{ name: string; enabled: boolean; status: "active" | "disabled"; artifact_quota_bytes: number }>) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}`, z.object({ site: siteSchema }), { method: "PATCH", body: JSON.stringify(input) }),
  deleteProjectSite: (projectID: string, siteID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}`, z.undefined(), { method: "DELETE" }),
  projectSiteDomains: (projectID: string, siteID: string, options: PaginationOptions = {}) => {
    const query = paginationParams(options).toString();
    return request(paginatedPath(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}/domains`, query), z.object({ domains: z.array(siteDomainSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough());
  },
  createProjectSiteDomain: (projectID: string, siteID: string, input: { hostname: string }) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}/domains`, z.object({ domain: siteDomainSchema }), { method: "POST", body: JSON.stringify(input) }),
  verifyProjectSiteDomain: (projectID: string, siteID: string, domainID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}/domains/${encodeURIComponent(domainID)}/verify`, z.object({ domain: siteDomainSchema }), { method: "POST" }),
  deleteProjectSiteDomain: (projectID: string, siteID: string, domainID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}/domains/${encodeURIComponent(domainID)}`, z.undefined(), { method: "DELETE" }),
  publicSiteURL: (siteID: string) => apiURL(`/v1/sites/${encodeURIComponent(siteID)}`),
  publicSiteDeploymentURL: (siteID: string, deploymentID: string) =>
    apiURL(`/v1/sites/${encodeURIComponent(siteID)}/deployments/${encodeURIComponent(deploymentID)}`),
};
