import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserAPIError, browserAPI, type BrowserAgentCatalog, type BrowserAgentTool } from "@/lib/browser-api";
import { AgentCreateForm } from "./agent-create-form";

const agentResponse = {
  id: "agent-1",
  project_id: "project-1",
  project_name: "Stealth",
  name: "Frontend Helper",
  description: "Reviews frontend changes",
  role: "Frontend" as const,
  status: "active" as const,
  branch: "main",
  provider: "OpenAI",
  model: "GPT-5.6",
  current_task: null,
  last_active_at: null,
  tools: ["Edit files"] as BrowserAgentTool[],
  instructions: "Inspect first",
  created_by_account_id: "account-1",
  created_at: "2026-09-05T00:00:00Z",
  updated_at: "2026-09-05T00:00:00Z",
};

const catalog: BrowserAgentCatalog = {
  providers: [
    { id: "openai", name: "OpenAI", models: ["GPT-5.6"] },
    { id: "anthropic", name: "Anthropic", models: ["Claude Sonnet 4.5"] },
  ],
  roles: ["General", "Frontend", "Reviewer", "Documentation"],
  tools: ["Read files", "Search code", "Edit files", "Terminal", "Run tests", "Git diff"],
  execution: { mode: "queue_only", ready: false, message: "Runs are accepted into the durable queue." },
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AgentCreateForm", () => {
  it("normalizes text and submits the durable agent configuration", async () => {
    const createAgent = vi.spyOn(browserAPI, "createAgent").mockResolvedValue({ agent: agentResponse });
    const onClose = vi.fn();

    render(<AgentCreateForm projects={[{ id: "project-1", name: "Stealth" }]} catalog={catalog} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: " Frontend Helper " } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: " Reviews frontend changes " } });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "Frontend" } });
    fireEvent.change(screen.getByLabelText("Branch"), { target: { value: " feature/ui " } });
    fireEvent.click(screen.getByRole("button", { name: "Create agent" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(createAgent).toHaveBeenCalledWith({
      project_id: "project-1",
      name: "Frontend Helper",
      description: "Reviews frontend changes",
      role: "Frontend",
      branch: "feature/ui",
      provider: "openai",
      model: "GPT-5.6",
      instructions: "Inspect the repository before making changes. Read project instructions before editing. Prefer small, focused changes and run typecheck after editing.",
      tools: ["Read files", "Search code", "Edit files", "Terminal", "Run tests", "Git diff"],
    });
  });

  it("rejects an invalid name before making an API request", async () => {
    const createAgent = vi.spyOn(browserAPI, "createAgent");

    render(<AgentCreateForm projects={[{ id: "project-1", name: "Stealth" }]} catalog={catalog} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Create agent" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Agent name must be at least 2 characters.");
    expect(createAgent).not.toHaveBeenCalled();
  });

  it("renders a safe API error", async () => {
    vi.spyOn(browserAPI, "createAgent").mockRejectedValue(new BrowserAPIError(409, "conflict", "An agent with this name already exists."));

    render(<AgentCreateForm projects={[{ id: "project-1", name: "Stealth" }]} catalog={catalog} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Frontend Helper" } });
    fireEvent.click(screen.getByRole("button", { name: "Create agent" }));

    expect((await screen.findByRole("alert")).textContent).toBe("An agent with this name already exists.");
  });
});
