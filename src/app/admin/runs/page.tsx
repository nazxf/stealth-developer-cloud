import { redirect } from "next/navigation";
import { RunsPage } from "@/features/admin/runs/runs-page";
import { adminRunFromRecord } from "@/features/admin/runs/admin-runs";
import { StealthAPIError, stealthAPI } from "@/lib/stealth-api";

export default async function Page() {
  try {
    const [{ agents }, { account }] = await Promise.all([
      stealthAPI.agents({ limit: 100 }),
      stealthAPI.currentAccount(),
    ]);
    const runResults = await Promise.allSettled(
      agents.map(async (agent) => ({
        agent,
        response: await stealthAPI.agentRuns(agent.id, { limit: 100 }),
      })),
    );
    if (runResults.some((result) => result.status === "rejected" && result.reason instanceof StealthAPIError && result.reason.status === 401)) {
      redirect("/login");
    }
    const runs = runResults.flatMap((result) => result.status === "fulfilled"
      ? result.value.response.runs.map((run) => adminRunFromRecord(run, result.value.agent, account.id, account.email))
      : []);
    const unavailableAgents = runResults.filter((result) => result.status === "rejected").length;
    return <RunsPage initialRuns={runs} agentCount={agents.length} unavailableAgents={unavailableAgents} />;
  } catch (error) {
    if (error instanceof StealthAPIError && error.status === 401) redirect("/login");
    return <main className="grid min-h-[60dvh] place-items-center px-6 text-center text-[13px] text-[var(--projects-muted)]">Unable to load agent runs. Please try again.</main>;
  }
}
