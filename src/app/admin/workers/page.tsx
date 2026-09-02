import { redirect } from "next/navigation";
import { WorkersPage } from "@/features/admin/workers/workers-page";
import { loadWorkspaceRuns } from "@/features/admin/lib/workspace-runs";
import { StealthAPIError } from "@/lib/stealth-api";

export default async function Page() {
  try {
    const snapshot = await loadWorkspaceRuns();
    return <WorkersPage initialRuns={snapshot.runs} agentCount={snapshot.agentCount} unavailableAgents={snapshot.unavailableAgents} />;
  } catch (error) {
    if (error instanceof StealthAPIError && error.status === 401) redirect("/login");
    return <main className="grid min-h-[60dvh] place-items-center px-6 text-center text-[13px] text-[var(--projects-muted)]">Unable to load the worker queue. Please try again.</main>;
  }
}
