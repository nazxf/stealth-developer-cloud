"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Box, ExternalLink, FileArchive, GitBranch, LoaderCircle, Play, Plus, Save, Trash2, Upload } from "lucide-react";
import type { ProjectSite, SiteDeployment } from "@/lib/stealth-api";
import { SiteDomainsPanel } from "./site-domains-panel";
import { SiteGitDeployPanel } from "./site-git-deploy-panel";

type Props = {
  projectId: string;
  initialSites: ProjectSite[];
  initialNextCursor: string | null;
  initialCanManage: boolean;
};

type ErrorPayload = { error?: { message?: string } };

class SitesBridgeError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

async function bridgeJSON<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "include", headers: { accept: "application/json", ...init.headers } });
  const payload = await response.json().catch(() => null) as T | ErrorPayload | null;
  if (!response.ok) throw new SitesBridgeError(response.status, (payload as ErrorPayload | null)?.error?.message ?? "The Sites request could not be completed.");
  return payload as T;
}

function sitesPath(projectId: string, suffix = "") {
  return `/api/stealth/projects/${encodeURIComponent(projectId)}/sites${suffix}`;
}

function formatDate(value: string | null | undefined) {
  return value ? dateFormatter.format(new Date(value)) : "—";
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KiB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MiB`;
  return `${(value / 1024 ** 3).toFixed(2)} GiB`;
}

function statusClass(status: string) {
  if (status === "active") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "ready") return "border-sky-500/30 bg-sky-500/10 text-sky-200";
  if (status === "failed") return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  return "border-amber-500/30 bg-amber-500/10 text-amber-100";
}

export function ProjectSites({ projectId, initialSites, initialNextCursor, initialCanManage }: Props) {
  const [sites, setSites] = useState(initialSites);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [selectedID, setSelectedID] = useState(initialSites[0]?.id ?? "");
  const [deployments, setDeployments] = useState<SiteDeployment[]>([]);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingDeployments, setLoadingDeployments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [enabledDraft, setEnabledDraft] = useState(true);
  const [quotaDraft, setQuotaDraft] = useState("");
  const [source, setSource] = useState<File | null>(null);
  const [activateUpload, setActivateUpload] = useState(true);
  const [buildCommand, setBuildCommand] = useState("");
  const [buildRuntime, setBuildRuntime] = useState<"node-22" | "python-3.13" | "go-1.24">("node-22");
  const [outputDirectory, setOutputDirectory] = useState(".");

  const selected = sites.find((item) => item.id === selectedID) ?? null;

  useEffect(() => {
    if (!selectedID) { setDeployments([]); return; }
    let cancelled = false;
    setLoadingDeployments(true);
    void bridgeJSON<{ deployments: SiteDeployment[] }>(`${sitesPath(projectId, `/${selectedID}/deployments`)}?limit=50`)
      .then((result) => { if (!cancelled) setDeployments(result.deployments); })
      .catch((reason) => { if (!cancelled) report(reason, "Site deployments could not be loaded."); })
      .finally(() => { if (!cancelled) setLoadingDeployments(false); });
    return () => { cancelled = true; };
  }, [projectId, selectedID]);

  useEffect(() => {
    if (!selected) return;
    setNameDraft(selected.name);
    setEnabledDraft(selected.enabled);
    setQuotaDraft(String(selected.artifact_quota_bytes));
  }, [selected]);

  function report(reason: unknown, fallback: string) {
    if (reason instanceof SitesBridgeError && reason.status === 401) { window.location.assign("/login"); return; }
    setError(reason instanceof Error ? reason.message : fallback);
  }

  async function createSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !initialCanManage) return;
    setBusy(true); setError(null);
    try {
      const result = await bridgeJSON<{ site: ProjectSite }>(sitesPath(projectId), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: createName.trim(), framework: "static", enabled: true }) });
      setSites((current) => [result.site, ...current]);
      setSelectedID(result.site.id);
      setCreateName(""); setCreating(false);
    } catch (reason) { report(reason, "The site could not be created."); } finally { setBusy(false); }
  }

  async function loadMoreSites() {
    if (!nextCursor || busy) return;
    setBusy(true); setError(null);
    try {
      const result = await bridgeJSON<{ sites: ProjectSite[]; pagination: { next_cursor: string | null } }>(`${sitesPath(projectId)}?limit=20&cursor=${encodeURIComponent(nextCursor)}`);
      setSites((current) => [...current, ...result.sites]); setNextCursor(result.pagination.next_cursor);
    } catch (reason) { report(reason, "More sites could not be loaded."); } finally { setBusy(false); }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy || !initialCanManage) return;
    const quota = Number(quotaDraft);
    if (!Number.isSafeInteger(quota) || quota < Math.max(selected.artifact_used_bytes, selected.artifact_reserved_bytes) || quota < 1) { setError("Quota must be a whole number at least as large as current usage and pending builds."); return; }
    setBusy(true); setError(null);
    try {
      const result = await bridgeJSON<{ site: ProjectSite }>(sitesPath(projectId, `/${selected.id}`), { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: nameDraft.trim(), enabled: enabledDraft, artifact_quota_bytes: quota }) });
      setSites((current) => current.map((item) => item.id === result.site.id ? result.site : item));
    } catch (reason) { report(reason, "Site settings could not be saved."); } finally { setBusy(false); }
  }

  async function removeSite() {
    if (!selected || busy || !initialCanManage || !window.confirm(`Delete site ${selected.name} and all deployments? This cannot be undone.`)) return;
    setBusy(true); setError(null);
    try {
      await bridgeJSON<void>(sitesPath(projectId, `/${selected.id}`), { method: "DELETE" });
      setSites((current) => { const remaining = current.filter((item) => item.id !== selected.id); setSelectedID(remaining[0]?.id ?? ""); return remaining; });
    } catch (reason) { report(reason, "The site could not be deleted."); } finally { setBusy(false); }
  }

  async function uploadDeployment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !source || busy || !initialCanManage) return;
    setBusy(true); setError(null);
    try {
      const form = new FormData(); form.append("source", source, source.name); form.append("activate", String(activateUpload));
      if (buildCommand.trim()) { form.append("build_runtime", buildRuntime); form.append("build_command", buildCommand.trim()); form.append("output_directory", outputDirectory.trim() || "."); }
      const result = await bridgeJSON<{ deployment: SiteDeployment }>(sitesPath(projectId, `/${selected.id}/deployments`), { method: "POST", body: form });
      setDeployments((current) => [result.deployment, ...current.map((item) => result.deployment.status === "active" && item.status === "active" ? { ...item, status: "superseded" as const } : item)]);
      setSites((current) => current.map((item) => item.id === selected.id ? { ...item, artifact_used_bytes: item.artifact_used_bytes + result.deployment.size_bytes, artifact_reserved_bytes: item.artifact_reserved_bytes + (result.deployment.reserved_bytes ?? 0), active_deployment_id: result.deployment.status === "active" ? result.deployment.id : item.active_deployment_id } : item));
      setSource(null); setBuildCommand(""); setOutputDirectory(".");
      const input = event.currentTarget.elements.namedItem("source") as HTMLInputElement | null; if (input) input.value = "";
    } catch (reason) { report(reason, "The static deployment could not be uploaded."); } finally { setBusy(false); }
  }

  async function activateDeployment(deployment: SiteDeployment) {
    if (!selected || busy || !initialCanManage) return;
    setBusy(true); setError(null);
    try {
      const result = await bridgeJSON<{ site: ProjectSite; deployment: SiteDeployment }>(sitesPath(projectId, `/${selected.id}/deployments/${deployment.id}/activate`), { method: "POST" });
      setSites((current) => current.map((item) => item.id === result.site.id ? result.site : item));
      setDeployments((current) => current.map((item) => item.id === result.deployment.id ? result.deployment : item.status === "active" ? { ...item, status: "superseded" } : item));
    } catch (reason) { report(reason, "The deployment could not be activated."); } finally { setBusy(false); }
  }

  async function removeDeployment(deployment: SiteDeployment) {
    if (!selected || busy || !initialCanManage || deployment.status === "active" || !window.confirm(`Delete deployment ${deployment.id}?`)) return;
    setBusy(true); setError(null);
    try {
      await bridgeJSON<void>(sitesPath(projectId, `/${selected.id}/deployments/${deployment.id}`), { method: "DELETE" });
      setDeployments((current) => current.filter((item) => item.id !== deployment.id));
      setSites((current) => current.map((item) => item.id === selected.id ? { ...item, artifact_used_bytes: Math.max(0, item.artifact_used_bytes - deployment.size_bytes), artifact_reserved_bytes: Math.max(0, item.artifact_reserved_bytes - (deployment.reserved_bytes ?? 0)) } : item));
    } catch (reason) { report(reason, "The deployment could not be deleted."); } finally { setBusy(false); }
  }

  function handleGitDeployment(deployment: SiteDeployment) {
    setDeployments((current) => [deployment, ...current.map((item) => deployment.status === "active" && item.status === "active" ? { ...item, status: "superseded" as const } : item)]);
    setSites((current) => current.map((item) => item.id === deployment.site_id ? { ...item, artifact_reserved_bytes: item.artifact_reserved_bytes + (deployment.reserved_bytes ?? 0), active_deployment_id: deployment.status === "active" ? deployment.id : item.active_deployment_id } : item));
  }

  const previewURL = selected ? `/api/stealth/sites/${encodeURIComponent(selected.id)}` : "";

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--projects-border)] pb-6">
        <div><p className="m-0 font-mono text-[12px] text-[var(--projects-muted)]">project: {projectId}</p><h1 className="m-0 mt-2 text-[28px] font-semibold tracking-[-0.035em] text-[var(--projects-text)]">Sites</h1><p className="m-0 mt-2 max-w-3xl text-[14px] leading-6 text-[var(--projects-muted)]">Deploy pre-built static output, keep immutable versions, activate one release, and serve the active site from a public URL.</p></div>
        {initialCanManage ? <button type="button" onClick={() => setCreating((value) => !value)} className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[var(--projects-accent-border)] bg-[var(--projects-accent-strong)] px-4 text-[13px] font-semibold text-white"><Plus size={15} aria-hidden="true" />Create site</button> : <p className="m-0 rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[12px] text-[var(--projects-muted)]">Read-only project role</p>}
      </header>
      {error ? <div role="alert" className="mt-5 rounded-lg border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-100">{error}</div> : null}
      <div aria-live="polite" className="sr-only">{busy || loadingDeployments ? "Loading site data" : "Site data ready"}</div>
      {creating ? <form onSubmit={(event) => void createSite(event)} className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><label className="min-w-[240px] flex-1 text-[12px] text-[var(--projects-muted)]">Name (lowercase slug)<input autoFocus required minLength={2} maxLength={63} pattern="[a-z0-9][a-z0-9-]{1,62}" value={createName} onChange={(event) => setCreateName(event.target.value)} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[13px] text-[var(--projects-text)]" /></label><p className="m-0 max-w-xl flex-1 text-[12px] leading-5 text-[var(--projects-muted)]">Sites currently use the static framework. Upload the output directory as an archive containing a root <code>index.html</code>; the API never runs files from this archive.</p><button type="submit" disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--projects-accent-strong)] px-3 text-[12px] font-semibold text-white"><Plus size={13} aria-hidden="true" />Create</button></form> : null}
      <div className="mt-6 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-3"><div className="flex items-center justify-between px-2 pb-2"><p className="m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--projects-muted)]">Project sites</p><span className="font-mono text-[11px] text-[var(--projects-muted)]">{sites.length}</span></div>{sites.length ? <div className="space-y-1">{sites.map((site) => <button type="button" key={site.id} onClick={() => setSelectedID(site.id)} className={`w-full rounded-lg border px-3 py-3 text-left transition ${site.id === selectedID ? "border-[var(--projects-accent-border)] bg-[var(--projects-control)]" : "border-transparent hover:border-[var(--projects-border)] hover:bg-[var(--projects-control)]"}`}><span className="flex items-center justify-between gap-2"><span className="truncate text-[13px] font-semibold text-[var(--projects-text)]">{site.name}</span><span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusClass(site.status)}`}>{site.status}</span></span><span className="mt-1 block text-[11px] text-[var(--projects-muted)]">{formatBytes(site.artifact_used_bytes)} used · {site.active_deployment_id ? "published" : "no release"}</span></button>)}</div> : <div className="grid min-h-[190px] place-items-center px-3 text-center"><div><Box size={25} className="mx-auto text-[var(--projects-muted)]" aria-hidden="true" /><p className="m-0 mt-3 text-[13px] text-[var(--projects-muted)]">No sites yet.</p></div></div>}{nextCursor ? <button type="button" onClick={() => void loadMoreSites()} disabled={busy} className="mt-3 w-full rounded-md border border-[var(--projects-border)] px-3 py-2 text-[11px] text-[var(--projects-muted)]">Load more</button> : null}</aside>
        {selected ? <div className="min-w-0"><div className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="m-0 font-mono text-[11px] text-[var(--projects-muted)]">site: {selected.id}</p><h2 className="m-0 mt-1 text-[20px] font-semibold text-[var(--projects-text)]">{selected.name}</h2><p className="m-0 mt-1 text-[12px] text-[var(--projects-muted)]">Static framework · {formatBytes(selected.artifact_used_bytes)} of {formatBytes(selected.artifact_quota_bytes)} used</p></div><a href={previewURL} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--projects-border)] px-3 text-[12px] font-semibold text-[var(--projects-text)]"><ExternalLink size={13} aria-hidden="true" />Open public site</a></div><form onSubmit={(event) => void uploadDeployment(event)} className="mt-5 grid gap-3 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] p-3 md:grid-cols-[minmax(0,1fr)_auto_auto]"><label className="text-[11px] text-[var(--projects-muted)]">Site source archive<input name="source" required type="file" accept=".zip,.tar,.tar.gz,.tgz,application/zip,application/gzip,application/x-tar" onChange={(event) => setSource(event.target.files?.[0] ?? null)} className="mt-1 block w-full text-[12px] text-[var(--projects-text)] file:mr-3 file:rounded file:border-0 file:bg-[var(--projects-accent-strong)] file:px-2 file:py-1 file:text-[11px] file:font-semibold file:text-white" /></label><label className="min-w-[220px] text-[11px] text-[var(--projects-muted)]">Build command (optional)<input value={buildCommand} onChange={(event) => setBuildCommand(event.target.value)} placeholder="npm run build" maxLength={4000} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-3 py-2 text-[12px] text-[var(--projects-text)]" /></label><label className="text-[11px] text-[var(--projects-muted)]">Output directory<select value={outputDirectory} onChange={(event) => setOutputDirectory(event.target.value)} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-3 py-2 text-[12px] text-[var(--projects-text)]"><option value=".">.</option><option value="dist">dist</option><option value="build">build</option><option value="out">out</option></select></label><label className="text-[11px] text-[var(--projects-muted)]">Build runtime<select value={buildRuntime} onChange={(event) => setBuildRuntime(event.target.value as typeof buildRuntime)} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-3 py-2 text-[12px] text-[var(--projects-text)]"><option value="node-22">Node 22</option><option value="python-3.13">Python 3.13</option><option value="go-1.24">Go 1.24</option></select></label><label className="flex items-end gap-2 pb-2 text-[12px] text-[var(--projects-text)]"><input type="checkbox" checked={activateUpload} onChange={(event) => setActivateUpload(event.target.checked)} className="accent-[var(--projects-accent)]" />Activate</label><button type="submit" disabled={busy || !source || !initialCanManage} className="mt-auto inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--projects-accent-strong)] px-3 text-[12px] font-semibold text-white disabled:opacity-50"><Upload size={13} aria-hidden="true" />Deploy</button></form><p className="m-0 mt-2 text-[11px] leading-5 text-[var(--projects-muted)]">Leave Build command empty for a pre-built archive. With a command, the worker builds the source in a network-isolated container and publishes the selected output directory.</p></div><form onSubmit={(event) => void saveSettings(event)} className="mt-5 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><div className="flex flex-wrap items-end gap-3"><label className="min-w-[180px] flex-1 text-[11px] text-[var(--projects-muted)]">Name<input required minLength={2} maxLength={63} pattern="[a-z0-9][a-z0-9-]{1,62}" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} disabled={!initialCanManage || busy} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[12px] text-[var(--projects-text)]" /></label><label className="min-w-[180px] flex-1 text-[11px] text-[var(--projects-muted)]">Artifact quota (bytes)<input type="number" min={Math.max(selected.artifact_used_bytes, selected.artifact_reserved_bytes)} value={quotaDraft} onChange={(event) => setQuotaDraft(event.target.value)} disabled={!initialCanManage || busy} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[12px] text-[var(--projects-text)]" /></label><label className="flex items-center gap-2 pb-2 text-[12px] text-[var(--projects-text)]"><input type="checkbox" checked={enabledDraft} onChange={(event) => setEnabledDraft(event.target.checked)} disabled={!initialCanManage || busy} className="accent-[var(--projects-accent)]" />Site enabled</label>{initialCanManage ? <button type="submit" disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--projects-accent-strong)] px-3 text-[12px] font-semibold text-white"><Save size={13} aria-hidden="true" />Save</button> : null}</div>{initialCanManage ? <button type="button" onClick={() => void removeSite()} disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-md border border-rose-500/30 px-3 py-2 text-[12px] font-semibold text-rose-200"><Trash2 size={13} aria-hidden="true" />Delete site</button> : null}</form><div className="mt-5 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><div className="flex items-start gap-3"><FileArchive size={19} className="mt-0.5 text-[var(--projects-muted)]" aria-hidden="true" /><div><h3 className="m-0 text-[17px] font-semibold text-[var(--projects-text)]">Deployment history</h3><p className="m-0 mt-1 text-[12px] leading-5 text-[var(--projects-muted)]">Each source archive is immutable. Source builds show queued/running/failed states; only a succeeded active release is served.</p></div></div>{deployments.length ? <div className="mt-4 overflow-x-auto rounded-md border border-[var(--projects-border)]"><table className="w-full min-w-[720px] text-left text-[12px]"><caption className="sr-only">Deployments for {selected.name}</caption><thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] text-[11px] uppercase tracking-[0.08em] text-[var(--projects-muted)]"><tr><th scope="col" className="px-3 py-2">Version</th><th scope="col" className="px-3 py-2">Status</th><th scope="col" className="px-3 py-2">Published</th><th scope="col" className="px-3 py-2">Created</th><th scope="col" className="px-3 py-2 text-right">Actions</th></tr></thead><tbody className="divide-y divide-[var(--projects-divider)]">{deployments.map((deployment) => <tr key={deployment.id}><td className="px-3 py-2"><p className="m-0 font-mono text-[10px] text-[var(--projects-text)]">v{deployment.version} · {deployment.id}</p><p className="m-0 mt-1 max-w-[180px] truncate text-[10px] text-[var(--projects-muted)]">{deployment.source_name ?? deployment.source}{deployment.build_status !== "succeeded" ? ` · build ${deployment.build_status}` : ""}</p></td><td className="px-3 py-2"><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass(deployment.status)}`}>{deployment.status}</span></td><td className="px-3 py-2 text-[var(--projects-muted)]">{formatBytes(deployment.size_bytes)} · archive {formatBytes(deployment.archive_size_bytes)}</td><td className="px-3 py-2 text-[var(--projects-muted)]">{formatDate(deployment.created_at)}</td><td className="px-3 py-2 text-right">{initialCanManage && deployment.status === "ready" && deployment.build_status === "succeeded" ? <button type="button" onClick={() => void activateDeployment(deployment)} disabled={busy} className="mr-2 inline-flex items-center gap-1 rounded border border-emerald-500/30 px-2 py-1 text-[11px] text-emerald-200"><Play size={11} aria-hidden="true" />Activate</button> : null}{initialCanManage && deployment.status !== "active" ? <button type="button" onClick={() => void removeDeployment(deployment)} disabled={busy} aria-label={`Delete deployment ${deployment.id}`} className="rounded border border-rose-500/30 px-2 py-1 text-rose-200"><Trash2 size={12} aria-hidden="true" /></button> : null}</td></tr>)}</tbody></table></div> : <div className="mt-4 grid min-h-[180px] place-items-center rounded-md border border-dashed border-[var(--projects-border)] text-center"><div><FileArchive size={25} className="mx-auto text-[var(--projects-muted)]" aria-hidden="true" /><p className="m-0 mt-3 text-[13px] text-[var(--projects-muted)]">No deployments yet.</p></div></div>}</div></div> : <div className="grid min-h-[360px] place-items-center rounded-xl border border-dashed border-[var(--projects-border)] bg-[var(--projects-card-bg)] text-center"><div><Box size={30} className="mx-auto text-[var(--projects-muted)]" aria-hidden="true" /><h2 className="m-0 mt-4 text-[16px] font-semibold text-[var(--projects-text)]">Create a site to begin</h2><p className="m-0 mt-2 text-[13px] text-[var(--projects-muted)]">Pre-built or source deployments are immutable and served only after a successful activation.</p></div></div>}
      </div>
      {selected ? <SiteGitDeployPanel projectId={projectId} siteId={selected.id} canManage={initialCanManage} onCreated={handleGitDeployment} /> : null}
      {selected ? <SiteDomainsPanel projectId={projectId} siteId={selected.id} canManage={initialCanManage} /> : null}
      <div className="mt-5 flex items-start gap-3 rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-[12px] leading-5 text-sky-100"><LoaderCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /><p className="m-0"><strong>Static hosting boundary:</strong> archives are checked for traversal, duplicate entries, symlinks, special files, file count, expanded bytes, and a root <code>index.html</code>. The API serves files from the active immutable directory and never evaluates JavaScript or build commands.</p></div>
    </section>
  );
}
