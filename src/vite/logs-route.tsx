import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ListFilter, LoaderCircle, RefreshCcw, ScrollText } from "lucide-react";
import { Link, useParams } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { browserAPI, browserAPIErrorMessage, type BrowserOrganizationAuditEvent, type BrowserTrace } from "@/lib/browser-api";
import { ErrorState as AsyncErrorState } from "./error-state";
import { queryKeys } from "./query-keys";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
}

function eventLevel(event: BrowserOrganizationAuditEvent) {
  const level = event.metadata.level;
  return typeof level === "string" ? level.toLowerCase() : "info";
}

function levelClass(level: string) {
  if (level === "error" || level === "critical") return "text-rose-200";
  if (level === "warn" || level === "warning") return "text-amber-200";
  return "text-[var(--projects-accent)]";
}

function traceStatusClass(status: number) {
  if (status >= 500) return "text-rose-200";
  if (status >= 400) return "text-amber-200";
  return "text-emerald-200";
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / 1024 ** 2).toFixed(1)} MiB`;
}

export default function LogsRoute() {
  const { projectId } = useParams({ from: "/projects/$projectId/logs" });
  const projectQuery = useQuery({ queryKey: queryKeys.project(projectId), queryFn: () => browserAPI.project(projectId) });
  const eventsQuery = useQuery({ queryKey: queryKeys.projectAuditEvents(projectId), queryFn: () => browserAPI.projectAuditEvents(projectId, { limit: 50 }) });
  const tracesQuery = useQuery({ queryKey: queryKeys.projectTraces(projectId), queryFn: () => browserAPI.projectTraces(projectId, { limit: 50 }) });
  const [events, setEvents] = useState<BrowserOrganizationAuditEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadPending, setLoadPending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [expandedID, setExpandedID] = useState<string | null>(null);
  const [traces, setTraces] = useState<BrowserTrace[]>([]);
  const [nextTraceCursor, setNextTraceCursor] = useState<string | null>(null);
  const [traceLoadPending, setTraceLoadPending] = useState(false);
  const [traceLoadError, setTraceLoadError] = useState("");

  useEffect(() => {
    setEvents(eventsQuery.data?.events ?? []);
    setNextCursor(eventsQuery.data?.pagination.next_cursor ?? null);
    setExpandedID(null);
  }, [eventsQuery.data]);

  useEffect(() => {
    setTraces(tracesQuery.data?.traces ?? []);
    setNextTraceCursor(tracesQuery.data?.pagination.next_cursor ?? null);
  }, [tracesQuery.data]);

  async function loadMore() {
    if (!nextCursor || loadPending) return;
    setLoadPending(true);
    setLoadError("");
    try {
      const page = await browserAPI.projectAuditEvents(projectId, { limit: 50, cursor: nextCursor });
      setEvents((current) => {
        const existing = new Set(current.map((event) => event.id));
        return [...current, ...page.events.filter((event) => !existing.has(event.id))];
      });
      setNextCursor(page.pagination.next_cursor);
    } catch (error) {
      setLoadError(browserAPIErrorMessage(error, "Unable to load more activity."));
    } finally {
      setLoadPending(false);
    }
  }

  async function loadMoreTraces() {
    if (!nextTraceCursor || traceLoadPending) return;
    setTraceLoadPending(true);
    setTraceLoadError("");
    try {
      const page = await browserAPI.projectTraces(projectId, { limit: 50, cursor: nextTraceCursor });
      setTraces((current) => {
        const existing = new Set(current.map((trace) => trace.id));
        return [...current, ...page.traces.filter((trace) => !existing.has(trace.id))];
      });
      setNextTraceCursor(page.pagination.next_cursor);
    } catch (error) {
      setTraceLoadError(browserAPIErrorMessage(error, "Unable to load more request traces."));
    } finally {
      setTraceLoadPending(false);
    }
  }

  const filteredEvents = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return events.filter((event) => {
      const matchesText = !needle || [event.action, event.target_type, event.target_id ?? "", event.actor_email ?? ""].some((value) => value.toLowerCase().includes(needle));
      const matchesTarget = targetFilter === "all" || event.target_type === targetFilter;
      const matchesLevel = levelFilter === "all" || eventLevel(event) === levelFilter;
      return matchesText && matchesTarget && matchesLevel;
    });
  }, [events, filter, levelFilter, targetFilter]);
  const targetTypes = [...new Set(events.map((event) => event.target_type))].sort();
  const levels = [...new Set(events.map(eventLevel))].sort();

  if (projectQuery.isPending || eventsQuery.isPending) return <StateCard title="Loading project logs…" />;
  const error = projectQuery.error ?? eventsQuery.error;
  if (error) return <AsyncErrorState error={error} fallback="The Go API did not return activity events." />;
  if (!projectQuery.data || !eventsQuery.data) return <AsyncErrorState error={null} fallback="The API returned an incomplete activity response." />;

  return <section>
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--projects-border)] pb-6">
      <div><Link to="/projects/$projectId" params={{ projectId }} className="text-sm text-[var(--projects-accent)] hover:underline">← Project overview</Link><div className="mt-5 flex items-start gap-3"><span className="inline-flex size-10 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--projects-accent)_14%,transparent)] text-[var(--projects-accent)]"><ScrollText size={19} aria-hidden="true" /></span><div><p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--projects-muted)]">Project activity</p><h1 className="m-0 mt-1 text-3xl font-semibold tracking-[-0.04em]">Logs</h1><p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-[var(--projects-muted)]">Durable control-plane events for {projectQuery.data.project.name}. Request traces and runtime tails remain separate observability streams.</p></div></div></div>
      <button type="button" onClick={() => { void eventsQuery.refetch(); void tracesQuery.refetch(); }} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-xs font-semibold hover:border-[var(--projects-border-hover)]"><RefreshCcw size={14} aria-hidden="true" />Refresh</button>
    </div>
    <div className="mt-6 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--projects-muted)]"><ListFilter size={14} aria-hidden="true" />Filters</div><div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_150px]"><label className="sr-only" htmlFor="vite-project-log-filter">Search activity</label><input id="vite-project-log-filter" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search action, actor, target, or ID" className="h-9 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm outline-none focus:border-[var(--projects-accent)]" /><label className="sr-only" htmlFor="vite-project-log-target">Target type</label><select id="vite-project-log-target" value={targetFilter} onChange={(event) => setTargetFilter(event.target.value)} className="h-9 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-xs"><option value="all">All targets</option>{targetTypes.map((target) => <option key={target} value={target}>{target}</option>)}</select><label className="sr-only" htmlFor="vite-project-log-level">Level</label><select id="vite-project-log-level" value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} className="h-9 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-xs"><option value="all">All levels</option>{levels.map((level) => <option key={level} value={level}>{level}</option>)}</select></div></div>
    <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)]"><table className="w-full min-w-[840px] text-left text-sm"><caption className="sr-only">Project activity logs</caption><thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] text-xs uppercase tracking-[0.08em] text-[var(--projects-muted)]"><tr><th scope="col" className="w-8 px-3 py-3" /><th scope="col" className="px-4 py-3">Action</th><th scope="col" className="px-4 py-3">Target</th><th scope="col" className="px-4 py-3">Actor</th><th scope="col" className="px-4 py-3">Timestamp</th></tr></thead><tbody className="divide-y divide-[var(--projects-divider)]">{filteredEvents.map((event) => { const expanded = expandedID === event.id; const level = eventLevel(event); return <Fragment key={event.id}><tr className="hover:bg-[var(--projects-control)]"><td className="px-3 py-3"><button type="button" onClick={() => setExpandedID((current) => current === event.id ? null : event.id)} aria-label={`${expanded ? "Hide" : "Show"} details for ${event.action}`} className="inline-flex size-7 items-center justify-center rounded-md text-[var(--projects-muted)] hover:text-[var(--projects-text)]"><ChevronDown size={15} className={`transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" /></button></td><td className="px-4 py-3"><span className={`font-mono text-xs font-semibold ${levelClass(level)}`}>{event.action}</span><span className="mt-1 block text-[10px] uppercase tracking-[0.08em] text-[var(--projects-muted)]">{level}</span></td><td className="px-4 py-3"><span>{event.target_type}</span>{event.target_id ? <span className="mt-1 block max-w-56 truncate font-mono text-[10px] text-[var(--projects-muted)]" title={event.target_id}>{event.target_id}</span> : null}</td><td className="px-4 py-3 text-xs text-[var(--projects-muted)]">{event.actor_email ?? event.actor_account_id ?? "System"}</td><td className="px-4 py-3 text-xs text-[var(--projects-muted)]"><time dateTime={event.created_at}>{formatDate(event.created_at)}</time></td></tr>{expanded ? <tr><td colSpan={5} className="bg-[var(--projects-control)] px-12 py-4"><div className="grid gap-3 text-xs md:grid-cols-2"><div><p className="m-0 uppercase tracking-[0.08em] text-[var(--projects-muted)]">Event ID</p><p className="m-0 mt-1 break-all font-mono">{event.id}</p></div><div><p className="m-0 uppercase tracking-[0.08em] text-[var(--projects-muted)]">Metadata</p><pre className="m-0 mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-3 font-mono text-[10px] leading-5">{JSON.stringify(event.metadata, null, 2)}</pre></div></div></td></tr> : null}</Fragment>; })}</tbody></table>{filteredEvents.length === 0 ? <p className="m-0 p-10 text-center text-sm text-[var(--projects-muted)]">{events.length ? "No events match the selected filters." : "No project activity recorded yet."}</p> : null}{loadError ? <p role="alert" className="m-0 border-t border-[var(--projects-divider)] px-5 py-3 text-sm text-rose-200">{loadError}</p> : null}{nextCursor ? <div className="flex justify-center border-t border-[var(--projects-divider)] px-5 py-3"><button type="button" onClick={() => void loadMore()} disabled={loadPending} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--projects-border)] px-3 text-xs font-semibold hover:bg-[var(--projects-control)] disabled:opacity-60">{loadPending ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}{loadPending ? "Loading…" : "Load more"}</button></div> : null}</div>
    <section className="mt-6 overflow-x-auto rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--projects-divider)] px-5 py-4"><div><h2 className="m-0 text-lg font-semibold">Request traces</h2><p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">Durable root-request index for this project. Nested spans and full attributes stay in private telemetry.</p></div><span className="text-xs text-[var(--projects-muted)]">{traces.length} loaded</span></div>{tracesQuery.isPending ? <p className="m-0 p-8 text-center text-sm text-[var(--projects-muted)]">Loading request traces…</p> : tracesQuery.error ? <p role="alert" className="m-0 p-8 text-center text-sm text-rose-200">{browserAPIErrorMessage(tracesQuery.error, "Unable to load request traces.")}</p> : traces.length ? <table className="w-full min-w-[900px] text-left text-sm"><caption className="sr-only">Project request traces</caption><thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] text-xs uppercase tracking-[0.08em] text-[var(--projects-muted)]"><tr><th scope="col" className="px-4 py-3">Status</th><th scope="col" className="px-4 py-3">Request</th><th scope="col" className="px-4 py-3">Duration</th><th scope="col" className="px-4 py-3">Egress</th><th scope="col" className="px-4 py-3">Timestamp</th></tr></thead><tbody className="divide-y divide-[var(--projects-divider)]">{traces.map((trace) => <tr key={trace.id}><td className={`px-4 py-3 font-mono text-xs font-semibold ${traceStatusClass(trace.status)}`}>{trace.status}</td><td className="px-4 py-3"><span className="font-mono text-xs">{trace.method} {trace.route}</span><span className="mt-1 block font-mono text-[10px] text-[var(--projects-muted)]">trace {trace.trace_id}</span></td><td className="px-4 py-3 font-mono text-xs text-[var(--projects-muted)]">{trace.duration_ms} ms</td><td className="px-4 py-3 font-mono text-xs text-[var(--projects-muted)]">{formatBytes(trace.response_bytes)}</td><td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--projects-muted)]"><time dateTime={trace.started_at}>{formatDate(trace.started_at)}</time></td></tr>)}</tbody></table> : <p className="m-0 p-8 text-center text-sm text-[var(--projects-muted)]">No request traces recorded yet.</p>}{traceLoadError ? <p role="alert" className="m-0 border-t border-[var(--projects-divider)] px-5 py-3 text-sm text-rose-200">{traceLoadError}</p> : null}{nextTraceCursor ? <div className="flex justify-center border-t border-[var(--projects-divider)] px-5 py-3"><button type="button" onClick={() => void loadMoreTraces()} disabled={traceLoadPending} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--projects-border)] px-3 text-xs font-semibold hover:bg-[var(--projects-control)] disabled:opacity-60">{traceLoadPending ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}{traceLoadPending ? "Loading…" : "Load more traces"}</button></div> : null}</section>
  </section>;
}

function StateCard({ title, detail, error = false }: { title: string; detail?: string; error?: boolean }) {
  return <div className={`grid min-h-[18rem] place-items-center rounded-xl border bg-[var(--projects-card-bg)] p-8 text-center ${error ? "border-[var(--projects-danger)]/40" : "border-[var(--projects-border)]"}`} role={error ? "alert" : undefined}><div><p className="m-0 font-semibold">{title}</p>{detail ? <p className="m-0 mt-2 text-sm text-[var(--projects-muted)]">{detail}</p> : null}</div></div>;
}
