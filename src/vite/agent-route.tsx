import { Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Bot, Cpu, FolderGit2, GitBranch, LoaderCircle, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { BrowserAPIError, browserAPI, type BrowserAgent, type BrowserAgentRole, type BrowserAgentTool } from "@/lib/browser-api";
import { queryClient } from "./query-client";

const roles: BrowserAgentRole[] = ["General", "Frontend", "Reviewer", "Documentation"];
const tools: BrowserAgentTool[] = ["Read files", "Search code", "Edit files", "Terminal", "Run tests", "Git diff"];
const defaultInstructions = "Inspect the repository before making changes. Read project instructions before editing. Prefer small, focused changes and run typecheck after editing.";

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
  const [createPending, setCreatePending] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedRole, setSelectedRole] = useState<BrowserAgentRole>("General");
  const [projectID, setProjectID] = useState("");
  const [branch, setBranch] = useState("main");
  const [provider, setProvider] = useState("OpenAI");
  const [model, setModel] = useState("GPT-5.6");
  const [instructions, setInstructions] = useState(defaultInstructions);
  const [selectedTools, setSelectedTools] = useState<BrowserAgentTool[]>([...tools]);

  const projects = useMemo(() => projectQueries.flatMap((query) => query.data?.projects ?? []).filter((project, index, all) => all.findIndex((candidate) => candidate.id === project.id) === index), [projectQueries]);
  const filteredAgents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (agentsQuery.data?.agents ?? []).filter((agent) => {
      const matchesText = !query || [agent.name, agent.description, agent.role, agent.project_name, agent.model].some((value) => value.toLowerCase().includes(query));
      return matchesText && (status === "all" || agent.status === status) && (role === "all" || agent.role === role);
    }).sort((first, second) => Date.parse(second.updated_at) - Date.parse(first.updated_at));
  }, [agentsQuery.data?.agents, role, search, status]);

  function resetCreate() {
    setName("");
    setDescription("");
    setSelectedRole("General");
    setProjectID(projects[0]?.id ?? "");
    setBranch("main");
    setProvider("OpenAI");
    setModel("GPT-5.6");
    setInstructions(defaultInstructions);
    setSelectedTools([...tools]);
  }

  async function createAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createPending) return;
    if (!projectID || name.trim().length < 2) { setActionError("Choose a project and provide an agent name."); return; }
    setCreatePending(true);
    setActionError("");
    try {
      await browserAPI.createAgent({ project_id: projectID, name: name.trim(), description: description.trim(), role: selectedRole, branch: branch.trim() || "main", provider, model, instructions: instructions.trim() || null, tools: selectedTools });
      setCreateOpen(false);
      resetCreate();
      await queryClient.invalidateQueries({ queryKey: ["agents"] });
    } catch (error) {
      setActionError(error instanceof BrowserAPIError ? error.message : "The agent could not be created.");
    } finally {
      setCreatePending(false);
    }
  }

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

  return <section><header className="flex flex-wrap items-end justify-between gap-5 border-b border-[var(--projects-border)] pb-6"><div><p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--projects-muted)]">Automation control plane</p><h1 className="m-0 mt-2 text-3xl font-semibold tracking-[-0.04em]">Agents</h1><p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-[var(--projects-muted)]">Build, run, and manage coding agents for your projects. Runs remain durable in the Go queue.</p></div><button type="button" onClick={() => { setActionError(""); resetCreate(); setCreateOpen(true); }} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-4 text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)]"><Plus size={15} aria-hidden="true" />New agent</button></header>
    {actionError ? <p role="alert" className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{actionError}</p> : null}
    <div className="mt-6 grid gap-3 sm:grid-cols-3"><Summary label="Total agents" value={agentsQuery.data.agents.length} /><Summary label="Running" value={agentsQuery.data.agents.filter((agent) => agent.status === "running").length} tone="warning" /><Summary label="Projects" value={new Set(agentsQuery.data.agents.map((agent) => agent.project_id)).size} tone="accent" /></div>
    <div className="mt-6 flex flex-wrap items-center gap-2"><label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 sm:max-w-sm"><Search size={15} className="text-[var(--projects-muted)]" aria-hidden="true" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search agents…" aria-label="Search agents" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="h-10 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm"><option value="all">All status</option><option value="active">Active</option><option value="running">Running</option><option value="idle">Idle</option></select><select value={role} onChange={(event) => setRole(event.target.value as typeof role)} className="h-10 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm"><option value="all">All roles</option>{roles.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
    <div className="mt-5 overflow-hidden rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)]"><div className="hidden border-b border-[var(--projects-divider)] bg-[var(--projects-control)] px-5 py-3 text-xs uppercase tracking-[0.08em] text-[var(--projects-muted)] lg:grid lg:grid-cols-[minmax(0,2fr)_120px_minmax(0,1.4fr)_150px_auto] lg:gap-4"><span>Agent</span><span>Role</span><span>Project</span><span>Last active</span><span /></div>{filteredAgents.length ? filteredAgents.map((agent) => <article key={agent.id} className="flex flex-col gap-3 border-b border-[var(--projects-divider)] px-5 py-4 last:border-b-0 lg:grid lg:grid-cols-[minmax(0,2fr)_120px_minmax(0,1.4fr)_150px_auto] lg:items-center lg:gap-4"><div className="min-w-0"><Link to="/agent/$agentId" params={{ agentId: agent.id }} className="flex items-center gap-3 hover:text-[var(--projects-accent)]"><span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] text-[var(--projects-accent)]"><Bot size={17} aria-hidden="true" /></span><span className="min-w-0"><span className="block truncate font-semibold">{agent.name}</span><span className="mt-0.5 block truncate text-xs text-[var(--projects-muted)]">{agent.description || "No description"}</span></span></Link><div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--projects-muted)]"><span className="inline-flex items-center gap-1"><Cpu size={12} aria-hidden="true" />{agent.model}</span><span className="inline-flex items-center gap-1"><GitBranch size={12} aria-hidden="true" />{agent.branch}</span></div></div><span className={`inline-flex w-fit rounded-full border px-2 py-1 text-xs font-medium ${statusClass(agent.status)}`}>{agent.status}</span><span className="inline-flex items-center gap-1 text-xs text-[var(--projects-muted)]"><FolderGit2 size={13} aria-hidden="true" />{agent.project_name}</span><span className="text-xs text-[var(--projects-muted)]">{formatLastActive(agent.last_active_at ?? agent.updated_at)}</span><div className="flex items-center gap-2 lg:justify-end"><Link to="/agent/$agentId" params={{ agentId: agent.id }} className="h-8 rounded-lg border border-[var(--projects-border)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--projects-control)]">Open</Link><button type="button" onClick={() => void deleteAgent(agent)} disabled={deleteID !== null} className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-500/25 px-2.5 text-xs text-rose-200 hover:bg-rose-500/10 disabled:opacity-60"><Trash2 size={13} aria-hidden="true" />{deleteID === agent.id ? "Deleting…" : "Delete"}</button></div></article>) : <div className="p-12 text-center text-sm text-[var(--projects-muted)]">No agents match these filters.</div>}</div>

    {createOpen ? <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/65 p-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="vite-create-agent-title" className="my-8 w-full max-w-2xl rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5 shadow-2xl shadow-black/40"><div className="flex items-start justify-between gap-4"><div><h2 id="vite-create-agent-title" className="m-0 text-lg font-semibold">Create agent</h2><p className="m-0 mt-1 text-sm text-[var(--projects-muted)]">Configure a durable coding agent for a project.</p></div><button type="button" onClick={() => { if (!createPending) setCreateOpen(false); }} aria-label="Close create agent dialog" className="inline-flex size-8 items-center justify-center rounded-md text-[var(--projects-muted)] hover:bg-[var(--projects-control)]"><X size={17} aria-hidden="true" /></button></div><form onSubmit={(event) => void createAgent(event)} className="mt-5 space-y-4" noValidate><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-[var(--projects-muted)] sm:col-span-2">Name<input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} disabled={createPending} className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm" placeholder="Frontend Engineer" /></label><label className="text-xs text-[var(--projects-muted)]">Project<select required value={projectID} onChange={(event) => setProjectID(event.target.value)} disabled={createPending} className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm"><option value="">Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label className="text-xs text-[var(--projects-muted)]">Role<select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as BrowserAgentRole)} disabled={createPending} className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm">{roles.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="text-xs text-[var(--projects-muted)]">Provider<select value={provider} onChange={(event) => { setProvider(event.target.value); setModel(event.target.value === "OpenAI" ? "GPT-5.6" : "Claude Sonnet 4.5"); }} disabled={createPending} className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm"><option>OpenAI</option><option>Anthropic</option></select></label><label className="text-xs text-[var(--projects-muted)]">Model<input value={model} onChange={(event) => setModel(event.target.value)} disabled={createPending} className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm" /></label><label className="text-xs text-[var(--projects-muted)]">Branch<input value={branch} onChange={(event) => setBranch(event.target.value)} disabled={createPending} className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm" /></label><label className="text-xs text-[var(--projects-muted)] sm:col-span-2">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} disabled={createPending} rows={2} className="mt-1 block w-full resize-y rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-sm" /></label><label className="text-xs text-[var(--projects-muted)] sm:col-span-2">Instructions<textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} disabled={createPending} rows={4} className="mt-1 block w-full resize-y rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 font-mono text-xs leading-5" /></label></div><fieldset><legend className="text-xs font-medium text-[var(--projects-muted)]">Tools</legend><div className="mt-2 flex flex-wrap gap-2">{tools.map((tool) => <label key={tool} className="inline-flex items-center gap-2 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-xs"><input type="checkbox" checked={selectedTools.includes(tool)} onChange={(event) => setSelectedTools((current) => event.target.checked ? [...new Set([...current, tool])] : current.filter((item) => item !== tool))} disabled={createPending} className="accent-[var(--projects-accent)]" />{tool}</label>)}</div></fieldset><div className="flex justify-end gap-2 border-t border-[var(--projects-divider)] pt-4"><button type="button" onClick={() => setCreateOpen(false)} disabled={createPending} className="h-9 rounded-lg border border-[var(--projects-border)] px-3 text-sm">Cancel</button><button type="submit" disabled={createPending || !projects.length} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-sm font-semibold text-white disabled:opacity-60">{createPending ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}{createPending ? "Creating…" : "Create agent"}</button></div></form></div></div> : null}
  </section>;
}

function Summary({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "warning" | "accent" }) {
  const valueClass = tone === "warning" ? "text-[var(--projects-warning)]" : tone === "accent" ? "text-[var(--projects-accent)]" : "text-[var(--projects-text)]";
  return <article className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-4 py-3"><p className="m-0 text-xs text-[var(--projects-muted)]">{label}</p><p className={`m-0 mt-1 font-mono text-2xl font-semibold ${valueClass}`}>{value}</p></article>;
}
