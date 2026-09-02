export type AgentRole = "General" | "Frontend" | "Reviewer" | "Documentation";
export type AgentStatus = "active" | "running" | "idle";
export type AgentTool =
  | "Read files"
  | "Search code"
  | "Edit files"
  | "Terminal"
  | "Run tests"
  | "Git diff";

/** A coding agent: what it is, where it works, and what it is allowed to do. */
export interface Agent {
  id: string;
  projectId: string;
  name: string;
  description: string;
  role: AgentRole;
  status: AgentStatus;
  project: string;
  branch: string;
  provider: string;
  model: string;
  /** Task currently being worked on, if any. */
  currentTask?: string;
  /** Minutes since the last activity — drives "2m ago" labels and recency sort. */
  lastActiveMinutes: number;
  tools: AgentTool[];
  instructions?: string;
  createdAt: string;
  updatedAt: string;
}

/** Wire representation returned by the Console Agent control plane. */
export interface AgentRecord {
  id: string;
  project_id: string;
  project_name: string;
  name: string;
  description: string;
  role: AgentRole;
  status: AgentStatus;
  branch: string;
  provider: string;
  model: string;
  current_task?: string | null;
  last_active_at?: string | null;
  tools: AgentTool[];
  instructions?: string | null;
  created_by_account_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentCreateDraft {
  projectId: string;
  name: string;
  role: AgentRole;
  description: string;
  provider: string;
  model: string;
  branch: string;
  instructions: string;
  tools: AgentTool[];
}

export type AgentStepType = "read" | "edit" | "search" | "command" | "check";
export type AgentStepStatus = "pending" | "done";

export interface AgentStep {
  id: string;
  type: AgentStepType;
  label: string;
  target: string;
  status: AgentStepStatus;
}

export interface FileChange {
  path: string;
  additions: number;
  deletions: number;
  status: "modified" | "added";
}

export type AgentRunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface AgentRun {
  id: string;
  agentId: string;
  projectId: string;
  prompt: string;
  status: AgentRunStatus;
  steps: AgentStep[];
  changes?: FileChange[];
  outputText?: string;
  errorMessage?: string;
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Wire representation returned by the durable Agent run queue. */
export interface AgentRunRecord {
  id: string;
  agent_id: string;
  project_id: string;
  prompt: string;
  status: AgentRunStatus;
  output_text?: string | null;
  error_message?: string | null;
  steps: AgentStep[];
  changes: FileChange[];
  created_by_account_id?: string | null;
  queued_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentRunLogRecord {
  id: string;
  run_id: string;
  project_id: string;
  sequence: number;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  created_at: string;
}

export type WorkspaceTab = "chat" | "tasks" | "changes" | "activity" | "settings";

export type WorkspaceMessage =
  | { id: string; role: "user"; text: string; time: string }
  | {
      id: string;
      role: "agent";
      text: string;
      time: string;
      status: AgentRunStatus;
      steps: AgentStep[];
      changes?: FileChange[];
      runId: string;
      errorMessage?: string;
    };
