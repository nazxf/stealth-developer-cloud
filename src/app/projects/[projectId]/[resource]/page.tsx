import { notFound } from "next/navigation";
import { ProjectAuthPage } from "@/features/console/project-auth-page";
import { ProjectAPIKeysPage } from "@/features/console/project-api-keys-page";
import { ProjectDatabasesPage } from "@/features/console/project-databases-page";
import { ProjectFunctionsPage } from "@/features/console/project-functions-page";
import { ProjectDeploymentsPage } from "@/features/console/project-deployments-page";
import { ProjectStoragePage } from "@/features/console/project-storage-page";
import { ProjectSitesPage } from "@/features/console/project-sites-page";
import { ProjectWebhooksPage } from "@/features/console/project-webhooks-page";
import { ProjectMessagingPage } from "@/features/console/project-messaging-page";
import { ProjectRealtimePage } from "@/features/console/project-realtime-page";
import { ProjectUsagePage, usageRangeFromQuery } from "@/features/console/project-usage-page";
import { ProjectLogsPage } from "@/features/console/project-logs-page";
import { ProjectSettingsPage } from "@/features/console/project-settings-page";
import { isProjectResource, ProjectResourcePage } from "@/features/console/project-resource-page";

export default async function ProjectResourceRoute({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ projectId: string; resource: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}>) {
  const { projectId, resource } = await params;

  if (!isProjectResource(resource)) notFound();

  if (resource === "auth") return <ProjectAuthPage projectId={projectId} />;
  if (resource === "api-keys") return <ProjectAPIKeysPage projectId={projectId} />;
  if (resource === "databases") return <ProjectDatabasesPage projectId={projectId} />;
  if (resource === "storage") return <ProjectStoragePage projectId={projectId} />;
  if (resource === "functions") return <ProjectFunctionsPage projectId={projectId} />;
  if (resource === "sites") return <ProjectSitesPage projectId={projectId} />;
  if (resource === "deployments") return <ProjectDeploymentsPage projectId={projectId} />;
  if (resource === "webhooks") return <ProjectWebhooksPage projectId={projectId} />;
  if (resource === "messaging") return <ProjectMessagingPage projectId={projectId} />;
  if (resource === "realtime") return <ProjectRealtimePage projectId={projectId} />;
  if (resource === "usage") {
    const query = await searchParams;
    return <ProjectUsagePage projectId={projectId} rangeDays={usageRangeFromQuery(query.range)} />;
  }
  if (resource === "logs") return <ProjectLogsPage projectId={projectId} />;
  if (resource === "settings") return <ProjectSettingsPage projectId={projectId} />;

  return <ProjectResourcePage projectId={projectId} resource={resource} />;
}
