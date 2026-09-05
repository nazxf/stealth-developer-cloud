export const operationPollIntervalMs = 2_500;

type DeploymentState = {
  status?: unknown;
  build_status?: unknown;
};

type ExecutionState = {
  status?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function deploymentIsInProgress(deployment: DeploymentState | undefined) {
  if (!deployment) return false;
  return (
    deployment.status === "queued" ||
    deployment.status === "building" ||
    deployment.build_status === "queued" ||
    deployment.build_status === "running" ||
    deployment.build_status === "deferred"
  );
}

export function executionIsInProgress(execution: ExecutionState | undefined) {
  return execution?.status === "accepted" || execution?.status === "running";
}

export function deploymentPollInterval(data: unknown, enabled: boolean) {
  if (!enabled) return false;
  if (data === undefined) return operationPollIntervalMs;
  if (!isRecord(data) || !Array.isArray(data.deployments)) return false;
  return data.deployments.some((deployment) => isRecord(deployment) && deploymentIsInProgress(deployment))
    ? operationPollIntervalMs
    : false;
}

export function executionPollInterval(data: unknown, enabled: boolean) {
  if (!enabled) return false;
  if (data === undefined) return operationPollIntervalMs;
  if (!isRecord(data) || !Array.isArray(data.executions)) return false;
  return data.executions.some((execution) => isRecord(execution) && executionIsInProgress(execution))
    ? operationPollIntervalMs
    : false;
}
