import "server-only";

import { StealthAPIError, stealthAPI, type OrganizationIncident } from "@/lib/stealth-api";
import { adminIncidentFromRecord, type AdminIncidentOrganization } from "../incidents/admin-incidents";
import type { Incident } from "../types/incidents";

const INCIDENT_PAGE_LIMIT = 100;
const MAX_INCIDENT_PAGES = 100;

export type WorkspaceIncidentSnapshot = {
  incidents: Incident[];
  organizations: AdminIncidentOrganization[];
  organizationCount: number;
  unavailableOrganizations: number;
};

/** Load durable incidents for every organization visible to the Console user. */
export async function loadWorkspaceIncidents(): Promise<WorkspaceIncidentSnapshot> {
  const { organizations } = await stealthAPI.organizations();
  const results = await Promise.allSettled(organizations.map(async (organization) => {
    const response = await listAllIncidents(organization.id);
    return {
      organization: { id: organization.id, name: organization.name, canManage: response.canManage },
      incidents: response.incidents.map((incident) => adminIncidentFromRecord(incident, organization.name, response.canManage)),
    };
  }));
  if (results.some((result) => result.status === "rejected" && result.reason instanceof StealthAPIError && result.reason.status === 401)) {
    throw new StealthAPIError(401, "unauthorized", "Console session is invalid");
  }
  const available = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  const incidents = available.flatMap((result) => result.incidents);
  incidents.sort((left, right) => Date.parse(right.createdAt ?? "") - Date.parse(left.createdAt ?? ""));
  return {
    incidents,
    organizations: available.map((result) => result.organization),
    organizationCount: organizations.length,
    unavailableOrganizations: results.filter((result) => result.status === "rejected").length,
  };
}

async function listAllIncidents(organizationID: string): Promise<{ incidents: OrganizationIncident[]; canManage: boolean }> {
  const incidents: OrganizationIncident[] = [];
  let cursor: string | undefined;
  let canManage = false;
  for (let page = 0; page < MAX_INCIDENT_PAGES; page += 1) {
    const response = await stealthAPI.organizationIncidents(organizationID, { limit: INCIDENT_PAGE_LIMIT, cursor });
    canManage = response.can_manage;
    incidents.push(...response.incidents);
    const nextCursor = response.pagination.next_cursor;
    if (!nextCursor) return { incidents, canManage };
    cursor = nextCursor;
  }
  return { incidents, canManage };
}
