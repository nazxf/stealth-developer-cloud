import type { FunctionExecution, Organization, Project, ProjectFunction } from "@/lib/stealth-api";
import type { FunctionErrorGroup, FunctionFailure } from "../types/errors";

export type FunctionFailureContext = {
  organization: Organization;
  project: Project;
  function: ProjectFunction;
};

/** Convert one API execution into the safe, display-only failure model. */
export function functionFailureFromExecution(execution: FunctionExecution, context: FunctionFailureContext): FunctionFailure | null {
  if (execution.status !== "failed") return null;
  const message = execution.error_message?.trim() || "Function execution failed without an error message.";
  return {
    executionId: execution.id,
    organizationId: context.organization.id,
    organizationName: context.organization.name,
    projectId: context.project.id,
    projectName: context.project.name,
    functionId: context.function.id,
    functionName: context.function.name,
    runtime: context.function.runtime,
    status: "failed",
    trigger: execution.trigger,
    message,
    responseStatus: execution.response_status,
    createdAt: execution.created_at,
    startedAt: execution.started_at,
    finishedAt: execution.finished_at,
  };
}

/** Group exact error messages without inventing signatures or user counts. */
export function groupFunctionFailures(failures: FunctionFailure[]): FunctionErrorGroup[] {
  const groups = new Map<string, FunctionErrorGroup>();
  for (const failure of failures) {
    const id = [failure.organizationId, failure.projectId, failure.functionId, failure.message].join(":");
    const existing = groups.get(id);
    if (existing) {
      existing.count += 1;
      existing.occurrences.push(failure);
      if (compareTimestamps(failure.createdAt, existing.firstSeen) < 0) existing.firstSeen = failure.createdAt;
      if (compareTimestamps(failure.createdAt, existing.lastSeen) > 0) {
        existing.lastSeen = failure.createdAt;
        existing.latestExecutionId = failure.executionId;
      }
      continue;
    }
    groups.set(id, {
      id,
      organizationId: failure.organizationId,
      organizationName: failure.organizationName,
      projectId: failure.projectId,
      projectName: failure.projectName,
      functionId: failure.functionId,
      functionName: failure.functionName,
      runtime: failure.runtime,
      status: "failed",
      count: 1,
      firstSeen: failure.createdAt,
      lastSeen: failure.createdAt,
      message: failure.message,
      latestExecutionId: failure.executionId,
      occurrences: [failure],
    });
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      occurrences: [...group.occurrences]
        .sort((left, right) => compareTimestamps(right.createdAt, left.createdAt))
        .slice(0, 25),
    }))
    .sort((left, right) => compareTimestamps(right.lastSeen, left.lastSeen));
}

function compareTimestamps(left: string, right: string) {
  const leftValue = Date.parse(left);
  const rightValue = Date.parse(right);
  if (Number.isFinite(leftValue) && Number.isFinite(rightValue)) return leftValue - rightValue;
  return left.localeCompare(right);
}
