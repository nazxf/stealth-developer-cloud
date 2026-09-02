import { ProjectConsoleShell } from "@/features/console/project-console-shell";
import { notFound, redirect } from "next/navigation";
import { StealthAPIError, stealthAPI } from "@/lib/stealth-api";

export default async function ProjectLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}>) {
  const { projectId } = await params;

  try {
    const { project } = await stealthAPI.project(projectId);
    return <ProjectConsoleShell projectId={project.id} projectName={project.name} organizationID={project.organization_id}>{children}</ProjectConsoleShell>;
  } catch (error) {
    if (error instanceof StealthAPIError && error.status === 401) redirect("/login");
    notFound();
  }
}
