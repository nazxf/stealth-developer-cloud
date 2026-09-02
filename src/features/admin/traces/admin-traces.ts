import type { OrganizationTrace } from "@/lib/stealth-api";
import type { Trace } from "../types/traces";

/** Convert the API's bounded root-request projection into the trace UI model. */
export function adminTraceFromRecord(record: OrganizationTrace): Trace {
  const service = record.service.trim() || "api";
  const method = record.method.trim() || "REQUEST";
  const route = record.route.trim() || "unmatched";
  const operation = `${method} ${route}`;
  const duration = Math.max(0, Number.isFinite(record.duration_ms) ? Math.round(record.duration_ms) : 0);
  const status = record.status >= 400 ? "error" : "success";
  const spanID = record.span_id?.trim() || record.id;

  return {
    id: record.trace_id,
    recordId: record.id,
    traceId: record.trace_id,
    service,
    operation,
    duration,
    status,
    timestamp: record.finished_at || record.created_at,
    spanList: [{ id: spanID, name: operation, service, start: 0, duration, status }],
    organizationId: record.organization_id,
    organizationName: record.organization_name,
    projectId: record.project_id,
    projectName: record.project_name,
    responseStatus: record.status,
    responseBytes: Math.max(0, Number.isFinite(record.response_bytes) ? Math.round(record.response_bytes) : 0),
    startedAt: record.started_at,
    finishedAt: record.finished_at,
  };
}
