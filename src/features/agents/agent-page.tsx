"use client";

import { useMemo, useState } from "react";
import { AgentHeader } from "./components/agent-header";
import { AgentList } from "./components/agent-list";
import { AgentSummary } from "./components/agent-summary";
import { AgentToolbar, type AgentSort, type RoleFilter, type StatusFilter } from "./components/agent-toolbar";
import { CreateAgentDialog } from "./components/create-agent-dialog";
import { agentFromRecord } from "./agent-api";
import type { Agent, AgentCreateDraft, AgentRecord } from "./types";

type AgentPageProps = {
  initialAgents: Agent[];
  projects: Array<{ id: string; name: string }>;
};

type BridgeErrorPayload = { error?: { code?: string; message?: string } };

class AgentBridgeError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function bridgeJSON<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { accept: "application/json", ...init.headers },
  });
  const payload = (await response.json().catch(() => null)) as T | BridgeErrorPayload | null;
  if (!response.ok) {
    const error = payload as BridgeErrorPayload | null;
    throw new AgentBridgeError(response.status, error?.error?.message ?? "The agent request could not be completed.");
  }
  return payload as T;
}

function mutationError(reason: unknown, fallback: string) {
  if (reason instanceof AgentBridgeError && reason.status === 403) {
    return "Only project owners and admins can manage agents.";
  }
  if (reason instanceof AgentBridgeError && reason.status === 401) {
    return "Your Console session has expired. Sign in again to manage agents.";
  }
  return reason instanceof Error ? reason.message : fallback;
}

export function AgentPage({ initialAgents, projects }: AgentPageProps) {
  const [agentList, setAgentList] = useState<Agent[]>(initialAgents);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sort, setSort] = useState<AgentSort>("recent");
  const [createOpen, setCreateOpen] = useState(false);
  const [mutationPending, setMutationPending] = useState(false);
  const [deletingID, setDeletingID] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibleAgents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = agentList.filter((agent) => {
      const matchesQuery =
        !normalizedQuery ||
        [agent.name, agent.description, agent.role, agent.project, agent.model].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        );
      const matchesStatus = statusFilter === "all" || agent.status === statusFilter;
      const matchesRole = roleFilter === "all" || agent.role === roleFilter;
      return matchesQuery && matchesStatus && matchesRole;
    });

    return filtered.toSorted((first, second) =>
      sort === "name"
        ? first.name.localeCompare(second.name)
        : first.lastActiveMinutes - second.lastActiveMinutes,
    );
  }, [agentList, query, statusFilter, roleFilter, sort]);

  const handleDelete = async (id: string) => {
    if (deletingID) return;
    setDeletingID(id);
    setError(null);
    try {
      await bridgeJSON<void>(`/api/stealth/agents/${encodeURIComponent(id)}`, { method: "DELETE" });
      setAgentList((prev) => prev.filter((agent) => agent.id !== id));
    } catch (reason) {
      if (reason instanceof AgentBridgeError && reason.status === 401) {
        window.location.assign("/login");
        return;
      }
      setError(mutationError(reason, "The agent could not be deleted."));
    } finally {
      setDeletingID(null);
    }
  };

  const handleCreate = async (draft: AgentCreateDraft) => {
    if (mutationPending) return;
    setMutationPending(true);
    setError(null);
    try {
      const response = await bridgeJSON<{ agent: AgentRecord }>("/api/stealth/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: draft.projectId,
          name: draft.name,
          description: draft.description,
          role: draft.role,
          provider: draft.provider,
          model: draft.model,
          branch: draft.branch,
          instructions: draft.instructions,
          tools: draft.tools,
        }),
      });
      setAgentList((prev) => [agentFromRecord(response.agent), ...prev]);
      setCreateOpen(false);
    } catch (reason) {
      if (reason instanceof AgentBridgeError && reason.status === 401) {
        window.location.assign("/login");
        return;
      }
      setError(mutationError(reason, "The agent could not be created."));
    } finally {
      setMutationPending(false);
    }
  };

  return (
    <section className="min-h-dvh bg-[var(--projects-bg)] px-4 pb-12 pt-14 sm:px-6 lg:px-7">
      <div className="mx-auto w-full max-w-[1440px]">
        <AgentHeader count={agentList.length} onNewAgent={() => { setError(null); setCreateOpen(true); }} />

        {error && (
          <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-md border border-[var(--projects-danger)]/30 bg-[var(--projects-danger)]/10 px-3.5 py-3 text-[13px] text-[var(--projects-danger)]">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="shrink-0 text-xs underline underline-offset-2">Dismiss</button>
          </div>
        )}

        <AgentSummary agents={agentList} />

        <AgentToolbar
          query={query}
          status={statusFilter}
          role={roleFilter}
          sort={sort}
          onQueryChange={setQuery}
          onStatusChange={setStatusFilter}
          onRoleChange={setRoleFilter}
          onSortChange={setSort}
        />

        <AgentList agents={visibleAgents} onDelete={handleDelete} />
      </div>

      <CreateAgentDialog
        open={createOpen}
        onClose={() => { if (!mutationPending) setCreateOpen(false); }}
        projects={projects}
        pending={mutationPending}
        onCreate={handleCreate}
      />
    </section>
  );
}
