import type { LogEntry, LogLevel } from "../types/logs";

export type AdminAuditEventRecord = {
  id: string;
  organization_id: string;
  actor_account_id?: string;
  actor_email?: string;
  action: string;
  target_type: string;
  target_id?: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

/** Convert a durable audit event into the log explorer's display projection. */
export function logEntryFromAuditEvent(event: AdminAuditEventRecord): LogEntry {
  const attributes = scalarAttributes(event.metadata);
  attributes.organization_id = event.organization_id;
  if (event.actor_account_id) attributes.actor_account_id = event.actor_account_id;
  if (event.target_id) attributes.target_id = event.target_id;

  return {
    id: event.id,
    timestamp: event.created_at,
    level: levelForAction(event.action),
    service: serviceForAction(event.action),
    environment: "workspace",
    message: `${event.action} · ${event.target_type}${event.target_id ? ` ${event.target_id}` : ""}`,
    meta: event.target_type,
    user: event.actor_email,
    attributes,
  };
}

export function serviceForAction(action: string) {
  const prefix = action.split(".")[0]?.toLowerCase() ?? "api";
  if (prefix === "agent") return "agents";
  if (prefix === "project_auth" || prefix === "project_user" || prefix === "project_api_key") return "auth";
  if (prefix === "function" || prefix === "function_deployment" || prefix === "function_execution") return "functions";
  if (prefix === "site" || prefix === "site_deployment") return "sites";
  if (prefix === "database" || prefix === "storage" || prefix === "webhook") return prefix === "webhook" ? "webhooks" : prefix;
  return prefix || "api";
}

function levelForAction(action: string): LogLevel {
  const normalized = action.toLowerCase();
  if (normalized.endsWith(".failed") || normalized.endsWith(".error")) return "ERROR";
  if (normalized.includes("delete") || normalized.includes("revoke") || normalized.includes("status_change")) return "WARN";
  return "INFO";
}

function scalarAttributes(metadata: Record<string, unknown>) {
  return Object.entries(metadata).reduce<Record<string, string | number>>((result, [key, value]) => {
    if (typeof value === "string" || typeof value === "number") result[key] = value;
    else if (typeof value === "boolean") result[key] = value ? "true" : "false";
    else if (value !== undefined && value !== null) result[key] = JSON.stringify(value);
    return result;
  }, {});
}
