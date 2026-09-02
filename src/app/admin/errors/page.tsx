import { redirect } from "next/navigation";
import { ErrorsPage } from "@/features/admin/errors/errors-page";
import { loadWorkspaceErrors } from "@/features/admin/lib/workspace-errors";
import { StealthAPIError } from "@/lib/stealth-api";

export default async function Page() {
  try {
    const snapshot = await loadWorkspaceErrors();
    return (
      <ErrorsPage
        initialGroups={snapshot.groups}
        failures={snapshot.failures}
        organizationCount={snapshot.organizationCount}
        projectCount={snapshot.projectCount}
        functionCount={snapshot.functionCount}
        unavailableOrganizations={snapshot.unavailableOrganizations}
        unavailableProjects={snapshot.unavailableProjects}
        unavailableFunctions={snapshot.unavailableFunctions}
      />
    );
  } catch (error) {
    if (error instanceof StealthAPIError && error.status === 401) redirect("/login");
    return <main className="grid min-h-[60dvh] place-items-center px-6 text-center text-[13px] text-[var(--projects-muted)]">Unable to load Function failures. Please try again.</main>;
  }
}
