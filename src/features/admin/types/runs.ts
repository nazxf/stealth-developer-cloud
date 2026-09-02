export type RunStatus = "running" | "completed" | "failed" | "queued" | "cancelled";

export type RunStepState = "done" | "failed" | "running" | "pending";

/** One step in a run's execution timeline. */
export interface RunStep {
  label: string;
  state: RunStepState;
}

/** An agent run observed from the platform's point of view. */
export interface AgentRun {
  id: string;
  user: string;
  agent: string;
  agentId: string;
  projectId: string;
  project: string;
  provider: string;
  model: string;
  tokensIn: string;
  tokensOut: string;
  cost: string;
  duration: string;
  status: RunStatus;
  prompt: string;
  outputText?: string;
  startedAt: string;
  queuedAt: string;
  finishedAt?: string;
  steps: RunStep[];
  changes: Array<{ path: string; additions: number; deletions: number; status: "added" | "modified" }>;
  error?: string;
}

/** Legacy fixture shape used only by the preview Recent Runs card. */
export interface PreviewAgentRun {
  id: string;
  user: string;
  agent: string;
  provider: string;
  model: string;
  tokensIn: string;
  tokensOut: string;
  cost: string;
  duration: string;
  status: Exclude<RunStatus, "cancelled">;
  startedAt: string;
  steps: RunStep[];
  error?: string;
  repository: string;
  traceId: string;
}
