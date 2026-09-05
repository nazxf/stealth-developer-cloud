import { useQueryClient, useQueries, useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { Activity, Boxes, Database, ExternalLink, FunctionSquare, Plus, Server } from "lucide-react";
import { Link, useParams } from "@tanstack/react-router";
import { browserAPI } from "@/lib/browser-api";
import { ServiceCanvas, type ServiceCanvasService } from "./service-canvas";
import { ErrorState as AsyncErrorState } from "./error-state";

type ServiceCard = ServiceCanvasService & {
  id: string;
};

const kindStyles: Record<ServiceCard["kind"], { label: string; icon: typeof Activity; color: string }> = {
  function: { label: "Function", icon: FunctionSquare, color: "text-violet-300" },
  site: { label: "Site", icon: Activity, color: "text-sky-300" },
  database: { label: "Database", icon: Database, color: "text-emerald-300" },
  storage: { label: "Storage bucket", icon: Boxes, color: "text-amber-300" },
};

export default function ServicesRoute() {
  const { projectId } = useParams({ from: "/projects/$projectId/services" });
  const queryClient = useQueryClient();
  const projectQuery = useQuery({ queryKey: ["project", projectId], queryFn: () => browserAPI.project(projectId) });
  const layoutQuery = useQuery({ queryKey: ["service-layout", projectId], queryFn: () => browserAPI.projectServiceLayout(projectId) });
  const resourceQueries = useQueries({
    queries: [
      { queryKey: ["service-functions", projectId], queryFn: () => browserAPI.projectFunctions(projectId, { limit: 100 }) },
      { queryKey: ["service-sites", projectId], queryFn: () => browserAPI.projectSites(projectId, { limit: 100 }) },
      { queryKey: ["service-databases", projectId], queryFn: () => browserAPI.projectDatabases(projectId, { limit: 100 }) },
      { queryKey: ["service-buckets", projectId], queryFn: () => browserAPI.projectStorageBuckets(projectId, { limit: 100 }) },
    ],
  });
  const services: ServiceCard[] = [
    ...(resourceQueries[0].data?.functions ?? []).map((item) => ({ id: item.id, kind: "function" as const, name: item.name, status: item.status, detail: item.runtime, resource: "functions" as const })),
    ...(resourceQueries[1].data?.sites ?? []).map((item) => ({ id: item.id, kind: "site" as const, name: item.name, status: item.status, detail: item.framework, resource: "sites" as const })),
    ...(resourceQueries[2].data?.databases ?? []).map((item) => ({ id: item.id, kind: "database" as const, name: item.name, status: "managed", detail: "PostgreSQL-compatible", resource: "databases" as const })),
    ...(resourceQueries[3].data?.buckets ?? []).map((item) => ({ id: item.id, kind: "storage" as const, name: item.name, status: "managed", detail: `${item.used_bytes.toLocaleString()} bytes used`, resource: "storage" as const })),
  ];
  const loading = projectQuery.isPending || layoutQuery.isPending || resourceQueries.some((query) => query.isPending);
  const error = projectQuery.error ?? layoutQuery.error ?? resourceQueries.find((query) => query.error)?.error;
  const canManage = layoutQuery.data?.can_manage ?? resourceQueries.some((query) => query.data?.can_manage);
  const saveLayout = useCallback(async (layout: Parameters<typeof browserAPI.replaceProjectServiceLayout>[1]) => {
    const saved = await browserAPI.replaceProjectServiceLayout(projectId, layout);
    queryClient.setQueryData(["service-layout", projectId], saved);
    return saved;
  }, [projectId, queryClient]);

  if (loading) return <StateCard title="Loading service workspace…" />;
  if (error) return <AsyncErrorState error={error} fallback="The Go API did not return service data." />;

  return <section><div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--projects-border)] pb-6"><div><Link to="/projects/$projectId" params={{ projectId }} className="text-sm text-[var(--projects-accent)] hover:underline">← Project overview</Link><p className="m-0 mt-5 text-xs uppercase tracking-[0.12em] text-[var(--projects-muted)]">Service workspace</p><h1 className="m-0 mt-2 text-3xl font-semibold tracking-[-0.04em]">{projectQuery.data?.project.name} services</h1><p className="m-0 mt-2 max-w-2xl text-sm text-[var(--projects-muted)]">A live inventory and canvas of deployable and managed resources. State comes from the Go control plane; positions are saved per project.</p></div><Link to="/projects/$projectId/functions" params={{ projectId }} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-4 text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)]"><Plus size={16} aria-hidden="true" />Create resource</Link></div><ServiceCanvas projectId={projectId} services={services} savedLayout={layoutQuery.data?.layout ?? []} canManage={Boolean(canManage)} onSave={saveLayout} /><div className="mt-6 flex items-center gap-2"><Server size={16} className="text-[var(--projects-muted)]" aria-hidden="true" /><h2 className="m-0 text-lg font-semibold">Resource inventory</h2></div><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{services.map((service) => <ServiceCardView key={`${service.kind}:${service.id}`} projectId={projectId} service={service} />)}</div>{services.length === 0 ? <div className="mt-6 rounded-xl border border-dashed border-[var(--projects-border)] p-12 text-center"><Server size={24} className="mx-auto text-[var(--projects-muted)]" aria-hidden="true" /><h2 className="m-0 mt-4 text-lg font-semibold">No services yet</h2><p className="m-0 mt-2 text-sm text-[var(--projects-muted)]">Create a Function, Site, Database, or Storage bucket to see it here.</p></div> : null}</section>;
}

function ServiceCardView({ projectId, service }: { projectId: string; service: ServiceCard }) {
  const style = kindStyles[service.kind];
  const Icon = style.icon;
  return <article className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5 transition-colors hover:border-[var(--projects-border-hover)]"><div className="flex items-start justify-between gap-3"><span className={`inline-flex size-10 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--projects-accent)_12%,transparent)] ${style.color}`}><Icon size={19} aria-hidden="true" /></span><span className={`rounded-full border px-2 py-1 text-[11px] ${service.status === "active" || service.status === "available" ? "border-[var(--projects-accent)]/40 text-[var(--projects-accent)]" : "border-[var(--projects-border)] text-[var(--projects-muted)]"}`}>{service.status}</span></div><p className="m-0 mt-4 text-xs uppercase tracking-[0.1em] text-[var(--projects-muted)]">{style.label}</p><h2 className="m-0 mt-1 truncate text-lg font-semibold">{service.name}</h2><p className="m-0 mt-2 text-sm text-[var(--projects-muted)]">{service.detail}</p><Link to={`/projects/$projectId/${service.resource}` as never} params={{ projectId } as never} className="mt-5 inline-flex items-center gap-1.5 text-xs text-[var(--projects-accent)] hover:underline">Open resource <ExternalLink size={13} aria-hidden="true" /></Link></article>;
}

function StateCard({ title, detail, error = false }: { title: string; detail?: string; error?: boolean }) {
  return <div className={`grid min-h-[18rem] place-items-center rounded-xl border bg-[var(--projects-card-bg)] p-8 text-center ${error ? "border-[var(--projects-danger)]/40" : "border-[var(--projects-border)]"}`} role={error ? "alert" : undefined}><div><p className="m-0 font-semibold">{title}</p>{detail ? <p className="m-0 mt-2 text-sm text-[var(--projects-muted)]">{detail}</p> : null}</div></div>;
}
