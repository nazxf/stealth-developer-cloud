"use client";

import { Activity, Database, HardDrive, RadioTower, Server, TriangleAlert } from "lucide-react";
import { AdminHeader, AdminPageBody, AdminPanel, AdminPanelHeader, Mono } from "../components/admin-panel";
import { LiveIndicator, UpdatedLabel } from "../components/live-indicator";
import { ServiceStatusBadge } from "../components/domain-badges";
import { StatTile } from "../components/stat-tile";
import { useAdminHealth, type AdminProbe } from "../hooks/use-admin-health";

/**
 * Infrastructure view backed by the authenticated health contract. Host
 * inventory and historical resource charts are intentionally not rendered
 * until the API exposes a durable query for them.
 */
export function InfrastructurePage() {
  const health = useAdminHealth();
  const probes = health.data ? [
    { id: "api", name: "API liveness", description: "HTTP process responds to requests.", probe: health.data.services.api },
    { id: "platform", name: "Platform readiness", description: "Database, storage, function, site, and rate-limit dependencies are ready.", probe: health.data.services.platform },
  ] : [];
  const healthy = probes.filter(({ probe }) => probe.status === "healthy").length;
  const down = probes.filter(({ probe }) => probe.status === "down").length;
  const degraded = probes.filter(({ probe }) => probe.status === "degraded").length;
  const overall = health.loading && probes.length === 0 ? "checking" : down > 0 ? "down" : degraded > 0 ? "degraded" : "healthy";

  return (
    <AdminPageBody>
      <AdminHeader title="Infrastructure" subtitle="Authenticated runtime health and deployment boundaries for this Stealth instance.">
        <LiveIndicator label="Live health probe" />
      </AdminHeader>

      <section aria-label="Infrastructure summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={Activity} label="Live probes" value={health.data ? `${healthy} / ${probes.length}` : "—"} hint={health.data ? "healthy" : "waiting"} tone={overall === "healthy" ? "success" : overall === "down" ? "danger" : overall === "degraded" ? "warning" : "neutral"} />
        <StatTile icon={Server} label="API liveness" value={health.data ? health.data.services.api.status : "—"} tone={probeTone(health.data?.services.api)} />
        <StatTile icon={Database} label="Platform readiness" value={health.data ? health.data.services.platform.status : "—"} tone={probeTone(health.data?.services.platform)} />
        <StatTile icon={RadioTower} label="Raw metrics" value="Private" hint="Prometheus" />
      </section>

      <AdminPanel>
        <AdminPanelHeader title="Runtime probes" subtitle="Read-only checks from the authenticated API proxy. No host values are generated in the browser." />
        {health.loading && probes.length === 0 ? <p className="m-0 py-5 text-[12.5px] text-[var(--projects-muted)]">Checking the Stealth runtime…</p> : health.error && probes.length === 0 ? <p role="alert" className="m-0 rounded-md border border-rose-400/30 bg-rose-400/10 px-3 py-3 text-[12px] text-rose-200">{health.error}</p> : <ul className="m-0 list-none p-0">{probes.map(({ id, name, description, probe }) => <ProbeRow key={id} name={name} description={description} probe={probe} />)}</ul>}
        {health.data ? <UpdatedLabel className="mt-3 block text-[11px] text-[var(--projects-muted)]" /> : null}
      </AdminPanel>

      <AdminPanel>
        <AdminPanelHeader title="Deployment boundaries" subtitle="What this Console can verify versus what remains an internal operator concern." />
        <div className="grid gap-3 sm:grid-cols-2">
          <BoundaryRow icon={HardDrive} title="Tenant persistence" detail="Included in the platform readiness check; project usage pages read durable PostgreSQL aggregates." state="Connected" tone="success" />
          <BoundaryRow icon={RadioTower} title="Prometheus / OpenTelemetry" detail="Scrape and trace backends stay on the private deployment network and are not exposed as raw browser data." state="Private" tone="info" />
          <BoundaryRow icon={Server} title="Host inventory and worker heartbeats" detail="Per-host CPU, memory, disk, and worker heartbeat history need a dedicated authenticated query contract." state="Unavailable" tone="neutral" />
          <BoundaryRow icon={TriangleAlert} title="Historical uptime and telemetry" detail="Incident records are available from the organization control plane; historical uptime percentages and time-series samples remain private telemetry." state="Partial" tone="warning" />
        </div>
      </AdminPanel>
    </AdminPageBody>
  );
}

function ProbeRow({ name, description, probe }: { name: string; description: string; probe: AdminProbe }) {
  return <li className="flex flex-wrap items-center gap-3 border-b border-[var(--projects-divider)] py-3 last:border-b-0"><RadioTower size={15} strokeWidth={1.8} className="shrink-0 text-[var(--projects-muted)]" aria-hidden="true" /><div className="min-w-0 flex-1"><p className="m-0 text-[13px] font-medium text-[var(--projects-text)]">{name}</p><p className="m-0 mt-1 text-[11.5px] leading-5 text-[var(--projects-muted)]">{description}</p></div><ServiceStatusBadge status={probe.status} /><Mono className="text-[11.5px] text-[var(--projects-muted)]">{probe.http_status ? `HTTP ${probe.http_status}` : "No response"}</Mono><p className="m-0 w-full text-[11.5px] text-[var(--projects-muted)] sm:w-auto">{probe.message}</p></li>;
}

function BoundaryRow({ icon: Icon, title, detail, state, tone }: { icon: typeof HardDrive; title: string; detail: string; state: string; tone: "success" | "info" | "neutral" | "warning" }) {
  return <article className="rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] p-3.5"><div className="flex items-center gap-2.5"><Icon size={15} strokeWidth={1.8} className="shrink-0 text-[var(--projects-muted)]" aria-hidden="true" /><h3 className="m-0 min-w-0 flex-1 text-[12.5px] font-medium text-[var(--projects-text)]">{title}</h3><span className={`rounded-full border px-2 py-0.5 text-[10px] ${tone === "success" ? "border-emerald-500/30 text-emerald-200" : tone === "info" ? "border-sky-500/30 text-sky-200" : tone === "warning" ? "border-amber-500/30 text-amber-200" : "border-[var(--projects-border)] text-[var(--projects-muted)]"}`}>{state}</span></div><p className="m-0 mt-2 text-[11.5px] leading-5 text-[var(--projects-muted)]">{detail}</p></article>;
}

function probeTone(probe: AdminProbe | undefined): "neutral" | "success" | "warning" | "danger" {
  if (!probe) return "neutral";
  if (probe.status === "healthy") return "success";
  if (probe.status === "degraded") return "warning";
  return "danger";
}
