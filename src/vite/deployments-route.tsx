import { Link, useParams } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { GitBranch, RefreshCcw, Rocket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { browserAPI } from "@/lib/browser-api";
import { GitDeploymentForm, type GitDeployableResource } from "./git-deployment-form";
import { queryClient } from "./query-client";

type DeployableResource = GitDeployableResource;
type DeploymentRecord = {
  id: string;
  resourceID: string;
  resourceName: string;
  resourceType: DeployableResource["type"];
  version: number;
  source: string;
  sourceName: string | null;
  status: string;
  buildStatus: string;
  errorMessage: string | null;
  createdAt: string;
  activatedAt: string | null;
};

function LoadingState() {
  return <div className="grid min-h-[18rem] place-items-center rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] text-sm text-[var(--projects-muted)]" aria-live="polite">Loading deployments…</div>;
}

function ErrorState({ error }: { error: unknown }) {
  return <div role="alert" className="rounded-xl border border-[var(--projects-danger)]/40 bg-[var(--projects-card-bg)] p-6 text-sm text-[var(--projects-danger)]">{error instanceof Error ? error.message : "Unable to load deployments."}</div>;
}

function statusClass(status: string) {
  if (status === "active" || status === "ready") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "failed") return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  return "border-amber-500/30 bg-amber-500/10 text-amber-100";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
}

function normalizeDeployment(resource: DeployableResource, deployment: { id: string; version: number; source: string; source_name?: string | null; status: string; build_status: string; error_message?: string | null; created_at: string; activated_at?: string | null }): DeploymentRecord {
  return { id: deployment.id, resourceID: resource.id, resourceName: resource.name, resourceType: resource.type, version: deployment.version, source: deployment.source, sourceName: deployment.source_name ?? null, status: deployment.status, buildStatus: deployment.build_status, errorMessage: deployment.error_message ?? null, createdAt: deployment.created_at, activatedAt: deployment.activated_at ?? null };
}

export default function DeploymentsRoute() {
  const { projectId } = useParams({ from: "/projects/$projectId/deployments" });
  const functionsQuery = useQuery({ queryKey: ["project-functions", projectId], queryFn: () => browserAPI.projectFunctions(projectId) });
  const sitesQuery = useQuery({ queryKey: ["project-sites", projectId], queryFn: () => browserAPI.projectSites(projectId) });
  const resources = useMemo<DeployableResource[]>(() => [
    ...(functionsQuery.data?.functions ?? []).map((item) => ({ id: item.id, name: item.name, type: "function" as const, activeDeploymentID: item.active_deployment_id ?? null })),
    ...(sitesQuery.data?.sites ?? []).map((item) => ({ id: item.id, name: item.name, type: "site" as const, activeDeploymentID: item.active_deployment_id ?? null })),
  ], [functionsQuery.data?.functions, sitesQuery.data?.sites]);
  const deploymentQueries = useQueries({ queries: resources.map((resource) => ({ queryKey: ["deployments", projectId, resource.type, resource.id], queryFn: () => resource.type === "function" ? browserAPI.projectFunctionDeployments(projectId, resource.id) : browserAPI.projectSiteDeployments(projectId, resource.id), enabled: resources.length > 0 })) });
  const [createOpen, setCreateOpen] = useState(false);

  const deployments = useMemo(() => deploymentQueries.flatMap((query, index) => query.data?.deployments.map((item) => normalizeDeployment(resources[index], item)) ?? []).sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt) || second.version - first.version), [deploymentQueries, resources]);
  const partialFailure = deploymentQueries.some((query) => query.isError);
  const pending = deployments.some((item) => ["queued", "building"].includes(item.status) || ["queued", "running", "deferred"].includes(item.buildStatus));
  const canManage = Boolean(functionsQuery.data?.can_manage || sitesQuery.data?.can_manage);

  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ["deployments", projectId] });
    }, 2500);
    return () => window.clearInterval(timer);
  }, [pending, projectId]);

  if (functionsQuery.isPending || sitesQuery.isPending) return <LoadingState />;
  if (functionsQuery.error || sitesQuery.error) return <ErrorState error={functionsQuery.error ?? sitesQuery.error} />;

  return <section><Link to="/projects/$projectId" params={{ projectId }} className="text-sm text-[var(--projects-accent)] hover:underline">← Project overview</Link><header className="mt-5 flex flex-wrap items-end justify-between gap-5 border-b border-[var(--projects-border)] pb-6"><div><p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--projects-muted)]">Release control plane</p><h1 className="m-0 mt-2 text-3xl font-semibold tracking-[-0.04em]">Deployments</h1><p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-[var(--projects-muted)]">One timeline for immutable Site releases and Function builds. Status comes from the trusted workers.</p></div><button type="button" onClick={() => void queryClient.invalidateQueries({ queryKey: ["deployments", projectId] })} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-4 text-sm font-semibold hover:border-[var(--projects-border-hover)]"><RefreshCcw size={15} aria-hidden="true" />Refresh</button></header>{partialFailure ? <p className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100" role="status">Some deployment histories could not be loaded. Refresh to retry.</p> : null}<div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"><Summary label="Resources" value={resources.length} /><Summary label="Deployments" value={deployments.length} /><Summary label="Active" value={deployments.filter((item) => item.status === "active").length} tone="success" /><Summary label="In progress" value={deployments.filter((item) => ["queued", "building"].includes(item.status)).length} tone="warning" /></div>{createOpen ? <GitDeploymentForm projectId={projectId} resources={resources} canManage={canManage} onClose={() => setCreateOpen(false)} /> : null}<div className="mt-6 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm text-[var(--projects-muted)]"><Rocket size={16} className="text-[var(--projects-accent)]" aria-hidden="true" />{pending ? "Workers are processing releases…" : "Deployment history is current."}</div>{canManage ? <button type="button" onClick={() => setCreateOpen((value) => !value)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-4 text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)]"><GitBranch size={15} aria-hidden="true" />{createOpen ? "Close form" : "Deploy from Git"}</button> : null}</div><div className="mt-4 overflow-x-auto rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)]"><table className="w-full min-w-[720px] text-left text-sm"><caption className="sr-only">Recent deployment activity</caption><thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] text-xs uppercase tracking-[0.08em] text-[var(--projects-muted)]"><tr><th scope="col" className="px-4 py-3">Resource</th><th scope="col" className="px-4 py-3">Version</th><th scope="col" className="px-4 py-3">Status</th><th scope="col" className="px-4 py-3">Source</th><th scope="col" className="px-4 py-3">Created</th></tr></thead><tbody className="divide-y divide-[var(--projects-divider)]">{deployments.slice(0, 50).map((deployment) => <tr key={`${deployment.resourceType}-${deployment.id}`} className="hover:bg-[color-mix(in_srgb,var(--projects-text)_3%,transparent)]"><td className="px-4 py-3"><Link to={deployment.resourceType === "site" ? "/projects/$projectId/$resource" : "/projects/$projectId/$resource"} params={{ projectId, resource: deployment.resourceType === "site" ? "sites" : "functions" }} className="font-medium hover:text-[var(--projects-accent)]">{deployment.resourceName}</Link><span className="mt-0.5 block text-xs uppercase tracking-[0.06em] text-[var(--projects-muted)]">{deployment.resourceType}</span></td><td className="px-4 py-3 font-mono text-xs text-[var(--projects-muted)]">v{deployment.version}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-1"><span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusClass(deployment.status)}`}>{deployment.status}</span>{deployment.buildStatus !== deployment.status ? <span className={`rounded-full border px-2 py-1 text-xs ${statusClass(deployment.buildStatus)}`}>build {deployment.buildStatus}</span> : null}</div>{deployment.errorMessage ? <span className="mt-1 block max-w-[220px] truncate text-xs text-[var(--projects-danger)]" title={deployment.errorMessage}>{deployment.errorMessage}</span> : null}</td><td className="max-w-[190px] truncate px-4 py-3 text-[var(--projects-muted)]" title={deployment.sourceName ?? deployment.source}>{deployment.sourceName ?? deployment.source}</td><td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--projects-muted)]"><time dateTime={deployment.createdAt}>{formatDate(deployment.createdAt)}</time></td></tr>)}</tbody></table>{deployments.length === 0 ? <p className="m-0 p-10 text-center text-sm text-[var(--projects-muted)]">No deployments yet. Connect a Git repository to create your first release.</p> : null}</div></section>;
}

function Summary({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "success" | "warning" }) {
  const valueClass = tone === "success" ? "text-[var(--projects-accent)]" : tone === "warning" ? "text-[var(--projects-warning)]" : "text-[var(--projects-text)]";
  return <article className="rounded-lg border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-4 py-3"><p className="m-0 text-xs text-[var(--projects-muted)]">{label}</p><p className={`m-0 mt-1 font-mono text-2xl font-semibold ${valueClass}`}>{value}</p></article>;
}
