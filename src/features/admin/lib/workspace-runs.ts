import "server-only";

import { StealthAPIError, stealthAPI } from "@/lib/stealth-api";
import { adminRunFromRecord } from "../runs/admin-runs";
import type { AgentRun } from "../types/runs";

export type WorkspaceRunSnapshot = {
  runs: AgentRun[];
  agentCount: number;
  unavailableAgents: number;
};

/** Load recent durable Agent runs across the authenticated workspace. */
export async function loadWorkspaceRuns(): Promise<WorkspaceRunSnapshot> {
  const [{ agents }, { account }] = await Promise.all([
    stealthAPI.agents({ limit: 100 }),
    stealthAPI.currentAccount(),
  ]);
  const results = await Promise.allSettled(agents.map(async (agent) => ({
    agent,
    response: await stealthAPI.agentRuns(agent.id, { limit: 100 }),
  })));
  if (results.some((result) => result.status === "rejected" && result.reason instanceof StealthAPIError && result.reason.status === 401)) {
    throw new StealthAPIError(401, "unauthorized", "Console session is invalid");
  }
  const runs = results.flatMap((result) => result.status === "fulfilled"
    ? result.value.response.runs.map((run) => adminRunFromRecord(run, result.value.agent, account.id, account.email))
    : []);
  runs.sort((left, right) => Date.parse(right.queuedAt) - Date.parse(left.queuedAt));
  return {
    runs,
    agentCount: agents.length,
    unavailableAgents: results.filter((result) => result.status === "rejected").length,
  };
}
