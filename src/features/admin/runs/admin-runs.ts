import type { AgentRecord, AgentRunRecord } from "@/features/agents/types";
import type { AgentRun, RunStepState } from "../types/runs";

/** Convert durable API records to the fields used by the admin table. */
export function adminRunFromRecord(record: AgentRunRecord, agent: AgentRecord, currentAccountID: string, currentAccountEmail: string): AgentRun {
  return {
    id: record.id,
    user: record.created_by_account_id === currentAccountID ? currentAccountEmail : "Workspace member",
    agent: agent.name,
    agentId: agent.id,
    projectId: agent.project_id,
    project: agent.project_name,
    provider: agent.provider || "—",
    model: agent.model || "—",
    tokensIn: "—",
    tokensOut: "—",
    cost: "—",
    duration: formatDuration(record.started_at, record.finished_at),
    status: record.status,
    prompt: record.prompt,
    outputText: record.output_text ?? undefined,
    startedAt: formatTimestamp(record.started_at),
    queuedAt: formatTimestamp(record.queued_at),
    finishedAt: record.finished_at ? formatTimestamp(record.finished_at) : undefined,
    steps: (record.steps ?? []).map((step) => ({ label: step.label, state: runStepState(step.status, record.status) })),
    changes: record.changes ?? [],
    error: record.error_message ?? undefined,
  };
}

function runStepState(status: "pending" | "done", runStatus: AgentRunRecord["status"]): RunStepState {
  if (status === "done") return "done";
  return runStatus === "running" ? "running" : "pending";
}

function formatDuration(startedAt?: string | null, finishedAt?: string | null) {
  if (!startedAt) return "—";
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started)) return "—";
  if (!finishedAt) return "running";
  const finished = Date.parse(finishedAt);
  if (!Number.isFinite(finished) || finished < started) return "—";
  const seconds = Math.floor((finished - started) / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

function formatTimestamp(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return `${parsed.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
