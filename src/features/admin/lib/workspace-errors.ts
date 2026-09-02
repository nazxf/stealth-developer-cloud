import "server-only";

import {
  StealthAPIError,
  stealthAPI,
  type FunctionExecution,
  type Organization,
  type Project,
  type ProjectFunction,
} from "@/lib/stealth-api";
import { groupFunctionFailures, functionFailureFromExecution, type FunctionFailureContext } from "../errors/admin-errors";
import type { FunctionErrorGroup, FunctionFailure } from "../types/errors";

const PAGE_LIMIT = 100;
const MAX_PAGES = 100;

export type WorkspaceErrorsSnapshot = {
  groups: FunctionErrorGroup[];
  failures: FunctionFailure[];
  organizationCount: number;
  projectCount: number;
  functionCount: number;
  unavailableOrganizations: number;
  unavailableProjects: number;
  unavailableFunctions: number;
};

type ProjectContext = { organization: Organization; project: Project };

/** Load failed Function executions visible to the authenticated workspace. */
export async function loadWorkspaceErrors(): Promise<WorkspaceErrorsSnapshot> {
  const organizations = await listAllOrganizations();
  const projectResults = await Promise.allSettled(
    organizations.map(async (organization) => ({
      organization,
      projects: await listAllProjects(organization.id),
    })),
  );
  throwUnauthorized(projectResults);

  const projectContexts = projectResults.flatMap((result): ProjectContext[] =>
    result.status === "fulfilled"
      ? result.value.projects.map((project) => ({ organization: result.value.organization, project }))
      : [],
  );
  const executionResults = await Promise.allSettled(projectContexts.map((context) => readProjectFailures(context)));
  throwUnauthorized(executionResults);

  const available = executionResults.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  const failures = available.flatMap((result) => result.failures);
  return {
    groups: groupFunctionFailures(failures),
    failures,
    organizationCount: organizations.length,
    projectCount: projectContexts.length,
    functionCount: available.reduce((total, result) => total + result.functionCount, 0),
    unavailableOrganizations: projectResults.filter((result) => result.status === "rejected").length,
    unavailableProjects: executionResults.filter((result) => result.status === "rejected").length,
    unavailableFunctions: available.reduce((total, result) => total + result.unavailableFunctions, 0),
  };
}

async function readProjectFailures(context: ProjectContext) {
  const functions = await listAllFunctions(context.project.id);
  const functionResults = await Promise.allSettled(
    functions.map((fn) => listAllExecutions(context.project.id, fn.id).then((executions) => ({ fn, executions }))),
  );
  throwUnauthorized(functionResults);
  const failures = functionResults.flatMap((result) => {
    if (result.status !== "fulfilled") return [];
    const failureContext: FunctionFailureContext = { organization: context.organization, project: context.project, function: result.value.fn };
    return result.value.executions.flatMap((execution) => {
      const failure = functionFailureFromExecution(execution, failureContext);
      return failure ? [failure] : [];
    });
  });
  return {
    failures,
    functionCount: functions.length,
    unavailableFunctions: functionResults.filter((result) => result.status === "rejected").length,
  };
}

async function listAllOrganizations(): Promise<Organization[]> {
  const items: Organization[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await stealthAPI.organizations({ limit: PAGE_LIMIT, cursor });
    items.push(...response.organizations);
    if (!response.pagination.next_cursor) return items;
    cursor = response.pagination.next_cursor;
  }
  return items;
}

async function listAllProjects(organizationID: string): Promise<Project[]> {
  const items: Project[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await stealthAPI.projects(organizationID, { limit: PAGE_LIMIT, cursor });
    items.push(...response.projects);
    if (!response.pagination.next_cursor) return items;
    cursor = response.pagination.next_cursor;
  }
  return items;
}

async function listAllFunctions(projectID: string): Promise<ProjectFunction[]> {
  const items: ProjectFunction[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await stealthAPI.projectFunctions(projectID, { limit: PAGE_LIMIT, cursor });
    items.push(...response.functions);
    if (!response.pagination.next_cursor) return items;
    cursor = response.pagination.next_cursor;
  }
  return items;
}

async function listAllExecutions(projectID: string, functionID: string): Promise<FunctionExecution[]> {
  const items: FunctionExecution[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await stealthAPI.projectFunctionExecutions(projectID, functionID, { limit: PAGE_LIMIT, cursor });
    items.push(...response.executions);
    if (!response.pagination.next_cursor) return items;
    cursor = response.pagination.next_cursor;
  }
  return items;
}

function throwUnauthorized(results: Array<PromiseSettledResult<unknown>>) {
  const unauthorized = results.find((result) => result.status === "rejected" && isUnauthorized(result.reason));
  if (unauthorized?.status === "rejected") {
    throw new StealthAPIError(401, "unauthorized", "Console session is invalid");
  }
}

function isUnauthorized(reason: unknown): reason is StealthAPIError {
  return reason instanceof StealthAPIError && reason.status === 401;
}
