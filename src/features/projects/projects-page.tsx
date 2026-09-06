import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { Server } from "lucide-react";
import { useState } from "react";
import { browserAPI } from "@/lib/api/browser-api";
import { EmptyState, LoadingState } from "@/components/async-state";
import { ErrorState } from "@/components/error-state";
import { ProjectCreateForm } from "@/features/projects/project-create-form";
import { queryKeys } from "@/lib/query-keys";

/** Projects landing screen moved from the legacy manual route tree. */
export function ProjectsPage() {
  const organizationsQuery = useQuery({ queryKey: queryKeys.organizations(), queryFn: () => browserAPI.organizations({ limit: 100 }) });
  const [activeOrganizationID, setActiveOrganizationID] = useState<string>();
  const selectedOrganization = organizationsQuery.data?.organizations.find((organization) => organization.id === activeOrganizationID) ?? organizationsQuery.data?.organizations[0];
  const projectsQuery = useQuery({
    queryKey: queryKeys.projects(selectedOrganization?.id),
    queryFn: () => browserAPI.projects(selectedOrganization!.id, { limit: 100 }),
    enabled: Boolean(selectedOrganization),
  });

  if (organizationsQuery.isPending) return <LoadingState />;
  if (organizationsQuery.error) return <ErrorState error={organizationsQuery.error} />;
  if (!selectedOrganization) return <EmptyState title="No organizations yet" detail="Create an organization through the API to start a project." />;
  const organization = selectedOrganization;

  return (
    <section>
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-[var(--projects-border)] pb-6">
        <div><p className="m-0 text-xs font-medium uppercase tracking-[0.12em] text-[var(--projects-muted)]">Console</p><h1 className="m-0 mt-2 text-3xl font-semibold tracking-[-0.04em]">Projects</h1><p className="m-0 mt-2 text-sm text-[var(--projects-muted)]">Deploy and operate your services from one control plane.</p></div>
        <label className="text-sm text-[var(--projects-muted)]">Organization<select value={selectedOrganization.id} onChange={(event) => setActiveOrganizationID(event.target.value)} className="mt-1 block h-10 min-w-48 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm text-[var(--projects-text)]"><option value="" disabled>Select organization</option>{organizationsQuery.data?.organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </header>
      <ProjectCreateForm organizationID={organization.id} />
      {projectsQuery.isPending ? <div className="mt-6"><LoadingState label="Loading projects…" /></div> : projectsQuery.error ? <div className="mt-6"><ErrorState error={projectsQuery.error} /></div> : projectsQuery.data?.projects.length ? <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{projectsQuery.data.projects.map((project) => <Link key={project.id} to="/projects/$projectId" params={{ projectId: project.id }} className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5 transition-colors hover:border-[var(--projects-border-hover)]"><div className="flex items-center gap-3"><span className="inline-flex size-10 items-center justify-center rounded-lg border border-[var(--projects-border-hover)] bg-[var(--projects-control)] text-[var(--projects-accent)]"><Server size={18} aria-hidden="true" /></span><span className="min-w-0"><span className="block truncate font-semibold">{project.name}</span><span className="mt-1 block truncate text-xs text-[var(--projects-muted)]">{project.id}</span></span></div><p className="m-0 mt-5 text-xs text-[var(--projects-muted)]">Created {new Date(project.created_at).toLocaleDateString()}</p></Link>)}</div> : <EmptyState title="No projects in this organization" detail="Use the form above to create your first project." />}
    </section>
  );
}

/** Project overview moved from the legacy manual route tree. */
export function ProjectPage() {
  const { projectId } = useParams({ from: "/_console/projects/$projectId" });
  const projectQuery = useQuery({ queryKey: queryKeys.project(projectId), queryFn: () => browserAPI.project(projectId) });
  const usageQuery = useQuery({ queryKey: queryKeys.projectUsage(projectId), queryFn: () => browserAPI.projectUsage(projectId) });
  if (projectQuery.isPending) return <LoadingState label="Loading project…" />;
  if (projectQuery.error) return <ErrorState error={projectQuery.error} />;
  const project = projectQuery.data.project;
  if (usageQuery.isPending) return <section><ProjectHeader project={project} /><LoadingState label="Loading project usage…" /></section>;
  if (usageQuery.error) return <section><ProjectHeader project={project} /><ErrorState error={usageQuery.error} /></section>;
  const usage = usageQuery.data.usage;
  const resources = [
    ["auth", "Auth", usage.application_users],
    ["databases", "Databases", usage.database_count],
    ["storage", "Storage", usage.storage_file_count],
    ["functions", "Functions", usage.function_count],
    ["sites", "Sites", usage.site_count],
    ["webhooks", "Webhooks", usage.webhook_delivery_count_7d],
    ["usage", "Usage", null],
    ["logs", "Logs", null],
    ["messaging", "Messaging", null],
    ["realtime", "Realtime", null],
    ["api-keys", "API keys", null],
    ["settings", "Settings", null],
  ] as const;
  return <section><div className="flex flex-wrap items-end justify-between gap-4"><ProjectHeader project={project} /><Link to="/projects/$projectId/deployments" params={{ projectId }} className="inline-flex h-10 items-center rounded-lg border border-[var(--projects-accent-border)] bg-[var(--projects-accent-strong)] px-4 text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)]">Open deployments</Link></div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{resources.map(([resource, label, count]) => <Link key={resource} to={resource === "messaging" ? "/projects/$projectId/messaging" : resource === "api-keys" ? "/projects/$projectId/api-keys" : resource === "auth" ? "/projects/$projectId/auth" : resource === "webhooks" ? "/projects/$projectId/webhooks" : resource === "realtime" ? "/projects/$projectId/realtime" : resource === "settings" ? "/projects/$projectId/settings" : resource === "usage" ? "/projects/$projectId/usage" : resource === "logs" ? "/projects/$projectId/logs" : resource === "databases" ? "/projects/$projectId/databases" : resource === "storage" ? "/projects/$projectId/storage" : resource === "functions" ? "/projects/$projectId/functions" : "/projects/$projectId/$resource"} params={{ projectId, resource }} className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5 transition-colors hover:border-[var(--projects-border-hover)]"><p className="m-0 text-xs uppercase tracking-[0.1em] text-[var(--projects-muted)]">{label}</p><p className="m-0 mt-2 font-mono text-2xl font-semibold">{count === null ? "—" : count.toLocaleString()}</p><span className="mt-3 inline-block text-xs text-[var(--projects-accent)]">Open resource →</span></Link>)}</div><div className="mt-6 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-6"><h2 className="m-0 text-lg font-semibold">Project control plane</h2><p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-[var(--projects-muted)]">Usage is read from the Go API while each resource route is progressively moved to TanStack Query. No project data is stored in browser localStorage.</p></div></section>;
}

/** Generic project-resource screen retained for resources without a dedicated view. */
export function ProjectResourcePage() {
  const { projectId, resource } = useParams({ from: "/_console/projects/$projectId/$resource" });
  const projectQuery = useQuery({ queryKey: queryKeys.project(projectId), queryFn: () => browserAPI.project(projectId) });
  const resourceQuery = useQuery({ queryKey: queryKeys.projectResource(projectId, resource), queryFn: () => browserAPI.projectResource(projectId, resource) });
  if (projectQuery.isPending || resourceQuery.isPending) return <LoadingState label="Loading resource…" />;
  if (projectQuery.error) return <ErrorState error={projectQuery.error} />;
  if (resourceQuery.error) return <ErrorState error={resourceQuery.error} />;
  const payload = resourceQuery.data as Record<string, unknown>;
  const collectionKey = Object.keys(payload).find((key) => Array.isArray(payload[key]));
  const items = collectionKey && Array.isArray(payload[collectionKey]) ? payload[collectionKey] : [];
  return <section><ProjectHeader project={projectQuery.data.project} /><div className="mt-6 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="m-0 text-xs uppercase tracking-[0.1em] text-[var(--projects-muted)]">Resource</p><h2 className="m-0 mt-2 text-2xl font-semibold capitalize">{resource.replaceAll("-", " ")}</h2></div><span className="rounded-full border border-[var(--projects-border)] px-3 py-1 text-xs text-[var(--projects-muted)]">{items.length} loaded</span></div>{items.length ? <div className="mt-6 divide-y divide-[var(--projects-divider)]">{items.slice(0, 12).map((item, index) => <div key={typeof item === "object" && item !== null && "id" in item ? String(item.id) : String(index)} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span>{typeof item === "object" && item !== null && "name" in item ? String(item.name) : `Item ${index + 1}`}</span><span className="font-mono text-xs text-[var(--projects-muted)]">{typeof item === "object" && item !== null && "status" in item ? String(item.status) : "managed"}</span></div>)}</div> : <p className="m-0 mt-6 rounded-lg border border-dashed border-[var(--projects-border)] p-8 text-center text-sm text-[var(--projects-muted)]">No {resource.replaceAll("-", " ")} records yet.</p>}</div></section>;
}

function ProjectHeader({ project }: { project: { name: string; id: string } }) {
  return <><Link to="/" className="text-sm text-[var(--projects-accent)] hover:underline">← All projects</Link><header className="mt-5 border-b border-[var(--projects-border)] pb-6"><p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--projects-muted)]">Project</p><h1 className="m-0 mt-2 text-3xl font-semibold tracking-[-0.04em]">{project.name}</h1><p className="m-0 mt-2 font-mono text-xs text-[var(--projects-muted)]">{project.id}</p></header></>;
}
