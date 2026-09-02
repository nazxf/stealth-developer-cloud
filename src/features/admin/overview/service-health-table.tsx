import type { ReactNode } from "react";
import { AdminPanel, AdminPanelHeader, Mono } from "../components/admin-panel";
import { ServiceStatusBadge } from "../components/domain-badges";
import type { AdminHealth } from "../hooks/use-admin-health";

/**
 * Service health list — Service / Status / Latency / Availability / Last
 * check. Desktop renders the column grid; compact viewports fold the
 * metrics into one inline metadata row.
 */
export function ServiceHealthTable({ health, className }: { health: { data: AdminHealth | null; loading: boolean; error: string | null }; className?: string }) {
  const rows = health.data
    ? [
        { id: "api", name: "API liveness", probe: health.data.services.api },
        { id: "platform", name: "Platform readiness", probe: health.data.services.platform },
      ]
    : [];

  return (
    <AdminPanel className={className}>
      <AdminPanelHeader title="Service Health" subtitle="Authenticated liveness/readiness probes from the Stealth API." />
      <div
        aria-hidden="true"
        className="hidden grid-cols-[minmax(0,1.6fr)_1fr_0.9fr_1.1fr_0.9fr] gap-3 border-b border-[var(--projects-divider)] px-3 pb-2 lg:grid"
      >
        <ColumnLabel>Service</ColumnLabel>
        <ColumnLabel>Status</ColumnLabel>
        <ColumnLabel>Latency</ColumnLabel>
        <ColumnLabel>Availability</ColumnLabel>
        <ColumnLabel>Last check</ColumnLabel>
      </div>
      {health.loading && rows.length === 0 ? (
        <p className="m-0 px-3 py-5 text-[12.5px] text-[var(--projects-muted)]">Checking platform health…</p>
      ) : health.error && rows.length === 0 ? (
        <p className="m-0 px-3 py-5 text-[12.5px] text-[var(--projects-warning)]">{health.error}</p>
      ) : (
        <ul className="m-0 list-none p-0">
        {rows.map((service) => (
          <li
            key={service.id}
            className="border-b border-[var(--projects-divider)] px-3 py-2.5 transition-colors last:border-b-0 hover:bg-white/[0.02] lg:grid lg:grid-cols-[minmax(0,1.6fr)_1fr_0.9fr_1.1fr_0.9fr] lg:items-center lg:gap-3"
          >
            <div className="flex items-center justify-between gap-2 lg:block">
              <span className="text-[13px] font-medium leading-5 text-[var(--projects-text)]">{service.name}</span>
              <span className="lg:hidden">
                <ServiceStatusBadge status={service.probe.status} />
              </span>
            </div>
            <span className="mt-0 hidden lg:block">
              <ServiceStatusBadge status={service.probe.status} />
            </span>
            <Mono className="mt-2 hidden text-[12px] leading-5 text-[var(--projects-text)] lg:mt-0 lg:block">
              {service.probe.http_status ? `HTTP ${service.probe.http_status}` : "—"}
            </Mono>
            <Mono className="hidden text-[12px] leading-5 text-[var(--projects-muted)] lg:block">
              {service.probe.message}
            </Mono>
            <Mono className="hidden text-[12px] leading-5 text-[var(--projects-muted)] lg:block">
              {health.data ? formatCheckedAt(health.data.checked_at) : "—"}
            </Mono>
            {/* compact metadata row */}
            <Mono className="mt-1.5 text-[11.5px] leading-4 text-[var(--projects-muted)] lg:hidden">
              {service.probe.http_status ? `HTTP ${service.probe.http_status}` : "No response"} · {service.probe.message} · checked {health.data ? formatCheckedAt(health.data.checked_at) : "—"}
            </Mono>
          </li>
        ))}
        </ul>
      )}
    </AdminPanel>
  );
}

function formatCheckedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function ColumnLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--projects-muted)]">{children}</span>
  );
}
