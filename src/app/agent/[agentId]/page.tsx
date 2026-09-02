import { ApplicationShell } from "@/components/application-shell";
import { agentFromRecord, agentRunFromRecord } from "@/features/agents/agent-api";
import { AgentWorkspacePage } from "@/features/agents/workspace/agent-workspace-page";
import type { AgentRun } from "@/features/agents/types";
import { StealthAPIError, stealthAPI } from "@/lib/stealth-api";
import { notFound, redirect } from "next/navigation";

export default async function AgentWorkspaceRoute({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  let agent;
  let runs: AgentRun[] = [];
  let accountEmail = "";
  try {
    const [agentResponse, runsResponse, accountResponse] = await Promise.all([stealthAPI.agent(agentId), stealthAPI.agentRuns(agentId, { limit: 50 }), stealthAPI.currentAccount()]);
    agent = agentFromRecord(agentResponse.agent);
    runs = runsResponse.runs.map(agentRunFromRecord);
    accountEmail = accountResponse.account.email;
  } catch (error) {
    if (error instanceof StealthAPIError && error.status === 401) redirect("/login");
    if (error instanceof StealthAPIError && error.status === 404) notFound();
    throw error;
  }
  return (
    <ApplicationShell accountEmail={accountEmail}>
      <AgentWorkspacePage agentId={agentId} initialAgent={agent} initialRuns={runs} />
    </ApplicationShell>
  );
}
