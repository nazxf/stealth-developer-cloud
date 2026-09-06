import { z } from "zod";
import { request } from "../api-core";
import { paginationParams, paginationSchema, paginatedPath, type PaginationOptions } from "./common";

const agentRoleSchema = z.enum(["General", "Frontend", "Reviewer", "Documentation"]);
const agentStatusSchema = z.enum(["active", "running", "idle"]);
const agentToolSchema = z.enum(["Read files", "Search code", "Edit files", "Terminal", "Run tests", "Git diff"]);
const agentProviderCatalogItemSchema = z.object({ id: z.string(), name: z.string(), models: z.array(z.string()) });
const agentCatalogExecutionSchema = z.object({ mode: z.literal("queue_only"), ready: z.boolean(), message: z.string() });
const agentCatalogSchema = z.object({
  providers: z.array(agentProviderCatalogItemSchema),
  roles: z.array(agentRoleSchema),
  tools: z.array(agentToolSchema),
  execution: agentCatalogExecutionSchema,
});
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

export type BrowserAgent = z.infer<typeof agentSchema>;
export type BrowserAgentRun = z.infer<typeof agentRunSchema>;
export type BrowserAgentRole = z.infer<typeof agentRoleSchema>;
export type BrowserAgentTool = z.infer<typeof agentToolSchema>;
export type BrowserAgentProvider = z.infer<typeof agentProviderCatalogItemSchema>;
export type BrowserAgentCatalog = z.infer<typeof agentCatalogSchema>;

export const agentsAPI = {
  agentCatalog: () => request("/v1/agent-catalog", agentCatalogSchema),
  agents: (options: { limit?: number; cursor?: string; project_id?: string } = {}) => {
    const params = paginationParams(options);
    if (options.project_id) params.set("project_id", options.project_id);
    const query = params.toString();
    return request(paginatedPath("/v1/agents", query), z.object({ agents: z.array(agentSchema), pagination: paginationSchema }).passthrough());
  },
  agent: (agentID: string) => request(`/v1/agents/${encodeURIComponent(agentID)}`, z.object({ agent: agentSchema })),
  createAgent: (input: { project_id: string; name: string; description?: string; role: BrowserAgentRole; branch?: string; provider: string; model: string; current_task?: string | null; tools?: BrowserAgentTool[]; instructions?: string | null }) =>
    request("/v1/agents", z.object({ agent: agentSchema }), { method: "POST", body: JSON.stringify(input) }),
  updateAgent: (agentID: string, input: Partial<{ name: string; description: string; role: BrowserAgentRole; branch: string; provider: string; model: string; current_task: string | null; tools: BrowserAgentTool[]; instructions: string | null }>) =>
    request(`/v1/agents/${encodeURIComponent(agentID)}`, z.object({ agent: agentSchema }), { method: "PATCH", body: JSON.stringify(input) }),
  deleteAgent: (agentID: string) => request<void>(`/v1/agents/${encodeURIComponent(agentID)}`, z.undefined(), { method: "DELETE" }),
  agentRuns: (agentID: string, options: PaginationOptions = {}) => {
    const query = paginationParams(options).toString();
    return request(paginatedPath(`/v1/agents/${encodeURIComponent(agentID)}/runs`, query), z.object({ runs: z.array(agentRunSchema), pagination: paginationSchema }).passthrough());
  },
  createAgentRun: (agentID: string, input: { prompt: string }) =>
    request(`/v1/agents/${encodeURIComponent(agentID)}/runs`, z.object({ run: agentRunSchema }), { method: "POST", body: JSON.stringify(input) }),
  cancelAgentRun: (agentID: string, runID: string) =>
    request(`/v1/agents/${encodeURIComponent(agentID)}/runs/${encodeURIComponent(runID)}/cancel`, z.object({ run: agentRunSchema }), { method: "POST" }),
  agentRunLogs: (agentID: string, runID: string, options: { limit?: number; after?: number } = {}) => {
    const params = paginationParams(options);
    if (options.after !== undefined) params.set("after", String(options.after));
    const query = params.toString();
    return request(paginatedPath(`/v1/agents/${encodeURIComponent(agentID)}/runs/${encodeURIComponent(runID)}/logs`, query), z.object({ logs: z.array(agentRunLogSchema), pagination: paginationSchema }).passthrough());
  },
};
