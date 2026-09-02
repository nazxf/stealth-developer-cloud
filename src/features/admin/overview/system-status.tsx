"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { StatusBadge } from "../components/status-badge";
import { UpdatedLabel } from "../components/live-indicator";
import type { AdminHealth } from "../hooks/use-admin-health";

/**
 * Top strip of the overview: overall system status derived from the service
 * list (any degraded service → amber "Degraded performance").
 */
export function SystemStatus({ health, resetKey }: { health: { data: AdminHealth | null; loading: boolean; error: string | null }; resetKey?: unknown }) {
  const probes = health.data ? Object.entries(health.data.services) : [];
  const degraded = probes.filter(([, probe]) => probe.status === "degraded");
  const down = probes.filter(([, probe]) => probe.status === "down");
  const operational = probes.length > 0 && degraded.length === 0 && down.length === 0;
  const checking = health.loading && probes.length === 0;
  const affected = [...down, ...degraded].map(([name]) => name === "api" ? "API" : "Platform").join(", ");
  const tone = checking ? "info" : operational ? "success" : down.length > 0 ? "danger" : "warning";
  const label = checking ? "Checking platform health" : operational ? "All systems operational" : down.length > 0 ? "Platform unavailable" : "Degraded performance";

  return (
    <section
      aria-label="System status"
      className={
        operational
          ? "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-[var(--projects-border)] bg-[#141416] px-4 py-3.5"
          : "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-[color-mix(in_srgb,var(--projects-warning)_40%,var(--projects-border))] bg-[color-mix(in_srgb,var(--projects-warning)_7%,#141416)] px-4 py-3.5"
      }
    >
      <StatusBadge tone={tone} label={label} className="text-[13px]" pulse={checking || !operational} />
      <p className="m-0 min-w-0 flex-1 text-[12.5px] leading-5 text-[var(--projects-muted)]">
        {checking
          ? "Checking the authenticated API liveness and readiness probes."
          : health.error && !health.data
            ? health.error
            : operational
              ? "The API liveness and platform readiness probes are responding."
              : `${affected || "Platform health"} ${down.length > 0 ? "is unavailable" : "is degraded"}.`}
      </p>
      <UpdatedLabel resetKey={resetKey} className="admin-mono shrink-0 text-[11.5px] text-[var(--projects-muted)]" />
      <Link
        href="/admin/incidents"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--projects-border)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--projects-text)] transition-colors hover:border-[var(--projects-border-hover)] hover:bg-white/[0.04]"
      >
        <TriangleAlert size={12} strokeWidth={1.8} aria-hidden="true" />
        View incidents
      </Link>
    </section>
  );
}
