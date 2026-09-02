import { redirect } from "next/navigation";
import { TracesPage } from "@/features/admin/traces/traces-page";
import { loadWorkspaceTraces } from "@/features/admin/lib/workspace-traces";
import { StealthAPIError } from "@/lib/stealth-api";

export default async function Page() {
  try {
    const snapshot = await loadWorkspaceTraces();
    return (
      <TracesPage
        initialTraces={snapshot.traces}
        organizationCount={snapshot.organizationCount}
        unavailableOrganizations={snapshot.unavailableOrganizations}
        truncatedOrganizations={snapshot.truncatedOrganizations}
      />
    );
  } catch (error) {
    if (error instanceof StealthAPIError && error.status === 401) redirect("/login");
    return <main className="grid min-h-[60dvh] place-items-center px-6 text-center text-[13px] text-[var(--projects-muted)]">Unable to load request traces. Please try again.</main>;
  }
}
