"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CopyButton } from "@/features/admin/components/copy-button";
import { DetailDrawer, DetailField } from "@/features/admin/components/detail-drawer";
import { AdminSelect } from "@/features/admin/components/admin-select";
import { Mono } from "@/features/admin/components/admin-panel";
import { StatusBadge } from "@/features/admin/components/status-badge";
import { ToolbarSearch } from "@/features/admin/components/toolbar-search";
import { logEntryFromAuditEvent } from "@/features/admin/logs/admin-logs";
import { cn } from "@/lib/utils";
import type { LogEntry, LogLevel } from "@/features/admin/types/logs";

type AuditEventWire = {
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

const LEVELS: LogLevel[] = ["INFO", "WARN", "ERROR", "DEBUG"];
const LEVEL_TONE: Record<LogLevel, { text: string; label: string }> = {
  INFO: { text: "text-[#a1a1aa]", label: "text-[#a1a1aa]" },
  WARN: { text: "text-[var(--projects-warning)]", label: "text-[var(--projects-warning)]" },
  ERROR: { text: "text-[var(--projects-danger)]", label: "text-[var(--projects-danger)]" },
  DEBUG: { text: "text-[#62626a]", label: "text-[#62626a]" },
};

type LevelFilter = "all" | LogLevel;
type ServiceFilter = "all" | string;

export function ProjectLogs({ projectId, initialEntries, initialNextCursor }: { projectId: string; initialEntries: LogEntry[]; initialNextCursor: string | null }) {
  const [entries, setEntries] = useState(initialEntries);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [query, setQuery] = useState("");
  const [service, setService] = useState<ServiceFilter>("all");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [selected, setSelected] = useState<LogEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const services = useMemo(() => unique(entries.map((entry) => entry.service)), [entries]);
  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (service !== "all" && entry.service !== service) return false;
      if (level !== "all" && entry.level !== level) return false;
      if (!normalizedQuery) return true;
      return [entry.message, entry.service, entry.user ?? "", entry.id].join(" ").toLowerCase().includes(normalizedQuery);
    });
  }, [entries, query, service, level]);

  async function loadMore() {
    if (!nextCursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/stealth/projects/${encodeURIComponent(projectId)}/audit-events?limit=50&cursor=${encodeURIComponent(nextCursor)}`, { credentials: "include", headers: { accept: "application/json" } });
      const payload = await response.json().catch(() => null) as { events?: AuditEventWire[]; pagination?: { next_cursor: string | null }; error?: { message?: string } } | null;
      if (!response.ok || !payload?.events || !payload.pagination) throw new Error(payload?.error?.message ?? "More audit events could not be loaded.");
      setEntries((current) => [...current, ...payload.events!.map(logEntryFromAuditEvent)]);
      setNextCursor(payload.pagination.next_cursor);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "More audit events could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--projects-border)] pb-6">
        <div>
          <p className="m-0 font-mono text-[12px] text-[var(--projects-muted)]">project: {projectId}</p>
          <h1 className="m-0 mt-2 text-[28px] font-semibold tracking-[-0.035em] text-[var(--projects-text)]">Logs</h1>
          <p className="m-0 mt-2 max-w-2xl text-[14px] leading-6 text-[var(--projects-muted)]">Durable control-plane audit events for this project.</p>
        </div>
        <Mono className="rounded-lg border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-3 py-2 text-[12px] text-[var(--projects-muted)]">{visible.length} / {entries.length} events</Mono>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        <ToolbarSearch value={query} onChange={setQuery} placeholder="Search action, actor, target..." label="Search project audit events" />
        <AdminSelect label="Filter by service" value={service} onChange={(value) => setService(value as ServiceFilter)} options={[{ value: "all", label: "All services" }, ...services.map((item) => ({ value: item, label: item }))]} />
        <AdminSelect label="Filter by level" value={level} onChange={(value) => setLevel(value as LevelFilter)} options={[{ value: "all", label: "All levels" }, ...LEVELS.map((item) => ({ value: item, label: item }))]} />
      </div>

      {error ? <p role="alert" className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--projects-danger)_45%,var(--projects-border))] bg-[color-mix(in_srgb,var(--projects-danger)_8%,#141416)] px-3.5 py-3 text-[12.5px] text-[var(--projects-danger)]">{error}</p> : null}

      <div className="mt-4 overflow-hidden rounded-lg border border-[var(--projects-border)] bg-[var(--projects-card-bg)]">
        <div aria-hidden="true" className="hidden grid-cols-[170px_68px_90px_minmax(0,1fr)_minmax(0,1.1fr)] gap-3 border-b border-[var(--projects-divider)] px-3.5 py-2 md:grid">
          <ColumnLabel>Time</ColumnLabel><ColumnLabel>Level</ColumnLabel><ColumnLabel>Service</ColumnLabel><ColumnLabel>Event</ColumnLabel><ColumnLabel>Actor</ColumnLabel>
        </div>
        <div className="max-h-[640px] overflow-y-auto">
          {visible.length === 0 ? <p className="m-0 px-4 py-12 text-center text-[13px] text-[var(--projects-muted)]">{entries.length === 0 ? "No durable audit events have been recorded." : "No events match the current filters."}</p> : visible.map((entry) => <LogRow key={entry.id} entry={entry} onOpen={() => setSelected(entry)} />)}
        </div>
        {nextCursor ? <div className="flex justify-center border-t border-[var(--projects-divider)] px-3.5 py-3"><button type="button" onClick={() => void loadMore()} disabled={loading} className="inline-flex h-9 items-center rounded-md border border-[var(--projects-border)] px-3 text-[12px] font-semibold text-[var(--projects-text)] disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Loading…" : "Load more"}</button></div> : null}
      </div>
      <ProjectLogDetail entry={selected} onClose={() => setSelected(null)} />
    </section>
  );
}

function LogRow({ entry, onOpen }: { entry: LogEntry; onOpen: () => void }) {
  const tone = LEVEL_TONE[entry.level];
  return <button type="button" onClick={onOpen} aria-label={`Inspect audit event: ${entry.message}`} className="block w-full border-b border-[var(--projects-divider)] px-3.5 py-2 text-left transition-colors last:border-b-0 hover:bg-white/[0.03]"><span className="hidden items-center gap-3 md:grid md:grid-cols-[170px_68px_90px_minmax(0,1fr)_minmax(0,1.1fr)]"><Mono className="text-[11.5px] leading-5 text-[var(--projects-muted)]">{formatTimestamp(entry.timestamp)}</Mono><span className={cn("text-[11px] font-semibold tracking-wide", tone.text)}>{entry.level}</span><Mono className="truncate text-[11.5px] text-[var(--projects-muted)]">{entry.service}</Mono><Mono className="truncate text-[12px] text-[var(--projects-text)]">{entry.message}</Mono><span className="truncate text-[12px] text-[var(--projects-muted)]">{entry.user ?? "System worker"}</span></span><span className="block md:hidden"><span className="flex items-baseline gap-2"><span className={cn("text-[10.5px] font-semibold tracking-wide", tone.text)}>{entry.level}</span><Mono className="truncate text-[11.5px] text-[var(--projects-muted)]">{entry.service}</Mono><Mono className="ml-auto shrink-0 text-[10.5px] text-[var(--projects-muted)]">{formatTimestamp(entry.timestamp)}</Mono></span><Mono className="mt-0.5 block break-words text-[12px] text-[var(--projects-text)]">{entry.message}</Mono></span></button>;
}

function ProjectLogDetail({ entry, onClose }: { entry: LogEntry | null; onClose: () => void }) {
  return <DetailDrawer open={entry !== null} onClose={onClose} title={<><span className="truncate">Audit event</span>{entry && <StatusBadge tone="neutral" label={entry.service} className="ml-2" />}</>} subtitle={entry?.message}>{entry ? <div className="flex flex-col gap-4"><div className="grid grid-cols-2 gap-x-4"><DetailField label="Timestamp"><span className="admin-mono flex items-center gap-1">{formatTimestamp(entry.timestamp)}<CopyButton text={entry.timestamp} /></span></DetailField><DetailField label="Level"><span className={cn("text-[12px] font-semibold", LEVEL_TONE[entry.level].label)}>{entry.level}</span></DetailField><DetailField label="Service">{entry.service}</DetailField><DetailField label="Actor">{entry.user ?? "System worker"}</DetailField><DetailField label="Event ID"><span className="admin-mono flex items-center gap-1">{entry.id}<CopyButton text={entry.id} /></span></DetailField><DetailField label="Target">{entry.meta ?? "—"}</DetailField></div><div><p className="m-0 mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--projects-muted)]">Attributes</p><pre className="m-0 overflow-x-auto rounded-lg border border-[var(--projects-border)] bg-[#0f0f11] p-3 text-[11.5px] leading-5 text-[#c9c5cd]">{JSON.stringify(entry.attributes, null, 2)}</pre></div></div> : null}</DetailDrawer>;
}

function unique(values: string[]) { return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right)); }
function formatTimestamp(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toISOString().replace("T", " ").replace(".000Z", "Z"); }
function ColumnLabel({ children }: { children: ReactNode }) { return <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--projects-muted)]">{children}</span>; }
