import type { Agent, AgentRecord, AgentRun, AgentRunRecord } from "./types";

/** Convert the API's timestamped resource into the view model used by both
 * the roster and workspace. No placeholder activity values are introduced;
 * an agent with no recorded run is sorted from its durable update timestamp. */
export function agentFromRecord(record: AgentRecord): Agent {
  const activityTimestamp = record.last_active_at ?? record.updated_at ?? record.created_at;
  const elapsed = Math.max(0, Date.now() - new Date(activityTimestamp).getTime());
  return {
    id: record.id,
    projectId: record.project_id,
    name: record.name,
    description: record.description,
    role: record.role,
    status: record.status,
    project: record.project_name,
    branch: record.branch,
    provider: record.provider,
    model: record.model,
    currentTask: record.current_task ?? undefined,
    lastActiveMinutes: Math.floor(elapsed / 60_000),
    tools: record.tools,
    instructions: record.instructions ?? undefined,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

/** Convert the snake_case wire record into the workspace's display model. */
export function agentRunFromRecord(record: AgentRunRecord): AgentRun {
  return {
    id: record.id,
    agentId: record.agent_id,
    projectId: record.project_id,
    prompt: record.prompt,
    status: record.status,
    steps: record.steps ?? [],
    changes: record.changes?.length ? record.changes : undefined,
    outputText: record.output_text ?? undefined,
    errorMessage: record.error_message ?? undefined,
    queuedAt: record.queued_at,
    startedAt: record.started_at ?? undefined,
    finishedAt: record.finished_at ?? undefined,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}
