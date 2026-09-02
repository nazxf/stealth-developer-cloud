"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AdminHeader, AdminPageBody, Mono } from "../components/admin-panel";
import { AdminSelect } from "../components/admin-select";
import { ToolbarSearch } from "../components/toolbar-search";
import { DetailDrawer, DetailField } from "../components/detail-drawer";
import { CopyButton } from "../components/copy-button";
import { StatusBadge } from "../components/status-badge";
import { cn } from "@/lib/utils";
import type { LogEntry, LogLevel } from "../types/logs";

const LEVELS: LogLevel[] = ["INFO", "WARN", "ERROR", "DEBUG"];

const LEVEL_TONE: Record<LogLevel, { text: string; label: string }> = {
  INFO: { text: "text-[#a1a1aa]", label: "text-[#a1a1aa]" },
  WARN: { text: "text-[var(--projects-warning)]", label: "text-[var(--projects-warning)]" },
  ERROR: { text: "text-[var(--projects-danger)]", label: "text-[var(--projects-danger)]" },
  DEBUG: { text: "text-[#62626a]", label: "text-[#62626a]" },
};

type LevelFilter = "all" | LogLevel;
type ServiceFilter = "all" | string;

/** Logs — durable organization audit events, not a synthetic live tail. */
export function LogsPage({
  initialEntries,
  organizationCount,
  unavailableOrganizations,
  truncatedOrganizations,
}: {
  initialEntries: LogEntry[];
  organizationCount: number;
  unavailableOrganizations: number;
  truncatedOrganizations: number;
}) {
  const [query, setQuery] = useState("");
  const [service, setService] = useState<ServiceFilter>("all");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [selected, setSelected] = useState<LogEntry | null>(null);

  const services = useMemo(() => unique(initialEntries.map((entry) => entry.service)), [initialEntries]);
  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return initialEntries.filter((entry) => {
      if (service !== "all" && entry.service !== service) return false;
      if (level !== "all" && entry.level !== level) return false;
      if (!normalizedQuery) return true;
      return [entry.message, entry.service, entry.user ?? "", entry.id].join(" ").toLowerCase().includes(normalizedQuery);
    });
  }, [initialEntries, query, service, level]);

  return (
    <AdminPageBody>
      <AdminHeader title="Logs" subtitle="Durable audit events emitted by the authenticated workspace.">
        <Mono className="hidden h-9 items-center rounded-lg border border-[var(--projects-border)] bg-[#141416] px-3 text-[12px] text-[var(--projects-muted)] sm:inline-flex">
          {visible.length} / {initialEntries.length} events · {organizationCount} orgs
        </Mono>
      </AdminHeader>

      {(unavailableOrganizations > 0 || truncatedOrganizations > 0) && (
        <p className="m-0 rounded-lg border border-[color-mix(in_srgb,var(--projects-warning)_40%,var(--projects-border))] bg-[color-mix(in_srgb,var(--projects-warning)_7%,#141416)] px-3.5 py-3 text-[12.5px] leading-5 text-[var(--projects-warning)]">
          {unavailableOrganizations > 0 && `${unavailableOrganizations} of ${organizationCount} organization audit streams were unavailable.`}
          {unavailableOrganizations > 0 && truncatedOrganizations > 0 ? " " : ""}
          {truncatedOrganizations > 0 && `${truncatedOrganizations} audit streams exceeded the pagination safety limit.`}
          {" Only events read successfully are shown."}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <ToolbarSearch value={query} onChange={setQuery} placeholder="Search action, actor, target..." label="Search audit events" />
        <AdminSelect
          label="Filter by service"
          value={service}
          onChange={(value) => setService(value as ServiceFilter)}
          options={[{ value: "all", label: "All services" }, ...services.map((item) => ({ value: item, label: item }))]}
        />
        <AdminSelect
          label="Filter by level"
          value={level}
          onChange={(value) => setLevel(value as LevelFilter)}
          options={[{ value: "all", label: "All levels" }, ...LEVELS.map((item) => ({ value: item, label: item }))]}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--projects-border)] bg-[#141416]">
        <div aria-hidden="true" className="hidden grid-cols-[170px_68px_90px_minmax(0,1fr)_minmax(0,1.1fr)] gap-3 border-b border-[var(--projects-divider)] px-3.5 py-2 md:grid">
          <ColumnLabel>Time</ColumnLabel>
          <ColumnLabel>Level</ColumnLabel>
          <ColumnLabel>Service</ColumnLabel>
          <ColumnLabel>Event</ColumnLabel>
          <ColumnLabel>Actor</ColumnLabel>
        </div>
        <div className="admin-scrollbar max-h-[640px] overflow-y-auto" aria-label="Audit event stream">
          {visible.length === 0 ? (
            <p className="m-0 px-4 py-12 text-center text-[13px] text-[var(--projects-muted)]">
              {initialEntries.length === 0 ? "No durable audit events have been recorded." : "No events match the current filters."}
            </p>
          ) : visible.map((entry) => <LogRow key={entry.id} entry={entry} onOpen={() => setSelected(entry)} />)}
        </div>
        <div className="flex items-center justify-between border-t border-[var(--projects-divider)] px-3.5 py-2">
          <Mono className="text-[11px] text-[var(--projects-muted)]">{visible.length} of {initialEntries.length} events</Mono>
          <Mono className="text-[11px] text-[var(--projects-muted)]">organization scope · durable records</Mono>
        </div>
      </div>

      <LogDetail entry={selected} onClose={() => setSelected(null)} />
    </AdminPageBody>
  );
}

function LogRow({ entry, onOpen }: { entry: LogEntry; onOpen: () => void }) {
  const tone = LEVEL_TONE[entry.level];
  return (
    <button type="button" onClick={onOpen} aria-label={`Inspect audit event: ${entry.message}`} className="block w-full border-b border-[var(--projects-divider)] px-3.5 py-2 text-left transition-colors last:border-b-0 hover:bg-white/[0.03]">
      <span className="hidden items-center gap-3 md:grid md:grid-cols-[170px_68px_90px_minmax(0,1fr)_minmax(0,1.1fr)]">
        <Mono className="text-[11.5px] leading-5 text-[#8a8791]">{formatTimestamp(entry.timestamp)}</Mono>
        <span className={cn("text-[11px] font-semibold tracking-wide", tone.text)}>{entry.level}</span>
        <Mono className="truncate text-[11.5px] text-[#b3b0ba]">{entry.service}</Mono>
        <Mono className="truncate text-[12px] text-[var(--projects-text)]">{entry.message}</Mono>
        <span className="truncate text-[12px] text-[var(--projects-muted)]">{entry.user ?? "System worker"}</span>
      </span>
      <span className="block md:hidden">
        <span className="flex items-baseline gap-2">
          <span className={cn("text-[10.5px] font-semibold tracking-wide", tone.text)}>{entry.level}</span>
          <Mono className="truncate text-[11.5px] text-[#b3b0ba]">{entry.service}</Mono>
          <Mono className="ml-auto shrink-0 text-[10.5px] text-[#8a8791]">{formatTimestamp(entry.timestamp)}</Mono>
        </span>
        <Mono className="mt-0.5 block break-words text-[12px] text-[var(--projects-text)]">{entry.message}</Mono>
        <span className="mt-0.5 block truncate text-[11px] text-[var(--projects-muted)]">{entry.user ?? "System worker"}</span>
      </span>
    </button>
  );
}

function LogDetail({ entry, onClose }: { entry: LogEntry | null; onClose: () => void }) {
  return (
    <DetailDrawer open={entry !== null} onClose={onClose} title={<><span className="truncate">Audit event</span>{entry && <StatusBadge tone="neutral" label={entry.service} className="ml-2" />}</>} subtitle={entry?.message}>
      {entry && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-x-4">
            <DetailField label="Timestamp"><span className="admin-mono flex items-center gap-1">{formatTimestamp(entry.timestamp)}<CopyButton text={entry.timestamp} /></span></DetailField>
            <DetailField label="Level"><span className={cn("text-[12px] font-semibold", LEVEL_TONE[entry.level].label)}>{entry.level}</span></DetailField>
            <DetailField label="Service">{entry.service}</DetailField>
            <DetailField label="Actor">{entry.user ?? "System worker"}</DetailField>
            <DetailField label="Event ID"><span className="admin-mono flex items-center gap-1">{entry.id}<CopyButton text={entry.id} /></span></DetailField>
            <DetailField label="Target">{entry.meta ?? "—"}</DetailField>
          </div>
          <div>
            <p className="m-0 mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--projects-muted)]">Attributes</p>
            <pre className="admin-scrollbar m-0 overflow-x-auto rounded-lg border border-[var(--projects-border)] bg-[#0f0f11] p-3 text-[11.5px] leading-5 text-[#c9c5cd]">{JSON.stringify(entry.attributes, null, 2)}</pre>
            <div className="mt-2 flex justify-end"><span className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--projects-muted)]">Copy JSON <CopyButton text={JSON.stringify(entry.attributes, null, 2)} /></span></div>
          </div>
        </div>
      )}
    </DetailDrawer>
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().replace("T", " ").replace(".000Z", "Z");
}

function ColumnLabel({ children }: { children: ReactNode }) {
  return <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--projects-muted)]">{children}</span>;
}
