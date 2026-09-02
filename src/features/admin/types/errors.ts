/** A failed Function execution read from the durable execution table. */
export interface FunctionFailure {
  executionId: string;
  organizationId: string;
  organizationName: string;
  projectId: string;
  projectName: string;
  functionId: string;
  functionName: string;
  runtime: string;
  status: "failed";
  trigger: string;
  message: string;
  responseStatus?: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}

/** Exact-message failures grouped within one organization/project/function. */
export interface FunctionErrorGroup {
  id: string;
  organizationId: string;
  organizationName: string;
  projectId: string;
  projectName: string;
  functionId: string;
  functionName: string;
  runtime: string;
  status: "failed";
  count: number;
  firstSeen: string;
  lastSeen: string;
  message: string;
  latestExecutionId: string;
  occurrences: FunctionFailure[];
}
