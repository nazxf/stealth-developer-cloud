"use client";

import Link from "next/link";
import { RadioTower, TriangleAlert } from "lucide-react";
import { AdminHeader, AdminPageBody, AdminPanel, AdminPanelHeader, Mono } from "../components/admin-panel";
import { LiveIndicator, UpdatedLabel } from "../components/live-indicator";
import { ServiceStatusBadge } from "../components/domain-badges";
import { useAdminHealth } from "../hooks/use-admin-health";

/** Operator-facing current health view backed by the authenticated API probe. */
export function StatusPage() {
  const health = useAdminHealth();
  const probes = health.data ? [
    { id: "api", name: "API liveness", probe: health.data.services.api },
    { id: "platform", name: "Platform readiness", probe: health.data.services.platform },
  ] : [];
  const down = probes.filter(({ probe }) => probe.status === "down");
  const degraded = probes.filter(({ probe }) => probe.status === "degraded");
  const operational = probes.length > 0 && down.length === 0 && degraded.length === 0;
  const checking = health.loading && probes.length === 0;

  return (
    <AdminPageBody>
      <AdminHeader title="Status Page" subtitle="Current availability of the authenticated Stealth API.">
        <LiveIndicator label="Health probe" />
      </AdminHeader>

      <section
        aria-label="Overall status"
        className={operational || checking
          ? "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-[var(--projects-border)] bg-[#141416] px-4 py-4"
          : "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-[color-mix(in_srgb,var(--projects-warning)_40%,var(--projects-border))] bg-[color-mix(in_srgb,var(--projects-warning)_7%,#141416)] px-4 py-4"}
      >
        <span className={`size-2.5 shrink-0 rounded-full ${checking ? "bg-[var(--admin-info)]" : operational ? "bg-[var(--projects-accent)]" : down.length > 0 ? "bg-[var(--projects-danger)]" : "bg-[var(--projects-warning)]"}`} />
        <p className="m-0 text-[15px] font-semibold text-[var(--projects-text)]">
          {checking ? "Checking systems" : operational ? "All systems operational" : down.length > 0 ? "Platform unavailable" : "Degraded performance"}
        </p>
        <Mono className="ml-auto text-[11.5px] text-[var(--projects-muted)]">
          {health.data ? `checked ${formatSnapshotTime(health.data.checked_at)}` : health.error ?? "waiting for probe"}
        </Mono>
      </section>

      <AdminPanel>
        <AdminPanelHeader title="Current probes" subtitle="Read-only liveness and readiness checks; raw Prometheus metrics stay private." />
        {health.loading && probes.length === 0 ? (
          <p className="m-0 py-5 text-[12.5px] text-[var(--projects-muted)]">Checking the Stealth API…</p>
        ) : health.error && probes.length === 0 ? (
          <p className="m-0 py-5 text-[12.5px] text-[var(--projects-warning)]">{health.error}</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {probes.map(({ id, name, probe }) => (
              <li key={id} className="flex flex-wrap items-center gap-3 border-b border-[var(--projects-divider)] py-3 last:border-b-0">
                <RadioTower size={15} strokeWidth={1.8} className="shrink-0 text-[var(--projects-muted)]" aria-hidden="true" />
                <span className="min-w-0 flex-1 text-[13px] font-medium text-[var(--projects-text)]">{name}</span>
                <ServiceStatusBadge status={probe.status} />
                <Mono className="text-[11.5px] text-[var(--projects-muted)]">{probe.http_status ? `HTTP ${probe.http_status}` : "No response"}</Mono>
                <span className="w-full text-[12px] text-[var(--projects-muted)] sm:w-auto">{probe.message}</span>
              </li>
            ))}
          </ul>
        )}
        <UpdatedLabel className="mt-3 block text-[11px] text-[var(--projects-muted)]" />
      </AdminPanel>

      <AdminPanel>
        <AdminPanelHeader title="Availability history" />
        <div className="flex flex-wrap items-start gap-3 rounded-lg border border-[var(--projects-border)] bg-[#0f0f11] p-3.5">
          <TriangleAlert size={16} strokeWidth={1.8} className="mt-0.5 shrink-0 text-[var(--projects-warning)]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[13px] font-medium text-[var(--projects-text)]">Historical uptime is not connected yet.</p>
            <p className="m-0 mt-1 text-[12px] leading-5 text-[var(--projects-muted)]">The platform does not currently persist synthetic check samples, so no 45-day percentage or incident timeline is fabricated here.</p>
          </div>
          <Link href="/admin/incidents" className="inline-flex h-8 items-center rounded-md border border-[var(--projects-border)] px-3 text-[12px] font-medium text-[var(--projects-text)] transition-colors hover:border-[var(--projects-border-hover)] hover:bg-white/[0.04]">Open incidents preview</Link>
        </div>
      </AdminPanel>
    </AdminPageBody>
  );
}

function formatSnapshotTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "unknown" : `${date.toISOString().slice(0, 16).replace("T", " ")}Z`;
}
