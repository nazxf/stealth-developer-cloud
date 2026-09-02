"use client";

import Link from "next/link";
import { Activity, CircleAlert, Clock3, Gauge, Layers3 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AdminHeader, AdminPageBody, Mono } from "../components/admin-panel";
import { AdminSelect } from "../components/admin-select";
import { CopyButton } from "../components/copy-button";
import { DetailDrawer, DetailField } from "../components/detail-drawer";
import { StatTile } from "../components/stat-tile";
import { StatusBadge } from "../components/status-badge";
import { ToolbarSearch } from "../components/toolbar-search";
import { formatCompactNumber, formatDuration } from "../lib/format";
import { TraceWaterfall } from "./trace-waterfall";
import type { Trace } from "../types/traces";

type TraceFilter = "all" | "success" | "error";

/** Durable request trace index for the Console observability surface. */
export function TracesPage({
  initialTraces,
  organizationCount,
  unavailableOrganizations,
  truncatedOrganizations,
}: {
  initialTraces: Trace[];
  organizationCount: number;
  unavailableOrganizations: number;
  truncatedOrganizations: number;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<TraceFilter>("all");
  const [service, setService] = useState("all");
  const [selected, setSelected] = useState<Trace | null>(null);

  const services = useMemo(
    () => Array.from(new Set(initialTraces.map((trace) => trace.service).filter(Boolean))).sort(),
    [initialTraces],
  );
  const stats = useMemo(() => traceStats(initialTraces), [initialTraces]);
  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return initialTraces.filter((trace) => {
      if (status !== "all" && trace.status !== status) return false;
      if (service !== "all" && trace.service !== service) return false;
      if (!normalizedQuery) return true;
      return [
        trace.id,
        trace.recordId,
        trace.traceId,
        trace.organizationName,
        trace.projectName,
        trace.operation,
        trace.service,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [initialTraces, query, service, status]);
  const hasPartialData = unavailableOrganizations > 0 || truncatedOrganizations > 0;

  return (
    <AdminPageBody>
      <AdminHeader title="Traces" subtitle="Durable root request traces retained by the platform.">
        <Mono className="hidden h-9 items-center rounded-lg border border-[var(--projects-border)] bg-[#141416] px-3 text-[12px] text-[var(--projects-muted)] sm:inline-flex">
          {visible.length} / {initialTraces.length} traces
        </Mono>
      </AdminHeader>

      {hasPartialData ? (
        <p className="m-0 rounded-lg border border-[color-mix(in_srgb,var(--projects-warning)_40%,var(--projects-border))] bg-[color-mix(in_srgb,var(--projects-warning)_7%,#141416)] px-3.5 py-3 text-[12.5px] leading-5 text-[var(--projects-warning)]">
          {unavailableOrganizations > 0 ? `${unavailableOrganizations} of ${organizationCount} organization trace lists were unavailable. ` : ""}
          {truncatedOrganizations > 0 ? `${truncatedOrganizations} organization trace lists reached the read safety limit. ` : ""}
          The table includes records read successfully.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatTile icon={Activity} label="Observed requests" value={formatCompactNumber(stats.count)} hint={`${organizationCount} org${organizationCount === 1 ? "" : "s"}`} />
        <StatTile icon={Clock3} label="P50 latency" value={formatMaybeDuration(stats.p50)} />
        <StatTile icon={Gauge} label="P95 latency" value={formatMaybeDuration(stats.p95)} />
        <StatTile icon={Layers3} label="P99 latency" value={formatMaybeDuration(stats.p99)} />
        <StatTile icon={CircleAlert} label="Observed error rate" value={`${stats.errorRate.toFixed(2)}%`} tone={stats.errorRate > 0 ? "warning" : "neutral"} />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <ToolbarSearch value={query} onChange={setQuery} placeholder="Search trace, route, project..." label="Search traces" />
        <AdminSelect
          label="Filter by service"
          value={service}
          onChange={setService}
          options={[{ value: "all", label: "All services" }, ...services.map((item) => ({ value: item, label: item }))]}
        />
        <AdminSelect
          label="Filter by status"
          value={status}
          onChange={(value) => setStatus(value as TraceFilter)}
          options={[{ value: "all", label: "All statuses" }, { value: "success", label: "Success" }, { value: "error", label: "Error" }]}
        />
        <Mono className="ml-auto text-[11.5px] text-[var(--projects-muted)]">{visible.length} traces</Mono>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--projects-border)] bg-[#141416]">
        <div aria-hidden="true" className="hidden grid-cols-[140px_90px_minmax(0,1.6fr)_90px_80px_100px] gap-3 border-b border-[var(--projects-divider)] px-3.5 py-2 lg:grid">
          <ColumnLabel>Trace</ColumnLabel>
          <ColumnLabel>Service</ColumnLabel>
          <ColumnLabel>Operation</ColumnLabel>
          <ColumnLabel>Duration</ColumnLabel>
          <ColumnLabel>Status</ColumnLabel>
          <ColumnLabel>Finished</ColumnLabel>
        </div>
        <ul className="m-0 list-none p-0">
          {visible.length === 0 ? (
            <li className="px-4 py-12 text-center text-[13px] text-[var(--projects-muted)]">
              {initialTraces.length === 0 ? "No durable request traces have been recorded." : "No traces match the current filters."}
            </li>
          ) : (
            visible.map((trace) => (
              <li key={trace.recordId} className="border-b border-[var(--projects-divider)] last:border-b-0">
                <button
                  type="button"
                  onClick={() => setSelected(trace)}
                  aria-label={`Inspect trace ${trace.traceId}`}
                  aria-expanded={selected?.recordId === trace.recordId}
                  className="block w-full px-3.5 py-2 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <span className="hidden items-center gap-3 lg:grid lg:grid-cols-[140px_90px_minmax(0,1.6fr)_90px_80px_100px]">
                    <span className="block min-w-0 truncate" title={trace.traceId}><Mono className="text-[12px] font-medium text-[var(--projects-text)]">{trace.traceId}</Mono></span>
                    <Mono className="text-[11.5px] text-[#b3b0ba]">{trace.service}</Mono>
                    <span className="min-w-0 truncate text-[12px] text-[var(--projects-text)]" title={trace.operation}>{trace.operation}</span>
                    <Mono className={cn("text-[11.5px]", trace.status === "error" ? "text-[var(--projects-danger)]" : "text-[var(--projects-text)]")}>{formatDuration(trace.duration)}</Mono>
                    <TraceStatus trace={trace} />
                    <Mono className="text-[11px] text-[var(--projects-muted)]">{formatTimestamp(trace.timestamp)}</Mono>
                  </span>
                  <span className="block lg:hidden">
                    <span className="flex items-center gap-2">
                      <Mono className="min-w-0 truncate text-[12px] font-medium text-[var(--projects-text)]">{trace.traceId}</Mono>
                      <span className="ml-auto shrink-0"><TraceStatus trace={trace} /></span>
                    </span>
                    <span className="mt-1 flex min-w-0 items-center gap-2 text-[11px] text-[var(--projects-muted)]">
                      <span className="min-w-0 truncate">{trace.operation}</span>
                      <Mono className="shrink-0">{trace.service} · {formatDuration(trace.duration)}</Mono>
                    </span>
                    <Mono className="mt-0.5 block text-[10.5px] text-[var(--projects-muted)]">{formatTimestamp(trace.timestamp)}{trace.projectName ? ` · ${trace.projectName}` : ""}</Mono>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      <TraceDetail trace={selected} onClose={() => setSelected(null)} />
    </AdminPageBody>
  );
}

function TraceStatus({ trace }: { trace: Trace }) {
  return trace.status === "error" ? <StatusBadge tone="danger" label={`HTTP ${trace.responseStatus}`} /> : <StatusBadge tone="success" label={`HTTP ${trace.responseStatus}`} />;
}

function TraceDetail({ trace, onClose }: { trace: Trace | null; onClose: () => void }) {
  return (
    <DetailDrawer
      open={trace !== null}
      onClose={onClose}
      title={
        <>
          <Mono className="truncate">{trace?.traceId}</Mono>
          {trace ? <span className="ml-2"><TraceStatus trace={trace} /></span> : null}
        </>
      }
      subtitle={trace ? `${trace.service} · ${trace.operation} · ${formatTimestamp(trace.timestamp)}` : undefined}
    >
      {trace ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-x-4">
            <DetailField label="Duration">{formatDuration(trace.duration)}</DetailField>
            <DetailField label="HTTP status"><TraceStatus trace={trace} /></DetailField>
            <DetailField label="Response bytes">{formatBytes(trace.responseBytes)}</DetailField>
            <DetailField label="Root spans">{trace.spanList.length}</DetailField>
            <DetailField label="Organization">{trace.organizationName ?? "—"}</DetailField>
            <DetailField label="Project">{trace.projectName ?? "—"}</DetailField>
            <DetailField label="Started">{formatTimestamp(trace.startedAt)}</DetailField>
            <DetailField label="Finished">{formatTimestamp(trace.finishedAt)}</DetailField>
            <DetailField label="Trace ID" wide>
              <span className="admin-mono flex items-center gap-1"><span className="min-w-0 break-all">{trace.traceId}</span><CopyButton text={trace.traceId} /></span>
            </DetailField>
            <DetailField label="Record ID" wide>
              <span className="admin-mono flex items-center gap-1"><span className="min-w-0 break-all">{trace.recordId}</span><CopyButton text={trace.recordId} /></span>
            </DetailField>
          </div>

          <div>
            <p className="m-0 mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--projects-muted)]">Root request span</p>
            <TraceWaterfall spans={trace.spanList} totalDuration={Math.max(1, trace.duration)} />
            <p className="m-0 mt-2 text-[11.5px] leading-5 text-[var(--projects-muted)]">This Console index stores bounded root-request metadata. Nested spans and full attributes remain in the private OpenTelemetry/Tempo backend.</p>
          </div>

          {trace.projectId ? <Link href={`/projects/${encodeURIComponent(trace.projectId)}/functions`} className="inline-flex h-8 w-fit items-center rounded-md border border-[var(--projects-border)] px-3 text-[12px] font-medium text-[var(--projects-text)] transition-colors hover:border-[var(--projects-border-hover)] hover:bg-white/[0.04]">Open project Functions</Link> : null}
        </div>
      ) : null}
    </DetailDrawer>
  );
}

function traceStats(traces: Trace[]) {
  const durations = traces.map((trace) => trace.duration).filter((value) => Number.isFinite(value) && value >= 0).sort((left, right) => left - right);
  const errors = traces.filter((trace) => trace.status === "error").length;
  return {
    count: traces.length,
    p50: percentile(durations, 0.5),
    p95: percentile(durations, 0.95),
    p99: percentile(durations, 0.99),
    errorRate: traces.length === 0 ? 0 : (errors / traces.length) * 100,
  };
}

function percentile(values: number[], ratio: number): number | null {
  if (values.length === 0) return null;
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * ratio) - 1));
  return values[index];
}

function formatMaybeDuration(value: number | null) {
  return value === null ? "—" : formatDuration(value);
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value < 0) return "—";
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${Math.round(value)} B`;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function ColumnLabel({ children }: { children: ReactNode }) {
  return <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--projects-muted)]">{children}</span>;
}
