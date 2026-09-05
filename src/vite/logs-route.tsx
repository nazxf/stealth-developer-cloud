import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ListFilter, LoaderCircle, RefreshCcw, ScrollText } from "lucide-react";
import { Link, useParams } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { BrowserAPIError, browserAPI, type BrowserOrganizationAuditEvent } from "@/lib/browser-api";

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

export default function LogsRoute() {
  const { projectId } = useParams({ from: "/projects/$projectId/logs" });
  const projectQuery = useQuery({ queryKey: ["project", projectId], queryFn: () => browserAPI.project(projectId) });
  const eventsQuery = useQuery({ queryKey: ["project-audit-events", projectId], queryFn: () => browserAPI.projectAuditEvents(projectId, { limit: 50 }) });
  const [events, setEvents] = useState<BrowserOrganizationAuditEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadPending, setLoadPending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [expandedID, setExpandedID] = useState<string | null>(null);

  useEffect(() => {
    setEvents(eventsQuery.data?.events ?? []);
    setNextCursor(eventsQuery.data?.pagination.next_cursor ?? null);
    setExpandedID(null);
  }, [eventsQuery.data]);

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
      setLoadError(error instanceof BrowserAPIError ? error.message : "Unable to load more activity.");
    } finally {
      setLoadPending(false);
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
  if (error) return <StateCard title="Unable to load project logs" detail={error instanceof Error ? error.message : "The Go API did not return activity events."} error />;
  if (!projectQuery.data || !eventsQuery.data) return <StateCard title="Project logs are unavailable" detail="The API returned an incomplete activity response." error />;

  return <section>
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--projects-border)] pb-6">
      <div><Link to="/projects/$projectId" params={{ projectId }} className="text-sm text-[var(--projects-accent)] hover:underline">← Project overview</Link><div className="mt-5 flex items-start gap-3"><span className="inline-flex size-10 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--projects-accent)_14%,transparent)] text-[var(--projects-accent)]"><ScrollText size={19} aria-hidden="true" /></span><div><p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--projects-muted)]">Project activity</p><h1 className="m-0 mt-1 text-3xl font-semibold tracking-[-0.04em]">Logs</h1><p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-[var(--projects-muted)]">Durable control-plane events for {projectQuery.data.project.name}. Request traces and runtime tails remain separate observability streams.</p></div></div></div>
      <button type="button" onClick={() => void eventsQuery.refetch()} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-xs font-semibold hover:border-[var(--projects-border-hover)]"><RefreshCcw size={14} aria-hidden="true" />Refresh</button>
    </div>
    <div className="mt-6 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--projects-muted)]"><ListFilter size={14} aria-hidden="true" />Filters</div><div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_150px]"><label className="sr-only" htmlFor="vite-project-log-filter">Search activity</label><input id="vite-project-log-filter" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search action, actor, target, or ID" className="h-9 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm outline-none focus:border-[var(--projects-accent)]" /><label className="sr-only" htmlFor="vite-project-log-target">Target type</label><select id="vite-project-log-target" value={targetFilter} onChange={(event) => setTargetFilter(event.target.value)} className="h-9 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-xs"><option value="all">All targets</option>{targetTypes.map((target) => <option key={target} value={target}>{target}</option>)}</select><label className="sr-only" htmlFor="vite-project-log-level">Level</label><select id="vite-project-log-level" value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} className="h-9 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-xs"><option value="all">All levels</option>{levels.map((level) => <option key={level} value={level}>{level}</option>)}</select></div></div>
    <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)]"><table className="w-full min-w-[840px] text-left text-sm"><caption className="sr-only">Project activity logs</caption><thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] text-xs uppercase tracking-[0.08em] text-[var(--projects-muted)]"><tr><th scope="col" className="w-8 px-3 py-3" /><th scope="col" className="px-4 py-3">Action</th><th scope="col" className="px-4 py-3">Target</th><th scope="col" className="px-4 py-3">Actor</th><th scope="col" className="px-4 py-3">Timestamp</th></tr></thead><tbody className="divide-y divide-[var(--projects-divider)]">{filteredEvents.map((event) => { const expanded = expandedID === event.id; const level = eventLevel(event); return <Fragment key={event.id}><tr className="hover:bg-[var(--projects-control)]"><td className="px-3 py-3"><button type="button" onClick={() => setExpandedID((current) => current === event.id ? null : event.id)} aria-label={`${expanded ? "Hide" : "Show"} details for ${event.action}`} className="inline-flex size-7 items-center justify-center rounded-md text-[var(--projects-muted)] hover:text-[var(--projects-text)]"><ChevronDown size={15} className={`transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" /></button></td><td className="px-4 py-3"><span className={`font-mono text-xs font-semibold ${levelClass(level)}`}>{event.action}</span><span className="mt-1 block text-[10px] uppercase tracking-[0.08em] text-[var(--projects-muted)]">{level}</span></td><td className="px-4 py-3"><span>{event.target_type}</span>{event.target_id ? <span className="mt-1 block max-w-56 truncate font-mono text-[10px] text-[var(--projects-muted)]" title={event.target_id}>{event.target_id}</span> : null}</td><td className="px-4 py-3 text-xs text-[var(--projects-muted)]">{event.actor_email ?? event.actor_account_id ?? "System"}</td><td className="px-4 py-3 text-xs text-[var(--projects-muted)]"><time dateTime={event.created_at}>{formatDate(event.created_at)}</time></td></tr>{expanded ? <tr><td colSpan={5} className="bg-[var(--projects-control)] px-12 py-4"><div className="grid gap-3 text-xs md:grid-cols-2"><div><p className="m-0 uppercase tracking-[0.08em] text-[var(--projects-muted)]">Event ID</p><p className="m-0 mt-1 break-all font-mono">{event.id}</p></div><div><p className="m-0 uppercase tracking-[0.08em] text-[var(--projects-muted)]">Metadata</p><pre className="m-0 mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-3 font-mono text-[10px] leading-5">{JSON.stringify(event.metadata, null, 2)}</pre></div></div></td></tr> : null}</Fragment>; })}</tbody></table>{filteredEvents.length === 0 ? <p className="m-0 p-10 text-center text-sm text-[var(--projects-muted)]">{events.length ? "No events match the selected filters." : "No project activity recorded yet."}</p> : null}{loadError ? <p role="alert" className="m-0 border-t border-[var(--projects-divider)] px-5 py-3 text-sm text-rose-200">{loadError}</p> : null}{nextCursor ? <div className="flex justify-center border-t border-[var(--projects-divider)] px-5 py-3"><button type="button" onClick={() => void loadMore()} disabled={loadPending} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--projects-border)] px-3 text-xs font-semibold hover:bg-[var(--projects-control)] disabled:opacity-60">{loadPending ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}{loadPending ? "Loading…" : "Load more"}</button></div> : null}</div>
  </section>;
}

function StateCard({ title, detail, error = false }: { title: string; detail?: string; error?: boolean }) {
  return <div className={`grid min-h-[18rem] place-items-center rounded-xl border bg-[var(--projects-card-bg)] p-8 text-center ${error ? "border-[var(--projects-danger)]/40" : "border-[var(--projects-border)]"}`} role={error ? "alert" : undefined}><div><p className="m-0 font-semibold">{title}</p>{detail ? <p className="m-0 mt-2 text-sm text-[var(--projects-muted)]">{detail}</p> : null}</div></div>;
}
