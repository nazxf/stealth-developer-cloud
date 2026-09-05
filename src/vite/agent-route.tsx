import { Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Bot, Cpu, FolderGit2, GitBranch, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { BrowserAPIError, browserAPI, type BrowserAgent, type BrowserAgentRole } from "@/lib/browser-api";
import { AgentCreateForm, agentRoles } from "./agent-create-form";
import { queryClient } from "./query-client";

function formatLastActive(value: string | null | undefined) {
  if (!value) return "No activity";
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

function statusClass(status: BrowserAgent["status"]) {
  if (status === "running") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  if (status === "active") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  return "border-[var(--projects-border)] bg-[var(--projects-control)] text-[var(--projects-muted)]";
}

function LoadingState() {
  return <div className="grid min-h-[18rem] place-items-center rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] text-sm text-[var(--projects-muted)]" aria-live="polite">Loading agents…</div>;
}

function ErrorState({ error }: { error: unknown }) {
  return <div role="alert" className="rounded-xl border border-[var(--projects-danger)]/40 bg-[var(--projects-card-bg)] p-6 text-sm text-[var(--projects-danger)]">{error instanceof Error ? error.message : "Unable to load agents."}</div>;
}

export default function AgentRoute() {
  const agentsQuery = useQuery({ queryKey: ["agents"], queryFn: () => browserAPI.agents({ limit: 100 }) });
  const organizationsQuery = useQuery({ queryKey: ["organizations"], queryFn: () => browserAPI.organizations({ limit: 100 }) });
  const projectQueries = useQueries({ queries: (organizationsQuery.data?.organizations ?? []).map((organization) => ({ queryKey: ["projects", organization.id], queryFn: () => browserAPI.projects(organization.id, { limit: 100 }) })) });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | BrowserAgent["status"]>("all");
  const [role, setRole] = useState<"all" | BrowserAgentRole>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteID, setDeleteID] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const projects = useMemo(() => projectQueries.flatMap((query) => query.data?.projects ?? []).filter((project, index, all) => all.findIndex((candidate) => candidate.id === project.id) === index), [projectQueries]);
  const filteredAgents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (agentsQuery.data?.agents ?? []).filter((agent) => {
      const matchesText = !query || [agent.name, agent.description, agent.role, agent.project_name, agent.model].some((value) => value.toLowerCase().includes(query));
      return matchesText && (status === "all" || agent.status === status) && (role === "all" || agent.role === role);
    }).sort((first, second) => Date.parse(second.updated_at) - Date.parse(first.updated_at));
  }, [agentsQuery.data?.agents, role, search, status]);

  const roles = agentRoles;

  async function deleteAgent(agent: BrowserAgent) {
    if (deleteID || !window.confirm(`Delete agent “${agent.name}”?`)) return;
    setDeleteID(agent.id);
    setActionError("");
    try {
      await browserAPI.deleteAgent(agent.id);
      await queryClient.invalidateQueries({ queryKey: ["agents"] });
    } catch (error) {
      setActionError(error instanceof BrowserAPIError ? error.message : "The agent could not be deleted.");
    } finally {
      setDeleteID(null);
    }
  }

  if (agentsQuery.isPending || organizationsQuery.isPending || projectQueries.some((query) => query.isPending)) return <LoadingState />;
  if (agentsQuery.error || organizationsQuery.error || projectQueries.some((query) => query.error)) return <ErrorState error={agentsQuery.error ?? organizationsQuery.error ?? projectQueries.find((query) => query.error)?.error} />;

  return <section><header className="flex flex-wrap items-end justify-between gap-5 border-b border-[var(--projects-border)] pb-6"><div><p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--projects-muted)]">Automation control plane</p><h1 className="m-0 mt-2 text-3xl font-semibold tracking-[-0.04em]">Agents</h1><p className="m-0 mt-2 max-w-2xl text-sm text-[var(--projects-muted)]">Build, run, and manage coding agents for your projects. Runs remain durable in the Go queue.</p></div><button type="button" onClick={() => { setActionError(""); setCreateOpen(true); }} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-4 text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)]"><Plus size={15} aria-hidden="true" />New agent</button></header>
    {actionError ? <p role="alert" className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{actionError}</p> : null}
    <div className="mt-6 grid gap-3 sm:grid-cols-3"><Summary label="Total agents" value={agentsQuery.data.agents.length} /><Summary label="Running" value={agentsQuery.data.agents.filter((agent) => agent.status === "running").length} tone="warning" /><Summary label="Projects" value={new Set(agentsQuery.data.agents.map((agent) => agent.project_id)).size} tone="accent" /></div>
    <div className="mt-6 flex flex-wrap items-center gap-2"><label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 sm:max-w-sm"><Search size={15} className="text-[var(--projects-muted)]" aria-hidden="true" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search agents…" aria-label="Search agents" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="h-10 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm"><option value="all">All status</option><option value="active">Active</option><option value="running">Running</option><option value="idle">Idle</option></select><select value={role} onChange={(event) => setRole(event.target.value as typeof role)} className="h-10 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm"><option value="all">All roles</option>{roles.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
    <div className="mt-5 overflow-hidden rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)]"><div className="hidden border-b border-[var(--projects-divider)] bg-[var(--projects-control)] px-5 py-3 text-xs uppercase tracking-[0.08em] text-[var(--projects-muted)] lg:grid lg:grid-cols-[minmax(0,2fr)_120px_minmax(0,1.4fr)_150px_auto] lg:gap-4"><span>Agent</span><span>Role</span><span>Project</span><span>Last active</span><span /></div>{filteredAgents.length ? filteredAgents.map((agent) => <article key={agent.id} className="flex flex-col gap-3 border-b border-[var(--projects-divider)] px-5 py-4 last:border-b-0 lg:grid lg:grid-cols-[minmax(0,2fr)_120px_minmax(0,1.4fr)_150px_auto] lg:items-center lg:gap-4"><div className="min-w-0"><Link to="/agent/$agentId" params={{ agentId: agent.id }} className="flex items-center gap-3 hover:text-[var(--projects-accent)]"><span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] text-[var(--projects-accent)]"><Bot size={17} aria-hidden="true" /></span><span className="min-w-0"><span className="block truncate font-semibold">{agent.name}</span><span className="mt-0.5 block truncate text-xs text-[var(--projects-muted)]">{agent.description || "No description"}</span></span></Link><div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--projects-muted)]"><span className="inline-flex items-center gap-1"><Cpu size={12} aria-hidden="true" />{agent.model}</span><span className="inline-flex items-center gap-1"><GitBranch size={12} aria-hidden="true" />{agent.branch}</span></div></div><span className={`inline-flex w-fit rounded-full border px-2 py-1 text-xs font-medium ${statusClass(agent.status)}`}>{agent.status}</span><span className="inline-flex items-center gap-1 text-xs text-[var(--projects-muted)]"><FolderGit2 size={13} aria-hidden="true" />{agent.project_name}</span><span className="text-xs text-[var(--projects-muted)]">{formatLastActive(agent.last_active_at ?? agent.updated_at)}</span><div className="flex items-center gap-2 lg:justify-end"><Link to="/agent/$agentId" params={{ agentId: agent.id }} className="h-8 rounded-lg border border-[var(--projects-border)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--projects-control)]">Open</Link><button type="button" onClick={() => void deleteAgent(agent)} disabled={deleteID !== null} className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-500/25 px-2.5 text-xs text-rose-200 hover:bg-rose-500/10 disabled:opacity-60"><Trash2 size={13} aria-hidden="true" />{deleteID === agent.id ? "Deleting…" : "Delete"}</button></div></article>) : <div className="p-12 text-center text-sm text-[var(--projects-muted)]">No agents match these filters.</div>}</div>

    {createOpen ? <AgentCreateForm projects={projects} onClose={() => setCreateOpen(false)} /> : null}
  </section>;
}

function Summary({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "warning" | "accent" }) {
  const valueClass = tone === "warning" ? "text-[var(--projects-warning)]" : tone === "accent" ? "text-[var(--projects-accent)]" : "text-[var(--projects-text)]";
  return <article className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-4 py-3"><p className="m-0 text-xs text-[var(--projects-muted)]">{label}</p><p className={`m-0 mt-1 font-mono text-2xl font-semibold ${valueClass}`}>{value}</p></article>;
}
