import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, Clipboard, LoaderCircle, Save, Settings2, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { browserAPI, browserAPIErrorMessage } from "@/lib/browser-api";
import { queryClient } from "./query-client";
import { queryKeys } from "./query-keys";
import { ErrorState as AsyncErrorState } from "./error-state";

function LoadingState() {
  return <div className="grid min-h-[18rem] place-items-center rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] text-sm text-[var(--projects-muted)]" aria-live="polite">Loading project settings…</div>;
}

function ErrorState({ error }: { error: unknown }) {
  return <AsyncErrorState error={error} fallback="Unable to load project settings." />;
}

export default function SettingsRoute() {
  const { projectId } = useParams({ from: "/projects/$projectId/settings" });
  const navigate = useNavigate();
  const projectQuery = useQuery({ queryKey: queryKeys.project(projectId), queryFn: () => browserAPI.project(projectId) });
  const [name, setName] = useState("");
  const [deleteName, setDeleteName] = useState("");
  const [pending, setPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [copied, setCopied] = useState<"project" | "organization" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { if (projectQuery.data) setName(projectQuery.data.project.name); }, [projectQuery.data]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const normalizedName = name.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(normalizedName)) { setError("Use 2–63 lowercase letters, numbers, or hyphens."); return; }
    setPending(true); setError(""); setMessage("");
    try {
      await browserAPI.updateProject(projectId, { name: normalizedName });
      await queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
      setMessage("Project settings saved.");
    } catch (requestError) {
      setError(browserAPIErrorMessage(requestError, "Project settings could not be saved."));
    } finally { setPending(false); }
  }

  async function removeProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (deletePending || !projectQuery.data || deleteName !== projectQuery.data.project.name) return;
    setDeletePending(true); setError("");
    try {
      await browserAPI.deleteProject(projectId, deleteName);
      await queryClient.clear();
      await navigate({ to: "/", replace: true });
    } catch (requestError) {
      setError(browserAPIErrorMessage(requestError, "Project could not be deleted."));
      setDeletePending(false);
    }
  }

  async function copyIdentifier(kind: "project" | "organization", value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(kind); window.setTimeout(() => setCopied(null), 1500); } catch { setError("Clipboard access was unavailable."); }
  }

  if (projectQuery.isPending) return <LoadingState />;
  if (projectQuery.error) return <ErrorState error={projectQuery.error} />;
  const project = projectQuery.data.project;

  return <section><Link to="/projects/$projectId" params={{ projectId }} className="text-sm text-[var(--projects-accent)] hover:underline">← Project overview</Link><header className="mt-5 flex items-start gap-3 border-b border-[var(--projects-border)] pb-6"><span className="inline-flex size-10 items-center justify-center rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] text-[var(--projects-accent)]"><Settings2 size={19} aria-hidden="true" /></span><div><p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--projects-muted)]">Project configuration</p><h1 className="m-0 mt-1 text-3xl font-semibold tracking-[-0.04em]">Settings</h1><p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-[var(--projects-muted)]">Manage the project name and stable identifiers. Resource-specific settings live in each service route.</p></div></header>{error ? <p role="alert" className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}{message ? <p role="status" className="mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</p> : null}<div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]"><form onSubmit={(event) => void save(event)} className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5" noValidate><h2 className="m-0 text-lg font-semibold">General settings</h2><label className="mt-5 block text-xs font-medium text-[var(--projects-muted)]" htmlFor="vite-project-name">Project name<input id="vite-project-name" required minLength={2} maxLength={63} pattern="[a-z0-9][a-z0-9-]{1,62}" value={name} onChange={(event) => setName(event.target.value)} disabled={pending} className="mt-1.5 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm outline-none focus:border-[var(--projects-accent)]" /></label><p className="m-0 mt-2 text-xs leading-5 text-[var(--projects-muted)]">Names are lowercase slugs used in URLs and deployment configuration.</p><button type="submit" disabled={pending} className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-4 text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)] disabled:opacity-60">{pending ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}{pending ? "Saving…" : "Save changes"}</button></form><aside className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><h2 className="m-0 text-lg font-semibold">Identifiers</h2><p className="m-0 mt-1 text-sm text-[var(--projects-muted)]">Stable IDs safe to use in deployment and client configuration.</p><Identifier label="Project ID" value={project.id} copied={copied === "project"} onCopy={() => void copyIdentifier("project", project.id)} /><Identifier label="Organization ID" value={project.organization_id} copied={copied === "organization"} onCopy={() => void copyIdentifier("organization", project.organization_id)} /><div className="flex items-center justify-between border-t border-[var(--projects-divider)] py-3 text-xs"><span className="text-[var(--projects-muted)]">Created</span><time dateTime={project.created_at} className="font-mono">{project.created_at.slice(0, 10)}</time></div></aside></div><details className="mt-5 rounded-xl border border-rose-400/30 bg-rose-400/[0.04]"><summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 focus-visible:ring-2 focus-visible:ring-[var(--projects-accent)]"><span className="inline-flex size-9 items-center justify-center rounded-lg border border-rose-400/30 bg-rose-400/10 text-rose-200"><AlertTriangle size={17} aria-hidden="true" /></span><span className="flex-1"><span className="block text-sm font-semibold text-rose-100">Danger zone</span><span className="mt-1 block text-xs text-rose-100/65">Permanently delete this project and its resources.</span></span><span className="text-xs font-semibold text-rose-200">Expand</span></summary><div className="border-t border-rose-400/20 px-5 py-5"><h2 className="m-0 text-sm font-semibold text-rose-100">Delete project</h2><p className="m-0 mt-2 max-w-2xl text-xs leading-5 text-rose-100/70">This action is irreversible. It removes database rows, API keys, identities, deployments, and stored artifacts.</p><form onSubmit={(event) => void removeProject(event)} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"><label className="min-w-0 flex-1 text-xs font-medium text-rose-100/75" htmlFor="vite-delete-project-name">Type <code className="rounded bg-black/20 px-1 font-mono text-rose-50">{project.name}</code> to confirm<input id="vite-delete-project-name" value={deleteName} onChange={(event) => setDeleteName(event.target.value)} disabled={deletePending} autoComplete="off" className="mt-1 block h-10 w-full rounded-lg border border-rose-400/30 bg-black/20 px-3 font-mono text-sm text-rose-50 outline-none focus:border-rose-300" placeholder={project.name} /></label><button type="submit" disabled={deletePending || deleteName !== project.name} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-rose-300/40 bg-rose-500/15 px-3.5 text-xs font-semibold text-rose-100 disabled:cursor-not-allowed disabled:opacity-45">{deletePending ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}{deletePending ? "Deleting…" : "Delete project"}</button></form></div></details></section>;
}

function Identifier({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return <div className="border-t border-[var(--projects-divider)] py-3"><div className="flex items-center justify-between gap-3"><span className="text-xs text-[var(--projects-muted)]">{label}</span><button type="button" onClick={onCopy} className="inline-flex items-center gap-1 text-[11px] text-[var(--projects-muted)] hover:text-[var(--projects-text)]">{copied ? <Check size={13} aria-hidden="true" /> : <Clipboard size={13} aria-hidden="true" />}{copied ? "Copied" : "Copy"}</button></div><code className="mt-1 block break-all font-mono text-[11px]">{value}</code></div>;
}
