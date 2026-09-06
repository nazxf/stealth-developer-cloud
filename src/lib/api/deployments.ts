import { z } from "zod";
import { request } from "../api-core";
import { paginationParams, paginationSchema, paginatedPath, type PaginationOptions } from "./common";
import { functionBuildLogSchema, functionSchema } from "./functions";
import { siteBuildLogSchema, siteSchema } from "./sites";

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

export type BrowserDeployment = z.infer<typeof deploymentSchema>;
export type BrowserFunctionBuildLog = z.infer<typeof functionBuildLogSchema>;
export type BrowserSiteBuildLog = z.infer<typeof siteBuildLogSchema>;

export const deploymentsAPI = {
  projectFunctionDeployments: (projectID: string, functionID: string, options: PaginationOptions = {}) => {
    const query = paginationParams(options).toString();
    return request(paginatedPath(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}/deployments`, query), z.object({ deployments: z.array(deploymentSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough());
  },
  uploadProjectFunctionDeployment: (projectID: string, functionID: string, form: FormData) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}/deployments`, z.object({ deployment: deploymentSchema }), { method: "POST", body: form }),
  activateProjectFunctionDeployment: (projectID: string, functionID: string, deploymentID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}/deployments/${encodeURIComponent(deploymentID)}/activate`, z.object({ function: functionSchema, deployment: deploymentSchema }), { method: "POST" }),
  deleteProjectFunctionDeployment: (projectID: string, functionID: string, deploymentID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}/deployments/${encodeURIComponent(deploymentID)}`, z.undefined(), { method: "DELETE" }),
  projectFunctionBuildLogs: (projectID: string, functionID: string, deploymentID: string, options: { limit?: number; after?: number } = {}) => {
    const params = paginationParams(options);
    if (options.after !== undefined) params.set("after", String(options.after));
    const query = params.toString();
    return request(paginatedPath(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}/deployments/${encodeURIComponent(deploymentID)}/logs`, query), z.object({ logs: z.array(functionBuildLogSchema), pagination: paginationSchema }).passthrough());
  },
  projectSiteDeployments: (projectID: string, siteID: string, options: PaginationOptions = {}) => {
    const query = paginationParams(options).toString();
    return request(paginatedPath(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}/deployments`, query), z.object({ deployments: z.array(deploymentSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough());
  },
  uploadProjectSiteDeployment: (projectID: string, siteID: string, form: FormData) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}/deployments`, z.object({ deployment: deploymentSchema }), { method: "POST", body: form }),
  activateProjectSiteDeployment: (projectID: string, siteID: string, deploymentID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}/deployments/${encodeURIComponent(deploymentID)}/activate`, z.object({ site: siteSchema, deployment: deploymentSchema }), { method: "POST" }),
  deleteProjectSiteDeployment: (projectID: string, siteID: string, deploymentID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}/deployments/${encodeURIComponent(deploymentID)}`, z.undefined(), { method: "DELETE" }),
  projectSiteBuildLogs: (projectID: string, siteID: string, deploymentID: string, options: { limit?: number; after?: number } = {}) => {
    const params = paginationParams(options);
    if (options.after !== undefined) params.set("after", String(options.after));
    const query = params.toString();
    return request(paginatedPath(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}/deployments/${encodeURIComponent(deploymentID)}/logs`, query), z.object({ logs: z.array(siteBuildLogSchema), pagination: paginationSchema }).passthrough());
  },
  createProjectSiteGitDeployment: (projectID: string, siteID: string, input: { repository: string; ref?: string; build_runtime?: "node-22" | "python-3.13" | "go-1.24"; build_command: string; output_directory?: string; activate?: boolean }) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/sites/${encodeURIComponent(siteID)}/deployments/git`, z.object({ deployment: deploymentSchema }), { method: "POST", body: JSON.stringify(input) }),
};
