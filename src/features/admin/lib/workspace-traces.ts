import "server-only";

import { StealthAPIError, stealthAPI, type Organization, type OrganizationTrace } from "@/lib/stealth-api";
import { adminTraceFromRecord } from "../traces/admin-traces";
import type { Trace } from "../types/traces";

const PAGE_LIMIT = 100;
const MAX_PAGES = 100;

export type WorkspaceTracesSnapshot = {
  traces: Trace[];
  organizationCount: number;
  unavailableOrganizations: number;
  truncatedOrganizations: number;
};

/** Load the tenant-scoped root request index for every visible organization. */
export async function loadWorkspaceTraces(): Promise<WorkspaceTracesSnapshot> {
  const organizations = await listAllOrganizations();
  const results = await Promise.allSettled(
    organizations.map(async (organization) => ({ organization, traces: await listAllTraces(organization.id) })),
  );
  throwUnauthorized(results);

  const available = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  const traces = available.flatMap((result) => result.traces.items.map(adminTraceFromRecord));
  traces.sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));

  return {
    traces,
    organizationCount: organizations.length,
    unavailableOrganizations: results.filter((result) => result.status === "rejected").length,
    truncatedOrganizations: available.filter((result) => result.traces.truncated).length,
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

async function listAllTraces(organizationID: string): Promise<{ items: OrganizationTrace[]; truncated: boolean }> {
  const items: OrganizationTrace[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await stealthAPI.organizationTraces(organizationID, { limit: PAGE_LIMIT, cursor });
    items.push(...response.traces);
    if (!response.pagination.next_cursor) return { items, truncated: false };
    cursor = response.pagination.next_cursor;
  }
  return { items, truncated: true };
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
