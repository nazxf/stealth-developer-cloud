import { notFound, redirect } from "next/navigation";
import { StealthAPIError, stealthAPI, type FunctionDeployment, type ProjectFunction, type ProjectSite, type SiteDeployment } from "@/lib/stealth-api";
import { ProjectDeployments } from "./project-deployments";
import type { DeploymentOverviewRecord, DeploymentResource } from "./project-deployment-types";

function resourceHref(projectId: string, type: "function" | "site", resourceId: string) {
  return `/projects/${encodeURIComponent(projectId)}/${type === "function" ? "functions" : "sites"}`;
}

function apiPath(projectId: string, type: "function" | "site", resourceId: string) {
  return `/api/stealth/projects/${encodeURIComponent(projectId)}/${type === "function" ? "functions" : "sites"}/${encodeURIComponent(resourceId)}/deployments`;
}

function functionRecord(projectId: string, resource: ProjectFunction, deployment: FunctionDeployment): DeploymentOverviewRecord {
  return {
    id: deployment.id,
    resourceId: resource.id,
    resourceName: resource.name,
    resourceType: "function",
    resourceHref: resourceHref(projectId, "function", resource.id),
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

function siteRecord(projectId: string, resource: ProjectSite, deployment: SiteDeployment): DeploymentOverviewRecord {
  return {
    id: deployment.id,
    resourceId: resource.id,
    resourceName: resource.name,
    resourceType: "site",
    resourceHref: resourceHref(projectId, "site", resource.id),
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
  return [...items].sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt) || second.version - first.version);
}

export async function ProjectDeploymentsPage({ projectId }: { projectId: string }) {
  let functionsResponse;
  let sitesResponse;
  try {
    [functionsResponse, sitesResponse] = await Promise.all([
      stealthAPI.projectFunctions(projectId, { limit: 100 }),
      stealthAPI.projectSites(projectId, { limit: 100 }),
    ]);
  } catch (error) {
    if (error instanceof StealthAPIError && error.status === 401) redirect("/login");
    if (error instanceof StealthAPIError && error.status === 404) notFound();
    return <ErrorState />;
  }

  const resources: DeploymentResource[] = [
    ...functionsResponse.functions.map((resource) => ({ id: resource.id, name: resource.name, type: "function" as const, href: resourceHref(projectId, "function", resource.id), apiPath: apiPath(projectId, "function", resource.id), activeDeploymentId: resource.active_deployment_id ?? null })),
    ...sitesResponse.sites.map((resource) => ({ id: resource.id, name: resource.name, type: "site" as const, href: resourceHref(projectId, "site", resource.id), apiPath: apiPath(projectId, "site", resource.id), activeDeploymentId: resource.active_deployment_id ?? null })),
  ];

  const requests = [
    ...functionsResponse.functions.map(async (resource) => {
      const response = await stealthAPI.projectFunctionDeployments(projectId, resource.id, { limit: 50 });
      return response.deployments.map((deployment) => functionRecord(projectId, resource, deployment));
    }),
    ...sitesResponse.sites.map(async (resource) => {
      const response = await stealthAPI.projectSiteDeployments(projectId, resource.id, { limit: 50 });
      return response.deployments.map((deployment) => siteRecord(projectId, resource, deployment));
    }),
  ];
  const results = await Promise.allSettled(requests);
  const initialDeployments = sortDeployments(results.flatMap((result) => result.status === "fulfilled" ? result.value : []));

  return <ProjectDeployments projectId={projectId} resources={resources} initialDeployments={initialDeployments} initialCanManage={functionsResponse.can_manage || sitesResponse.can_manage} initialPartialFailure={results.some((result) => result.status === "rejected")} />;
}

function ErrorState() {
  return <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10"><div role="alert" className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-5 py-6"><p className="m-0 text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--projects-muted)]">Deployments</p><h1 className="m-0 mt-2 text-[22px] font-semibold text-[var(--projects-text)]">Unable to load deployments</h1><p className="m-0 mt-2 max-w-xl text-[14px] leading-6 text-[var(--projects-muted)]">The Stealth API did not return the project deployment control plane. Refresh the page and try again.</p></div></section>;
}
