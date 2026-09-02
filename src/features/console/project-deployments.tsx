"use client";

import Link from "next/link";
import { CheckCircle2, ExternalLink, GitBranch, LoaderCircle, RefreshCcw, Rocket, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { DeploymentOverviewRecord, DeploymentResource } from "./project-deployment-types";

type Props = {
  projectId: string;
  resources: DeploymentResource[];
  initialDeployments: DeploymentOverviewRecord[];
  initialCanManage: boolean;
  initialPartialFailure: boolean;
};

type ErrorPayload = { error?: { message?: string } };

class DeploymentsBridgeError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

type WireDeployment = {
  id: string;
  version: number;
  source: string;
  source_name?: string;
  status: string;
  build_status: string;
  error_message?: string;
  created_at: string;
  activated_at?: string;
};

async function bridgeJSON<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { accept: "application/json", ...init.headers },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as T | ErrorPayload | null;
  if (!response.ok) {
    throw new DeploymentsBridgeError(response.status, (payload as ErrorPayload | null)?.error?.message ?? "Deployments could not be loaded.");
  }
  return payload as T;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

function formatDate(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : "—";
}

function isPending(deployment: DeploymentOverviewRecord) {
  return deployment.status === "queued" || deployment.status === "building" || deployment.buildStatus === "queued" || deployment.buildStatus === "running";
}

function statusTone(status: string) {
  if (status === "active" || status === "succeeded") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "ready") return "border-sky-500/30 bg-sky-500/10 text-sky-200";
  if (status === "failed") return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  return "border-amber-500/30 bg-amber-500/10 text-amber-100";
}

function deploymentFromWire(resource: DeploymentResource, deployment: WireDeployment): DeploymentOverviewRecord {
  return {
    id: deployment.id,
    resourceId: resource.id,
    resourceName: resource.name,
    resourceType: resource.type,
    resourceHref: resource.href,
    version: deployment.version,
    source: deployment.source,
    sourceName: deployment.source_name ?? null,
    status: deployment.status,
    buildStatus: deployment.build_status,
    errorMessage: deployment.error_message ?? null,
    createdAt: deployment.created_at,
    activatedAt: deployment.activated_at ?? null,
  };
}

function sortDeployments(items: DeploymentOverviewRecord[]) {
  return [...items].sort((first, second) => {
    const timestamp = Date.parse(second.createdAt) - Date.parse(first.createdAt);
    return timestamp || second.version - first.version;
  });
}

export function ProjectDeployments({ projectId, resources, initialDeployments, initialCanManage, initialPartialFailure }: Props) {
  const [resourceList, setResourceList] = useState(() => resources);
  const [deployments, setDeployments] = useState(() => sortDeployments(initialDeployments));
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(initialPartialFailure ? "Some deployment histories could not be loaded. Refresh to retry." : null);

  const refresh = useCallback(async () => {
    if (refreshing || resourceList.length === 0) return;
    setRefreshing(true);
    setError(null);
    try {
      const results = await Promise.all(resourceList.map(async (resource) => {
        const response = await bridgeJSON<{ deployments: WireDeployment[] }>(`${resource.apiPath}?limit=50`);
        return response.deployments.map((deployment) => deploymentFromWire(resource, deployment));
      }));
      setDeployments(sortDeployments(results.flat()));
    } catch (reason) {
      if (reason instanceof DeploymentsBridgeError && reason.status === 401) {
        window.location.assign("/login");
        return;
      }
      setError(reason instanceof Error ? reason.message : "Deployments could not be loaded.");
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, resourceList]);

  const hasPending = deployments.some(isPending);
  useEffect(() => {
    if (!hasPending) return;
    const interval = window.setInterval(() => void refresh(), 2500);
    return () => window.clearInterval(interval);
  }, [hasPending, refresh]);

  const latestByResource = useMemo(() => {
    const latest = new Map<string, DeploymentOverviewRecord>();
    for (const deployment of deployments) {
      if (!latest.has(deployment.resourceId)) latest.set(deployment.resourceId, deployment);
    }
    return latest;
  }, [deployments]);

  const activeCount = deployments.filter((deployment) => deployment.status === "active").length;
  const pendingCount = deployments.filter(isPending).length;
  const failedCount = deployments.filter((deployment) => deployment.status === "failed" || deployment.buildStatus === "failed").length;

  const handleDeploymentCreated = useCallback((resource: DeploymentResource, deployment: DeploymentOverviewRecord) => {
    setResourceList((current) => current.some((item) => item.id === resource.id && item.type === resource.type) ? current.map((item) => item.id === resource.id && item.type === resource.type ? resource : item) : [resource, ...current]);
    setDeployments((current) => sortDeployments([deployment, ...current]));
    setCreateOpen(false);
  }, []);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--projects-border)] pb-6">
        <div>
          <p className="m-0 font-mono text-[12px] text-[var(--projects-muted)]">project: {projectId}</p>
          <h1 className="m-0 mt-2 text-[28px] font-semibold tracking-[-0.035em] text-[var(--projects-text)]">Deployments</h1>
          <p className="m-0 mt-2 max-w-3xl text-[14px] leading-6 text-[var(--projects-muted)]">One timeline for immutable Site releases and Function builds. Status comes directly from the deployment workers.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {initialCanManage ? <button type="button" onClick={() => { setError(null); setCreateOpen((value) => !value); }} className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[var(--projects-accent-strong)] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--projects-accent-hover)]"><GitBranch size={14} aria-hidden="true" />Deploy from Git</button> : null}
          <button type="button" onClick={() => void refresh()} disabled={refreshing || resourceList.length === 0} className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[var(--projects-border)] bg-[var(--projects-control)] px-4 text-[13px] font-semibold text-[var(--projects-text)] disabled:cursor-not-allowed disabled:opacity-60">
            <RefreshCcw size={14} className={refreshing ? "animate-spin" : undefined} aria-hidden="true" />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {error ? <div role="alert" className="mt-5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-100">{error}</div> : null}
      {createOpen ? <GitDeploymentForm projectId={projectId} resources={resourceList} canManage={initialCanManage} onCreated={handleDeploymentCreated} onCancel={() => setCreateOpen(false)} /> : null}
      <div aria-live="polite" className="sr-only">{refreshing ? "Refreshing deployment history" : hasPending ? "Waiting for deployment workers" : "Deployment history ready"}</div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile label="Resources" value={String(resourceList.length)} />
        <SummaryTile label="Deployments" value={String(deployments.length)} />
        <SummaryTile label="Active releases" value={String(activeCount)} tone="success" />
        <SummaryTile label="Needs attention" value={String(failedCount)} tone={failedCount ? "danger" : "neutral"} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--projects-divider)] px-4 py-3.5">
            <div>
              <h2 className="m-0 text-[16px] font-semibold text-[var(--projects-text)]">Recent activity</h2>
              <p className="m-0 mt-1 text-[12px] text-[var(--projects-muted)]">Newest versions across every deployable resource.</p>
            </div>
            {pendingCount ? <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-100"><LoaderCircle size={12} className="animate-spin" aria-hidden="true" />{pendingCount} in progress</span> : null}
          </div>
          {deployments.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[12px]">
                <caption className="sr-only">Recent project deployments</caption>
                <thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] text-[10px] uppercase tracking-[0.08em] text-[var(--projects-muted)]">
                  <tr><th scope="col" className="px-4 py-2.5">Resource</th><th scope="col" className="px-4 py-2.5">Version</th><th scope="col" className="px-4 py-2.5">Status</th><th scope="col" className="px-4 py-2.5">Source</th><th scope="col" className="px-4 py-2.5">Created</th></tr>
                </thead>
                <tbody className="divide-y divide-[var(--projects-divider)]">
                  {deployments.slice(0, 50).map((deployment) => (
                    <tr key={`${deployment.resourceType}-${deployment.id}`} className="hover:bg-[color-mix(in_srgb,var(--projects-text)_3%,transparent)]">
                      <td className="px-4 py-3"><Link href={deployment.resourceHref} className="font-medium text-[var(--projects-text)] hover:text-[var(--projects-accent)]">{deployment.resourceName}</Link><span className="mt-0.5 block text-[10px] uppercase tracking-[0.06em] text-[var(--projects-muted)]">{deployment.resourceType}</span></td>
                      <td className="px-4 py-3 font-mono text-[11px] text-[var(--projects-muted)]">v{deployment.version}<span className="mt-0.5 block text-[10px]">{deployment.id.slice(0, 8)}…</span></td>
                      <td className="px-4 py-3"><div className="flex flex-wrap gap-1"><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${statusTone(deployment.status)}`}>{deployment.status}</span>{deployment.buildStatus !== deployment.status ? <span className={`rounded-full border px-2 py-1 text-[10px] ${statusTone(deployment.buildStatus)}`}>build {deployment.buildStatus}</span> : null}</div>{deployment.errorMessage ? <span className="mt-1 block max-w-[220px] truncate text-[10px] text-rose-200" title={deployment.errorMessage}>{deployment.errorMessage}</span> : null}</td>
                      <td className="max-w-[190px] truncate px-4 py-3 text-[var(--projects-muted)]" title={deployment.sourceName ?? deployment.source}>{deployment.sourceName ?? deployment.source}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[var(--projects-muted)]"><time dateTime={deployment.createdAt}>{formatDate(deployment.createdAt)}</time></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyDeployments hasResources={resourceList.length > 0} canManage={initialCanManage} />
          )}
        </div>

        <aside className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-4">
          <div className="flex items-start justify-between gap-3"><div><h2 className="m-0 text-[16px] font-semibold text-[var(--projects-text)]">Deployable resources</h2><p className="m-0 mt-1 text-[12px] leading-5 text-[var(--projects-muted)]">Open a resource to upload source, configure variables, or activate a release.</p></div><Rocket size={18} className="shrink-0 text-[var(--projects-accent)]" aria-hidden="true" /></div>
          <ul className="m-0 mt-4 list-none divide-y divide-[var(--projects-divider)] p-0">
            {resourceList.length ? resourceList.map((resource) => {
              const latest = latestByResource.get(resource.id);
              return <li key={`${resource.type}-${resource.id}`} className="py-3 first:pt-0 last:pb-0"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><Link href={resource.href} className="block truncate text-[13px] font-semibold text-[var(--projects-text)] hover:text-[var(--projects-accent)]">{resource.name}</Link><span className="mt-0.5 block text-[10px] uppercase tracking-[0.06em] text-[var(--projects-muted)]">{resource.type}</span></div>{latest ? <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${statusTone(latest.status)}`}>{latest.status}</span> : <span className="shrink-0 text-[10px] text-[var(--projects-muted)]">No releases</span>}</div><div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-[var(--projects-muted)]"><span>{latest ? `v${latest.version} · ${formatDate(latest.createdAt)}` : resource.activeDeploymentId ? "Active release" : "Ready to deploy"}</span><Link href={resource.href} aria-label={`Open ${resource.name}`} className="inline-flex items-center gap-1 text-[var(--projects-accent)]">Open <ExternalLink size={11} aria-hidden="true" /></Link></div></li>;
            }) : <li className="py-6 text-center text-[12px] text-[var(--projects-muted)]">Create a Site or Function to see it here.</li>}
          </ul>
        </aside>
      </div>
    </section>
  );
}

const NEW_SITE = "__new_site__";
const siteNamePattern = /^[a-z0-9][a-z0-9-]{1,62}$/;

function siteCollectionPath(projectId: string) {
  return `/api/stealth/projects/${encodeURIComponent(projectId)}/sites`;
}

function siteDeploymentPath(projectId: string, siteId: string) {
  return `${siteCollectionPath(projectId)}/${encodeURIComponent(siteId)}/deployments/git`;
}

function siteResource(projectId: string, site: { id: string; name: string; active_deployment_id?: string }) : DeploymentResource {
  return {
    id: site.id,
    name: site.name,
    type: "site",
    href: `/projects/${encodeURIComponent(projectId)}/sites`,
    apiPath: `${siteCollectionPath(projectId)}/${encodeURIComponent(site.id)}/deployments`,
    activeDeploymentId: site.active_deployment_id ?? null,
  };
}

function GitDeploymentForm({ projectId, resources, canManage, onCreated, onCancel }: { projectId: string; resources: DeploymentResource[]; canManage: boolean; onCreated: (resource: DeploymentResource, deployment: DeploymentOverviewRecord) => void; onCancel: () => void }) {
  const sites = resources.filter((resource) => resource.type === "site");
  const [targetSiteId, setTargetSiteId] = useState(sites[0]?.id ?? NEW_SITE);
  const [siteName, setSiteName] = useState("");
  const [repository, setRepository] = useState("");
  const [ref, setRef] = useState("main");
  const [runtime, setRuntime] = useState<"node-22" | "python-3.13" | "go-1.24">("node-22");
  const [command, setCommand] = useState("npm run build");
  const [outputDirectory, setOutputDirectory] = useState("dist");
  const [activate, setActivate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || busy) return;
    if (!repository.trim() || !command.trim()) { setError("Repository and build command are required."); return; }
    setBusy(true);
    setError(null);
    try {
      let resource = sites.find((item) => item.id === targetSiteId) ?? null;
      if (!resource) {
        const normalizedName = siteName.trim().toLowerCase();
        if (!siteNamePattern.test(normalizedName)) { setError("Site name must use 2–63 lowercase letters, numbers, or hyphens."); setBusy(false); return; }
        const result = await bridgeJSON<{ site: { id: string; name: string; active_deployment_id?: string } }>(siteCollectionPath(projectId), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: normalizedName, framework: "static", enabled: true }) });
        resource = siteResource(projectId, result.site);
      }
      const result = await bridgeJSON<{ deployment: WireDeployment }>(siteDeploymentPath(projectId, resource.id), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repository: repository.trim(), ref: ref.trim() || "main", build_runtime: runtime, build_command: command.trim(), output_directory: outputDirectory.trim() || ".", activate }) });
      onCreated(resource, deploymentFromWire(resource, result.deployment));
    } catch (reason) {
      if (reason instanceof DeploymentsBridgeError && reason.status === 401) { window.location.assign("/login"); return; }
      setError(reason instanceof Error ? reason.message : "The Git deployment could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="mt-5 rounded-xl border border-[var(--projects-accent-border)] bg-[color-mix(in_srgb,var(--projects-accent)_5%,var(--projects-card-bg))] p-5"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><GitBranch size={17} className="text-[var(--projects-accent)]" aria-hidden="true" /><h2 className="m-0 text-[16px] font-semibold text-[var(--projects-text)]">Deploy a public Git repository</h2></div><p className="m-0 mt-1 max-w-2xl text-[12px] leading-5 text-[var(--projects-muted)]">The API fetches the repository, builds it in the isolated Site worker, and optionally activates the immutable release.</p></div><button type="button" onClick={onCancel} aria-label="Close Git deployment form" className="inline-flex size-8 items-center justify-center rounded-md text-[var(--projects-muted)] hover:bg-[color-mix(in_srgb,var(--projects-text)_6%,transparent)] hover:text-[var(--projects-text)]"><X size={16} aria-hidden="true" /></button></div>{error ? <div role="alert" className="mt-4 rounded-md border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-100">{error}</div> : null}<form onSubmit={(event) => void submit(event)} className="mt-4 grid gap-3 md:grid-cols-2"><label className="text-[11px] text-[var(--projects-muted)] md:col-span-2">Target Site<select value={targetSiteId} onChange={(event) => setTargetSiteId(event.target.value)} disabled={busy} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-3 py-2 text-[12px] text-[var(--projects-text)]"><option value={NEW_SITE}>Create a new Site</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>{targetSiteId === NEW_SITE ? <label className="text-[11px] text-[var(--projects-muted)]">New site name<input value={siteName} onChange={(event) => setSiteName(event.target.value)} disabled={busy} required placeholder="marketing-site" maxLength={63} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-3 py-2 text-[12px] text-[var(--projects-text)]" /></label> : <div className="hidden md:block" /> }<label className="text-[11px] text-[var(--projects-muted)]">Repository URL<input value={repository} onChange={(event) => setRepository(event.target.value)} disabled={busy} required placeholder="https://github.com/acme/site" maxLength={512} spellCheck={false} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-3 py-2 text-[12px] text-[var(--projects-text)]" /></label><label className="text-[11px] text-[var(--projects-muted)]">Branch or tag<input value={ref} onChange={(event) => setRef(event.target.value)} disabled={busy} placeholder="main" maxLength={256} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-3 py-2 text-[12px] text-[var(--projects-text)]" /></label><label className="text-[11px] text-[var(--projects-muted)]">Build command<input value={command} onChange={(event) => setCommand(event.target.value)} disabled={busy} required placeholder="npm run build" maxLength={4000} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-3 py-2 text-[12px] text-[var(--projects-text)]" /></label><label className="text-[11px] text-[var(--projects-muted)]">Output directory<select value={outputDirectory} onChange={(event) => setOutputDirectory(event.target.value)} disabled={busy} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-3 py-2 text-[12px] text-[var(--projects-text)]"><option value="dist">dist</option><option value="build">build</option><option value="out">out</option><option value=".">.</option></select></label><label className="text-[11px] text-[var(--projects-muted)]">Build runtime<select value={runtime} onChange={(event) => setRuntime(event.target.value as typeof runtime)} disabled={busy} className="mt-1 w-full rounded-md border border-[var(--projects-card-bg)] bg-[var(--projects-card-bg)] px-3 py-2 text-[12px] text-[var(--projects-text)]"><option value="node-22">Node 22</option><option value="python-3.13">Python 3.13</option><option value="go-1.24">Go 1.24</option></select></label><label className="flex items-center gap-2 self-end pb-2 text-[12px] text-[var(--projects-text)]"><input type="checkbox" checked={activate} onChange={(event) => setActivate(event.target.checked)} disabled={busy} className="accent-[var(--projects-accent)]" />Activate after a successful build</label><div className="flex justify-end gap-2 md:col-span-2"><button type="button" onClick={onCancel} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--projects-border)] px-3 text-[12px] font-semibold text-[var(--projects-text)]">Cancel</button><button type="submit" disabled={busy || !repository.trim() || !command.trim()} className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--projects-accent-strong)] px-3 text-[12px] font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : <GitBranch size={13} aria-hidden="true" />}{busy ? "Creating deployment…" : "Deploy repository"}</button></div></form></section>;
}

function SummaryTile({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "success" | "danger" }) {
  const color = tone === "success" ? "text-emerald-200" : tone === "danger" ? "text-rose-200" : "text-[var(--projects-text)]";
  return <article className="rounded-lg border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-3.5 py-3"><p className="m-0 text-[11px] text-[var(--projects-muted)]">{label}</p><p className={`m-0 mt-1 font-mono text-[20px] font-semibold ${color}`}>{value}</p></article>;
}

function EmptyDeployments({ hasResources, canManage }: { hasResources: boolean; canManage: boolean }) {
  return <div className="grid min-h-[260px] place-items-center px-6 py-12 text-center"><div className="max-w-sm"><span className="mx-auto flex size-11 items-center justify-center rounded-xl border border-[var(--projects-border)] bg-[var(--projects-control)] text-[var(--projects-accent)]"><CheckCircle2 size={20} aria-hidden="true" /></span><h3 className="m-0 mt-4 text-[15px] font-semibold text-[var(--projects-text)]">{hasResources ? "No deployments yet" : "Nothing to deploy yet"}</h3><p className="m-0 mt-2 text-[13px] leading-6 text-[var(--projects-muted)]">{hasResources ? "Upload a source archive or connect a Git repository from a Site or Function resource." : canManage ? "Create a Site for static hosting or a Function for server-side code, then return here to track releases." : "Ask a project owner or admin to create a Site or Function."}</p></div></div>;
}
