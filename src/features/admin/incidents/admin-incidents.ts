import type { OrganizationIncident } from "@/lib/stealth-api";
import type { Incident, IncidentStatus } from "../types/incidents";

export type AdminIncidentOrganization = {
  id: string;
  name: string;
  canManage: boolean;
};

/** Convert the wire representation into the display model used by the board. */
export function adminIncidentFromRecord(record: OrganizationIncident, organizationName: string, canManage: boolean, now = Date.now()): Incident {
  const startedAt = formatRelative(record.started_at, now);
  const resolvedAt = record.resolved_at ? formatRelative(record.resolved_at, now) : undefined;
  return {
    id: record.id,
    organizationId: record.organization_id,
    organizationName,
    canManage,
    title: record.title,
    severity: record.severity,
    services: record.services,
    status: record.status,
    startedAt,
    duration: formatDuration(record.started_at, record.resolved_at, now),
    updates: record.updates.map((update) => ({
      time: formatRelative(update.created_at, now),
      status: update.status,
      message: update.message,
    })),
    createdAt: record.created_at,
    resolvedAt,
  };
}

export function formatRelative(value: string, now = Date.now()) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "—";
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 172800) return "Yesterday";
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatDuration(startedAt: string, resolvedAt: string | undefined, now: number) {
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started)) return "—";
  const end = resolvedAt ? Date.parse(resolvedAt) : now;
  if (!Number.isFinite(end) || end < started) return "—";
  const seconds = Math.floor((end - started) / 1000);
  const amount = seconds < 60 ? `${seconds}s` : seconds < 3600 ? `${Math.floor(seconds / 60)}m` : `${Math.floor(seconds / 3600)}h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}m`;
  return resolvedAt ? `Resolved · lasted ${amount}` : `Ongoing for ${amount}`;
}

export type { IncidentStatus };
