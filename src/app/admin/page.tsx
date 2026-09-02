import { redirect } from "next/navigation";
import { AdminOverview } from "@/features/admin/overview/admin-overview";
import { loadWorkspaceUsage } from "@/features/admin/lib/workspace-usage";
import { loadWorkspaceRuns } from "@/features/admin/lib/workspace-runs";
import { loadWorkspaceIncidents } from "@/features/admin/lib/workspace-incidents";
import { StealthAPIError } from "@/lib/stealth-api";

export default async function Page() {
  try {
    const [snapshot, runs, incidents] = await Promise.all([loadWorkspaceUsage(), loadWorkspaceRuns(), loadWorkspaceIncidents()]);
    return <AdminOverview snapshot={snapshot} recentRuns={runs.runs} unavailableAgents={runs.unavailableAgents} recentIncidents={incidents.incidents} />;
  } catch (error) {
    if (error instanceof StealthAPIError && error.status === 401) redirect("/login");
    return <main className="grid min-h-[60dvh] place-items-center px-6 text-center text-[13px] text-[var(--projects-muted)]">Unable to load workspace telemetry. Please try again.</main>;
  }
}
