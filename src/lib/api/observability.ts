import { z } from "zod";
import { request } from "../api-core";
import { paginationSchema } from "./common";

const incidentSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  title: z.string(),
  severity: z.enum(["critical", "warning", "info"]),
  status: z.enum(["investigating", "identified", "monitoring", "resolved"]),
  services: z.array(z.string()),
  started_at: z.string(),
  resolved_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
}).passthrough();
const traceSchema = z.object({
  id: z.string(),
  trace_id: z.string(),
  service: z.string(),
  method: z.string(),
  route: z.string(),
  status: z.number(),
  duration_ms: z.number(),
  response_bytes: z.number(),
  started_at: z.string(),
}).passthrough();

export { traceSchema };

export type BrowserTrace = z.infer<typeof traceSchema>;

export const observabilityAPI = {
  health: () => request("/healthz", z.object({ status: z.string() })),
  readiness: () => request("/readyz", z.object({ status: z.string() })),
  organizationIncidents: (organizationID: string) =>
    request(`/v1/organizations/${encodeURIComponent(organizationID)}/incidents?limit=100`, z.object({ incidents: z.array(incidentSchema), pagination: paginationSchema, can_manage: z.boolean() }).passthrough()),
  organizationTraces: (organizationID: string) =>
    request(`/v1/organizations/${encodeURIComponent(organizationID)}/traces?limit=100`, z.object({ traces: z.array(traceSchema), pagination: paginationSchema }).passthrough()),
};
