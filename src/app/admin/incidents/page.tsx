import { IncidentsPage } from "@/features/admin/incidents/incidents-page";
import { redirect } from "next/navigation";
import { loadWorkspaceIncidents } from "@/features/admin/lib/workspace-incidents";
import { StealthAPIError } from "@/lib/stealth-api";

export default async function Page() {
  try {
    const snapshot = await loadWorkspaceIncidents();
    return <IncidentsPage initialIncidents={snapshot.incidents} organizations={snapshot.organizations} organizationCount={snapshot.organizationCount} unavailableOrganizations={snapshot.unavailableOrganizations} />;
  } catch (error) {
    if (error instanceof StealthAPIError && error.status === 401) redirect("/login");
    return <main className="grid min-h-[60dvh] place-items-center px-6 text-center text-[13px] text-[var(--projects-muted)]">Unable to load organization incidents. Please try again.</main>;
  }
}
