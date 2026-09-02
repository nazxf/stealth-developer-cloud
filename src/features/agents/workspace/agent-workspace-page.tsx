"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { agentFromRecord } from "../agent-api";
import type { Agent, AgentRecord, AgentRun } from "../types";
import { AgentWorkspace } from "./agent-workspace";

type AgentWorkspacePageProps = {
  agentId: string;
  initialAgent: Agent;
  initialRuns: AgentRun[];
};

type ErrorPayload = { error?: { message?: string } };

async function updateAgent(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "PATCH",
    credentials: "include",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as { agent?: AgentRecord } & ErrorPayload;
  if (!response.ok || !payload.agent) {
    throw new Error(payload.error?.message ?? "The agent settings could not be saved.");
  }
  return payload.agent;
}

/** The workspace receives server-authorized Agent and run records. A queued
 * run remains queued until a trusted provider worker is available. */
export function AgentWorkspacePage({ agentId, initialAgent, initialRuns }: AgentWorkspacePageProps) {
  const [agent, setAgent] = useState<Agent | null>(initialAgent);

  useEffect(() => {
    setAgent(initialAgent);
  }, [initialAgent]);

  if (agent === null) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[var(--projects-bg)] px-4 text-center">
        <p className="m-0 text-[15px] font-semibold text-[var(--projects-text)]">Agent not found</p>
        <p className="m-0 text-[13px] text-[var(--projects-muted)]">This agent does not exist or was deleted.</p>
        <Link
          href="/agent"
          className="mt-1 inline-flex h-10 items-center rounded-[10px] border border-[var(--projects-border)] px-4 text-[13px] font-medium text-[var(--projects-text)] transition-colors hover:bg-white/[0.04]"
        >
          Back to agents
        </Link>
      </div>
    );
  }

  const handleAgentChange = async (next: Agent) => {
    const record = await updateAgent(`/api/stealth/agents/${encodeURIComponent(agentId)}`, {
      name: next.name,
      description: next.description,
      role: next.role,
      model: next.model,
      instructions: next.instructions ?? "",
      tools: next.tools,
    });
    setAgent(agentFromRecord(record));
  };

  return <AgentWorkspace agent={agent} initialRuns={initialRuns} onAgentChange={handleAgentChange} />;
}
