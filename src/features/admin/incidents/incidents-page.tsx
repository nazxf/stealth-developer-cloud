"use client";

import { useMemo, useState } from "react";
import { AdminHeader, AdminPageBody, Mono } from "../components/admin-panel";
import { DetailDrawer, DetailField } from "../components/detail-drawer";
import { IncidentStatusBadge, SeverityBadge } from "../components/domain-badges";
import { AdminSelect } from "../components/admin-select";
import { CreateIncidentDialog, type CreateIncidentInput } from "./create-incident-dialog";
import { adminIncidentFromRecord, type AdminIncidentOrganization } from "./admin-incidents";
import type { OrganizationIncident, OrganizationIncidentStatus } from "@/lib/stealth-api";
import type { Incident, IncidentSeverity, IncidentStatus } from "../types/incidents";

type SeverityFilter = "all" | IncidentSeverity;
type StatusFilter = "all" | IncidentStatus;
type ErrorPayload = { error?: { message?: string } };

class IncidentRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function bridgeJSON<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/stealth/${path}`, { ...init, cache: "no-store" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as ErrorPayload | null;
    throw new IncidentRequestError(response.status, payload?.error?.message ?? "The incident request could not be completed.");
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

function incidentsPath(organizationID: string, incidentID?: string) {
  const base = `organizations/${encodeURIComponent(organizationID)}/incidents`;
  return incidentID ? `${base}/${encodeURIComponent(incidentID)}` : base;
}

/** Durable organization incident board with server-backed create and status updates. */
export function IncidentsPage({
  initialIncidents,
  organizations,
  organizationCount,
  unavailableOrganizations,
}: {
  initialIncidents: Incident[];
  organizations: AdminIncidentOrganization[];
  organizationCount: number;
  unavailableOrganizations: number;
}) {
  const [incidents, setIncidents] = useState<Incident[]>(() => initialIncidents);
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<Incident | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [mutation, setMutation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const visible = useMemo(() => incidents.filter((incident) => {
    if (severity !== "all" && incident.severity !== severity) return false;
    if (status !== "all" && incident.status !== status) return false;
    return true;
  }), [incidents, severity, status]);
  const active = incidents.filter((incident) => incident.status !== "resolved").length;
  const manageableOrganizations = organizations.filter((organization) => organization.canManage);

  function showRequestError(reason: unknown, fallback: string) {
    if (reason instanceof IncidentRequestError && reason.status === 403) {
      setError("Only organization owners and admins can create or update incidents.");
    } else if (reason instanceof IncidentRequestError && reason.status === 404) {
      setError("The organization or incident was not found. Refresh the page and try again.");
    } else if (reason instanceof IncidentRequestError && reason.status === 409) {
      setError("That status transition is no longer valid. Refresh the incident and try again.");
    } else {
      setError(reason instanceof Error ? reason.message : fallback);
    }
    setMessage(null);
  }

  async function createIncident(input: CreateIncidentInput) {
    setMutation("create");
    setError(null);
    setMessage(null);
    try {
      const result = await bridgeJSON<{ incident: OrganizationIncident }>(incidentsPath(input.organizationID), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: input.title, severity: input.severity, status: input.status, services: input.services, message: input.message }),
      });
      const organization = organizations.find((candidate) => candidate.id === input.organizationID);
      const mapped = adminIncidentFromRecord(result.incident, organization?.name ?? "Organization", organization?.canManage ?? false);
      setIncidents((current) => [mapped, ...current.filter((incident) => incident.id !== mapped.id)]);
      setSelected(mapped);
      setCreateOpen(false);
      setMessage(`Incident “${mapped.title}” was opened.`);
    } catch (reason) {
      showRequestError(reason, "The incident could not be opened.");
    } finally {
      setMutation(null);
    }
  }

  async function updateStatus(incident: Incident, nextStatus: IncidentStatus) {
    if (!incident.organizationId || !incident.canManage || incident.status === nextStatus || mutation) return;
    setMutation(`status:${incident.id}`);
    setError(null);
    setMessage(null);
    try {
      const result = await bridgeJSON<{ incident: OrganizationIncident }>(incidentsPath(incident.organizationId, incident.id), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus as OrganizationIncidentStatus }),
      });
      const organization = organizations.find((candidate) => candidate.id === incident.organizationId);
      const mapped = adminIncidentFromRecord(result.incident, organization?.name ?? incident.organizationName ?? "Organization", organization?.canManage ?? incident.canManage ?? false);
      setIncidents((current) => current.map((item) => item.id === mapped.id ? mapped : item));
      setSelected(mapped);
      setMessage(`Incident “${mapped.title}” is now ${nextStatus}.`);
    } catch (reason) {
      showRequestError(reason, "The incident status could not be updated.");
    } finally {
      setMutation(null);
    }
  }

  return (
    <AdminPageBody>
      <AdminHeader title="Incidents" subtitle="Track, triage, and resolve durable organization incidents.">
        <Mono className="hidden h-9 items-center rounded-lg border border-[var(--projects-border)] bg-[#141416] px-3 text-[12px] text-[var(--projects-muted)] sm:inline-flex">{active} active</Mono>
        <button type="button" onClick={() => { setError(null); setMessage(null); setCreateOpen(true); }} disabled={manageableOrganizations.length === 0} className="inline-flex h-9 items-center rounded-lg border border-[var(--projects-accent-border)] bg-[var(--projects-accent-strong)] px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-[var(--projects-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50">Create Incident</button>
      </AdminHeader>

      {unavailableOrganizations > 0 ? <p className="m-0 rounded-lg border border-[color-mix(in_srgb,var(--projects-warning)_40%,var(--projects-border))] bg-[color-mix(in_srgb,var(--projects-warning)_7%,#141416)] px-3.5 py-3 text-[12.5px] leading-5 text-[var(--projects-warning)]">{unavailableOrganizations} of {organizationCount} organization incident lists were unavailable. The board includes records read successfully.</p> : null}
      {error ? <p role="alert" className="m-0 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3.5 py-3 text-[12.5px] leading-5 text-rose-200">{error}</p> : null}
      {message ? <p role="status" className="m-0 rounded-lg border border-[var(--projects-accent)]/30 bg-[var(--projects-accent)]/10 px-3.5 py-3 text-[12.5px] leading-5 text-[var(--projects-accent)]">{message}</p> : null}

      <div className="flex flex-wrap items-center gap-2.5"><AdminSelect label="Filter by severity" value={severity} onChange={setSeverity} options={[{ value: "all", label: "All severities" }, { value: "critical", label: "Critical" }, { value: "warning", label: "Warning" }, { value: "info", label: "Info" }]} /><AdminSelect label="Filter by status" value={status} onChange={setStatus} options={[{ value: "all", label: "All statuses" }, { value: "investigating", label: "Investigating" }, { value: "identified", label: "Identified" }, { value: "monitoring", label: "Monitoring" }, { value: "resolved", label: "Resolved" }]} /><Mono className="ml-auto text-[11.5px] text-[var(--projects-muted)]">{visible.length} incidents</Mono></div>

      <div className="overflow-hidden rounded-lg border border-[var(--projects-border)] bg-[#141416]"><ul className="m-0 list-none p-0">{visible.length === 0 ? <li className="px-4 py-12 text-center text-[13px] text-[var(--projects-muted)]">{incidents.length === 0 ? "No durable incidents have been recorded." : "No incidents match the current filters."}</li> : visible.map((incident) => <li key={incident.id} className="border-b border-[var(--projects-divider)] last:border-b-0"><button type="button" onClick={() => setSelected(incident)} aria-label={`Inspect incident ${incident.id}`} aria-expanded={selected?.id === incident.id} className="block w-full px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"><div className="flex flex-wrap items-center gap-2.5"><SeverityBadge severity={incident.severity} /><span className="text-[13.5px] font-medium text-[var(--projects-text)]">{incident.title}</span><span className="ml-auto"><IncidentStatusBadge status={incident.status} /></span></div><div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--projects-muted)]"><Mono>{incident.id}</Mono>{incident.organizationName ? <span>{incident.organizationName}</span> : null}<span>{incident.services.length} service{incident.services.length === 1 ? "" : "s"}: {incident.services.join(", ")}</span><span>started {incident.startedAt}</span><span>{incident.duration}</span></div></button></li>)}</ul></div>

      <IncidentDetail incident={selected} onClose={() => setSelected(null)} onStatusChange={(nextStatus) => selected ? void updateStatus(selected, nextStatus) : undefined} busy={selected ? mutation === `status:${selected.id}` : false} />
      <CreateIncidentDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreate={createIncident} organizations={organizations} defaultOrganizationID={manageableOrganizations[0]?.id ?? ""} submitting={mutation === "create"} />
    </AdminPageBody>
  );
}

function IncidentDetail({ incident, onClose, onStatusChange, busy }: { incident: Incident | null; onClose: () => void; onStatusChange: (status: IncidentStatus) => void; busy: boolean }) {
  return <DetailDrawer open={incident !== null} onClose={onClose} title={<><span className="truncate">{incident?.title}</span>{incident && <span className="ml-2"><SeverityBadge severity={incident.severity} /></span>}</>} subtitle={incident ? `${incident.id} · ${incident.organizationName ?? "Organization"} · ${incident.duration}` : undefined}>
    {incident ? <div className="flex flex-col gap-4"><div className="grid grid-cols-2 gap-x-4"><DetailField label="Status"><IncidentStatusBadge status={incident.status} /></DetailField><DetailField label="Started">{incident.startedAt}</DetailField><DetailField label="Affected services" wide><span className="flex flex-wrap gap-1.5">{incident.services.map((service) => <Mono key={service} className="rounded-md border border-[var(--projects-border)] px-1.5 py-0.5 text-[11px] text-[var(--projects-muted)]">{service}</Mono>)}</span></DetailField></div>
      {incident.canManage ? <div className="rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] p-3"><p className="m-0 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--projects-muted)]">Update status</p><div className="mt-2 flex flex-wrap items-center gap-2"><select value={incident.status} onChange={(event) => onStatusChange(event.target.value as IncidentStatus)} disabled={busy} aria-label="Update incident status" className="h-9 rounded-md border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-2.5 text-[12px] text-[var(--projects-text)] disabled:cursor-not-allowed disabled:opacity-60">{(["investigating", "identified", "monitoring", "resolved"] as IncidentStatus[]).map((value) => <option key={value} value={value}>{value}</option>)}</select>{busy ? <span className="text-[11.5px] text-[var(--projects-muted)]">Saving…</span> : <span className="text-[11.5px] text-[var(--projects-muted)]">Changes are recorded in the incident timeline.</span>}</div></div> : null}
      <div><p className="m-0 mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--projects-muted)]">Timeline</p>{incident.updates.length === 0 ? <p className="m-0 text-[12px] text-[var(--projects-muted)]">No timeline updates recorded.</p> : <ol className="m-0 list-none p-0">{incident.updates.map((update, index) => <li key={`${update.time}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">{index < incident.updates.length - 1 ? <span aria-hidden="true" className="absolute left-[5px] top-4 h-[calc(100%-14px)] w-px bg-[var(--projects-divider)]" /> : null}<span className={update.status === "resolved" ? "mt-1 size-[11px] shrink-0 rounded-full bg-[var(--projects-accent)]" : update.status === "investigating" ? "mt-1 size-[11px] shrink-0 rounded-full bg-[var(--projects-warning)]" : "mt-1 size-[11px] shrink-0 rounded-full bg-[var(--admin-info)]"} aria-hidden="true" /><div className="min-w-0"><p className="m-0 flex flex-wrap items-center gap-2 text-[12px] leading-4"><IncidentStatusBadge status={update.status} /><Mono className="text-[11px] text-[var(--projects-muted)]">{update.time}</Mono></p><p className="m-0 mt-1 text-[12.5px] leading-5 text-[var(--projects-text)]">{update.message}</p></div></li>)}</ol>}</div>
    </div> : null}
  </DetailDrawer>;
}
