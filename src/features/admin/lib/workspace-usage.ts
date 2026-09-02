import "server-only";

import { StealthAPIError, stealthAPI, type ProjectUsage } from "@/lib/stealth-api";
import type { AdminOverviewSnapshot } from "../overview/admin-overview-types";

/** Load the current account's projects and aggregate their durable usage rows. */
export async function loadWorkspaceUsage(): Promise<AdminOverviewSnapshot> {
  const { organizations } = await stealthAPI.organizations();
  const projectGroups = await Promise.all(
    organizations.map(async (organization) => {
      const response = await stealthAPI.projects(organization.id);
      return response.projects;
    }),
  );
  const projects = projectGroups.flat();
  const usageResults = await Promise.allSettled(projects.map((project) => stealthAPI.projectUsage(project.id)));
  if (usageResults.some((result) => result.status === "rejected" && result.reason instanceof StealthAPIError && result.reason.status === 401)) {
    throw new StealthAPIError(401, "unauthorized", "Console session is invalid");
  }
  const usages = usageResults.flatMap((result) => result.status === "fulfilled" ? [result.value.usage] : []);
  return aggregateSnapshot(organizations.length, projects.length, usageResults, usages);
}

function aggregateSnapshot(
  organizations: number,
  projects: number,
  results: PromiseSettledResult<{ usage: ProjectUsage }>[],
  usages: ProjectUsage[],
): AdminOverviewSnapshot {
  const sum = (key: keyof ProjectUsage) => usages.reduce((total, usage) => total + Number(usage[key] ?? 0), 0);
  const capturedAt = usages.map((usage) => usage.captured_at).filter(Boolean).sort().at(-1) ?? null;
  return {
    capturedAt,
    organizations,
    projects,
    unavailableProjects: results.filter((result) => result.status === "rejected").length,
    applicationUsers: sum("application_users"),
    databaseCount: sum("database_count"),
    databaseTableCount: sum("database_table_count"),
    databaseRowCount: sum("database_row_count"),
    storageFileCount: sum("storage_file_count"),
    storageBytes: sum("storage_bytes"),
    storageQuotaBytes: sum("storage_quota_bytes"),
    functionCount: sum("function_count"),
    functionArtifactBytes: sum("function_artifact_bytes"),
    functionQuotaBytes: sum("function_quota_bytes"),
    siteCount: sum("site_count"),
    siteArtifactBytes: sum("site_artifact_bytes"),
    siteReservedBytes: sum("site_reserved_bytes"),
    siteQuotaBytes: sum("site_quota_bytes"),
    realtimeEventCount: sum("realtime_event_count"),
    webhookDeliveryCount7d: sum("webhook_delivery_count_7d"),
  };
}
