import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserAPIError, browserAPI, type BrowserAgentTool } from "@/lib/browser-api";
import { AgentRunForm } from "./agent-run-form";

const runResponse = {
  id: "run-1",
  agent_id: "agent-1",
  project_id: "project-1",
  prompt: "Inspect the app",
  status: "queued" as const,
  output_text: null,
  error_message: null,
  steps: [],
  changes: [],
  created_by_account_id: "account-1",
  queued_at: "2026-09-05T00:00:00Z",
  started_at: null,
  finished_at: null,
  created_at: "2026-09-05T00:00:00Z",
  updated_at: "2026-09-05T00:00:00Z",
};

const tools: BrowserAgentTool[] = ["Read files", "Search code", "Run tests"];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AgentRunForm", () => {
  it("trims a prompt, queues a durable run, and selects it", async () => {
    const createRun = vi.spyOn(browserAPI, "createAgentRun").mockResolvedValue({ run: runResponse });
    const onQueued = vi.fn();
    const onError = vi.fn();

    render(<AgentRunForm agentID="agent-1" tools={tools} onQueued={onQueued} onError={onError} />);
    fireEvent.change(screen.getByLabelText("Prompt"), { target: { value: "  Inspect the app  " } });
    fireEvent.click(screen.getByRole("button", { name: "Queue run" }));

    await waitFor(() => expect(onQueued).toHaveBeenCalledWith("run-1"));
    expect(createRun).toHaveBeenCalledWith("agent-1", { prompt: "Inspect the app" });
    expect(onError).toHaveBeenCalledWith("");
  });

  it("rejects an empty prompt locally", async () => {
    const createRun = vi.spyOn(browserAPI, "createAgentRun");
    const onError = vi.fn();

    render(<AgentRunForm agentID="agent-1" tools={tools} onQueued={vi.fn()} onError={onError} />);
    fireEvent.submit(screen.getByLabelText("Prompt").closest("form")!);

    expect(onError).toHaveBeenCalledWith("Prompt is required.");
    expect(createRun).not.toHaveBeenCalled();
  });

  it("forwards a safe API error", async () => {
    vi.spyOn(browserAPI, "createAgentRun").mockRejectedValue(new BrowserAPIError(409, "conflict", "An agent run is already being processed."));
    const onError = vi.fn();

    render(<AgentRunForm agentID="agent-1" tools={tools} onQueued={vi.fn()} onError={onError} />);
    fireEvent.change(screen.getByLabelText("Prompt"), { target: { value: "Inspect the app" } });
    fireEvent.click(screen.getByRole("button", { name: "Queue run" }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith("An agent run is already being processed."));
  });
});
