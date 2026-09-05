import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserAPIError, browserAPI, type BrowserAgentCatalog, type BrowserAgentTool } from "@/lib/browser-api";
import { routeTree } from "./router";

const accountResponse = {
  account: { id: "account-1", email: "owner@example.test", email_verified: true, created_at: "2026-09-05T00:00:00Z" },
};
const projectResponse = {
  project: { id: "project-1", organization_id: "organization-1", name: "Stealth", created_at: "2026-09-05T00:00:00Z" },
};
const organizationResponse = { id: "organization-1", name: "Stealth Org", slug: "stealth-org", created_at: "2026-09-05T00:00:00Z" };
const pagination = { limit: 100, next_cursor: null };
const functionResponse = {
  id: "function-1",
  project_id: "project-1",
  name: "worker",
  runtime: "node-22" as const,
  entrypoint: "src/index.ts",
  commands: "npm install",
  timeout_seconds: 15,
  enabled: true,
  logging: true,
  execute_permissions: ["any"],
  description: null,
  status: "active" as const,
  artifact_quota_bytes: 1_000_000,
  artifact_used_bytes: 0,
  artifact_reserved_bytes: 0,
  active_deployment_id: null,
  created_at: "2026-09-05T00:00:00Z",
  updated_at: "2026-09-05T00:00:00Z",
};
const siteResponse = {
  id: "site-1",
  project_id: "project-1",
  name: "marketing-site",
  framework: "static" as const,
  enabled: true,
  status: "active" as const,
  artifact_quota_bytes: 1_000_000,
  artifact_used_bytes: 0,
  artifact_reserved_bytes: 0,
  active_deployment_id: null,
  created_at: "2026-09-05T00:00:00Z",
  updated_at: "2026-09-05T00:00:00Z",
};
const databaseResponse = { id: "database-1", project_id: "project-1", name: "primary", created_at: "2026-09-05T00:00:00Z", updated_at: "2026-09-05T00:00:00Z" };
const bucketResponse = {
  id: "bucket-1",
  project_id: "project-1",
  name: "uploads",
  file_security: true,
  create_permissions: ["any"],
  read_permissions: ["any"],
  update_permissions: ["any"],
  delete_permissions: ["any"],
  max_file_size_bytes: 1_000_000,
  quota_bytes: 10_000_000,
  used_bytes: 0,
  created_at: "2026-09-05T00:00:00Z",
  updated_at: "2026-09-05T00:00:00Z",
};
const agentResponse = {
  id: "agent-1",
  project_id: "project-1",
  project_name: "Stealth",
  name: "Automation Helper",
  description: "Reviews changes",
  role: "Reviewer" as const,
  status: "active" as const,
  branch: "main",
  provider: "OpenAI",
  model: "GPT-5.6",
  current_task: null,
  last_active_at: null,
  tools: ["Read files", "Search code"] as BrowserAgentTool[],
  instructions: "Inspect first",
  created_by_account_id: "account-1",
  created_at: "2026-09-05T00:00:00Z",
  updated_at: "2026-09-05T00:00:00Z",
};
const agentCatalog: BrowserAgentCatalog = {
  providers: [{ id: "openai", name: "OpenAI", models: ["GPT-5.6"] }],
  roles: ["General", "Frontend", "Reviewer", "Documentation"],
  tools: ["Read files", "Search code", "Edit files", "Terminal", "Run tests", "Git diff"],
  execution: { mode: "queue_only", ready: false, message: "Runs are accepted into the durable queue." },
};

function createTestRouter(path: string) {
  return createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }), defaultPreload: "intent" });
}

function renderRouter(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const router = createTestRouter(path);
  render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>);
  return { router, queryClient };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

describe("Vite router runtime", () => {
  it("redirects an unauthenticated protected route to sign in", async () => {
    vi.spyOn(browserAPI, "currentAccount").mockRejectedValue(new BrowserAPIError(401, "unauthorized", "Sign in required."));

    const { router } = renderRouter("/projects/project-1/services");

    await waitFor(() => expect(router.history.location.pathname).toBe("/login"));
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeTruthy();
  });

  it("loads the service workspace through the real route and API fan-out", async () => {
    vi.spyOn(browserAPI, "currentAccount").mockResolvedValue(accountResponse);
    const project = vi.spyOn(browserAPI, "project").mockResolvedValue(projectResponse);
    const layout = vi.spyOn(browserAPI, "projectServiceLayout").mockResolvedValue({ layout: [], can_manage: true });
    const functions = vi.spyOn(browserAPI, "projectFunctions").mockResolvedValue({ functions: [functionResponse], pagination, can_manage: true });
    const sites = vi.spyOn(browserAPI, "projectSites").mockResolvedValue({ sites: [siteResponse], pagination, can_manage: true });
    const databases = vi.spyOn(browserAPI, "projectDatabases").mockResolvedValue({ databases: [databaseResponse], pagination, can_manage: true });
    const buckets = vi.spyOn(browserAPI, "projectStorageBuckets").mockResolvedValue({ buckets: [bucketResponse], pagination, can_manage: true });

    renderRouter("/projects/project-1/services");

    expect(await screen.findByRole("heading", { name: "Stealth services" })).toBeTruthy();
    expect(screen.getAllByText("worker").length).toBeGreaterThan(0);
    expect(screen.getAllByText("marketing-site").length).toBeGreaterThan(0);
    expect(screen.getAllByText("primary").length).toBeGreaterThan(0);
    expect(screen.getAllByText("uploads").length).toBeGreaterThan(0);
    expect(project).toHaveBeenCalledWith("project-1");
    expect(layout).toHaveBeenCalledWith("project-1");
    expect(functions).toHaveBeenCalledWith("project-1", { limit: 100 });
    expect(sites).toHaveBeenCalledWith("project-1", { limit: 100 });
    expect(databases).toHaveBeenCalledWith("project-1", { limit: 100 });
    expect(buckets).toHaveBeenCalledWith("project-1", { limit: 100 });
    expect(screen.getByRole("link", { name: "Services" }).getAttribute("href")).toBe("/projects/project-1/services");
  });

  it("navigates from the Agent list to an API-backed Agent workspace", async () => {
    vi.spyOn(browserAPI, "currentAccount").mockResolvedValue(accountResponse);
    vi.spyOn(browserAPI, "organizations").mockResolvedValue({ organizations: [organizationResponse], pagination });
    vi.spyOn(browserAPI, "projects").mockResolvedValue({ projects: [projectResponse.project], pagination });
    vi.spyOn(browserAPI, "agents").mockResolvedValue({ agents: [agentResponse], pagination });
    vi.spyOn(browserAPI, "agentCatalog").mockResolvedValue(agentCatalog);
    const agent = vi.spyOn(browserAPI, "agent").mockResolvedValue({ agent: agentResponse });
    const runs = vi.spyOn(browserAPI, "agentRuns").mockResolvedValue({ runs: [], pagination });

    const { router } = renderRouter("/agent");

    expect(await screen.findByRole("heading", { name: "Agents" })).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Open" }));
    await waitFor(() => expect(router.history.location.pathname).toBe("/agent/agent-1"));
    expect(await screen.findByRole("heading", { name: "Automation Helper" })).toBeTruthy();
    expect(agent).toHaveBeenCalledWith("agent-1");
    expect(runs).toHaveBeenCalledWith("agent-1", { limit: 50 });
  });
});
