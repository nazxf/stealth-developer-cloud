import { z } from "zod";
import { request } from "../api-core";
import { paginationParams, paginationSchema, paginatedPath, type PaginationOptions } from "./common";

const functionRuntimeSchema = z.enum(["node-22", "python-3.13", "go-1.24"]);
export const functionSchema = z.object({
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

export { functionBuildLogSchema };

export type BrowserFunction = z.infer<typeof functionSchema>;
export type BrowserFunctionVariable = z.infer<typeof functionVariableSchema>;
export type BrowserFunctionExecution = z.infer<typeof functionExecutionSchema>;
export type BrowserFunctionExecutionLog = z.infer<typeof functionExecutionLogSchema>;
export type BrowserFunctionRuntime = z.infer<typeof functionRuntimeSchema>;

export const functionsAPI = {
  projectFunctions: (projectID: string, options: PaginationOptions = {}) => {
    const query = paginationParams(options).toString();
    return request(paginatedPath(`/v1/projects/${encodeURIComponent(projectID)}/functions`, query), z.object({ functions: z.array(functionSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough());
  },
  projectFunction: (projectID: string, functionID: string) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}`, z.object({ function: functionSchema })),
  createProjectFunction: (projectID: string, input: { name: string; runtime?: BrowserFunctionRuntime; entrypoint?: string; commands?: string; timeout_seconds?: number; enabled?: boolean; logging?: boolean; execute_permissions?: string[]; description?: string; artifact_quota_bytes?: number }) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/functions`, z.object({ function: functionSchema }), { method: "POST", body: JSON.stringify(input) }),
  updateProjectFunction: (projectID: string, functionID: string, input: Partial<{ name: string; runtime: BrowserFunctionRuntime; entrypoint: string; commands: string; timeout_seconds: number; enabled: boolean; logging: boolean; execute_permissions: string[]; description: string; artifact_quota_bytes: number }>) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}`, z.object({ function: functionSchema }), { method: "PATCH", body: JSON.stringify(input) }),
  deleteProjectFunction: (projectID: string, functionID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}`, z.undefined(), { method: "DELETE" }),
  projectFunctionVariables: (projectID: string, functionID: string, options: PaginationOptions = {}) => {
    const query = paginationParams(options).toString();
    return request(paginatedPath(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}/variables`, query), z.object({ variables: z.array(functionVariableSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough());
  },
  createProjectFunctionVariable: (projectID: string, functionID: string, input: { key: string; kind?: "variable" | "secret"; is_secret?: boolean; value: string; description?: string }) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}/variables`, z.object({ variable: functionVariableSchema }), { method: "POST", body: JSON.stringify(input) }),
  updateProjectFunctionVariable: (projectID: string, functionID: string, variableID: string, input: Partial<{ key: string; value: string; description: string }>) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}/variables/${encodeURIComponent(variableID)}`, z.object({ variable: functionVariableSchema }), { method: "PATCH", body: JSON.stringify(input) }),
  deleteProjectFunctionVariable: (projectID: string, functionID: string, variableID: string) =>
    request<void>(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}/variables/${encodeURIComponent(variableID)}`, z.undefined(), { method: "DELETE" }),
  projectFunctionExecutions: (projectID: string, functionID: string, options: PaginationOptions = {}) => {
    const query = paginationParams(options).toString();
    return request(paginatedPath(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}/executions`, query), z.object({ executions: z.array(functionExecutionSchema), pagination: paginationSchema }).passthrough());
  },
  createProjectFunctionExecution: (projectID: string, functionID: string, input: { trigger?: string; input?: unknown }) =>
    request(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}/executions`, z.object({ execution: functionExecutionSchema }), { method: "POST", body: JSON.stringify(input) }),
  projectFunctionExecutionLogs: (projectID: string, functionID: string, executionID: string, options: { limit?: number; after?: number } = {}) => {
    const params = paginationParams(options);
    if (options.after !== undefined) params.set("after", String(options.after));
    const query = params.toString();
    return request(paginatedPath(`/v1/projects/${encodeURIComponent(projectID)}/functions/${encodeURIComponent(functionID)}/executions/${encodeURIComponent(executionID)}/logs`, query), z.object({ logs: z.array(functionExecutionLogSchema), pagination: paginationSchema }).passthrough());
  },
};
