"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  FileDiff,
  FolderGit2,
  GitBranch,
  ListChecks,
  LoaderCircle,
  MessageSquare,
  MoreVertical,
  Play,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { agentRunFromRecord } from "../agent-api";
import type { Agent, AgentRun, AgentRunRecord, WorkspaceMessage, WorkspaceTab } from "../types";
import { AgentStatusDot } from "../components/agent-status";
import { AgentChat } from "./agent-chat";
import { AgentComposer } from "./agent-composer";
import { AgentActivity } from "./agent-activity";
import { AgentSettings } from "./agent-settings";
import { AgentTasks } from "./agent-tasks";
import { ChangesSummary } from "./changes-summary";

const TABS: Array<{ id: WorkspaceTab; label: string; Icon: typeof MessageSquare }> = [
  { id: "chat", label: "Chat", Icon: MessageSquare },
  { id: "tasks", label: "Tasks", Icon: ListChecks },
  { id: "changes", label: "Changes", Icon: FileDiff },
  { id: "activity", label: "Activity", Icon: Activity },
  { id: "settings", label: "Settings", Icon: Settings2 },
];

type ErrorPayload = { error?: { message?: string } };

function formatRunTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function runMessage(run: AgentRun) {
  if (run.status === "queued") return "Run accepted and waiting for an execution worker.";
  if (run.status === "running") return "The execution worker is working on this request.";
  if (run.status === "failed") return run.errorMessage ?? "The run failed before producing a result.";
  if (run.status === "cancelled") return "This run was cancelled.";
  return run.outputText ?? "Run completed without a text response.";
}

function messagesFromRuns(runs: AgentRun[]): WorkspaceMessage[] {
  return [...runs].reverse().flatMap<WorkspaceMessage>((run) => [
    {
      id: `prompt-${run.id}`,
      role: "user",
      text: run.prompt,
      time: formatRunTime(run.createdAt),
    },
    {
      id: `run-${run.id}`,
      runId: run.id,
      role: "agent",
      text: runMessage(run),
      time: formatRunTime(run.updatedAt),
      status: run.status,
      steps: run.steps,
      changes: run.changes,
      errorMessage: run.errorMessage,
    },
  ]);
}

function isActiveRun(run: AgentRun) {
  return run.status === "queued" || run.status === "running";
}

async function readRunResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as { run?: AgentRunRecord } & ErrorPayload;
  if (!response.ok || !payload.run) {
    throw new Error(payload.error?.message ?? "The agent run request could not be completed.");
  }
  return payload.run;
}

export function AgentWorkspace({
  agent,
  initialRuns,
  onAgentChange,
}: {
  agent: Agent;
  initialRuns: AgentRun[];
  onAgentChange: (agent: Agent) => void | Promise<void>;
}) {
  const [tab, setTab] = useState<WorkspaceTab>("chat");
  const [runs, setRuns] = useState<AgentRun[]>(initialRuns);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRuns(initialRuns);
  }, [initialRuns]);

  const refreshRuns = useCallback(async () => {
    const response = await fetch(`/api/stealth/agents/${encodeURIComponent(agent.id)}/runs?limit=50`, {
      credentials: "include",
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as { runs?: AgentRunRecord[] } & ErrorPayload;
    if (!response.ok || !payload.runs) {
      throw new Error(payload.error?.message ?? "The agent runs could not be loaded.");
    }
    setRuns(payload.runs.map(agentRunFromRecord));
  }, [agent.id]);

  const hasActiveRuns = runs.some(isActiveRun);
  useEffect(() => {
    if (!hasActiveRuns) return;
    const timer = window.setInterval(() => {
      void refreshRuns().catch((reason) => {
        setError(reason instanceof Error ? reason.message : "The agent run status could not be refreshed.");
      });
    }, 4_000);
    return () => window.clearInterval(timer);
  }, [hasActiveRuns, refreshRuns]);

  const messages = useMemo(() => messagesFromRuns(runs), [runs]);

  const scrollToBottom = useCallback(() => {
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, []);

  useEffect(() => {
    if (tab === "chat") scrollToBottom();
  }, [messages, tab, scrollToBottom]);

  const startRun = useCallback(
    async (prompt: string) => {
      if (submitting || runs.some(isActiveRun)) return;
      setSubmitting(true);
      setError(null);
      try {
        const response = await fetch(`/api/stealth/agents/${encodeURIComponent(agent.id)}/runs`, {
          method: "POST",
          credentials: "include",
          headers: { accept: "application/json", "content-type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        const record = await readRunResponse(response);
        setRuns((previous) => [agentRunFromRecord(record), ...previous.filter((run) => run.id !== record.id)]);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "The agent run could not be created.");
      } finally {
        setSubmitting(false);
      }
    },
    [agent.id, runs, submitting],
  );

  const handleSend = (text: string) => {
    void startRun(text);
  };

  const handleRunAgent = () => {
    void startRun(agent.currentTask ? `Run the current task: ${agent.currentTask}` : "Inspect the project and suggest improvements.");
  };

  const cancelRun = useCallback(
    async (runId: string) => {
      if (cancellingId) return;
      setCancellingId(runId);
      setError(null);
      try {
        const response = await fetch(`/api/stealth/agents/${encodeURIComponent(agent.id)}/runs/${encodeURIComponent(runId)}/cancel`, {
          method: "POST",
          credentials: "include",
          headers: { accept: "application/json" },
        });
        const record = await readRunResponse(response);
        setRuns((previous) => previous.map((run) => (run.id === record.id ? agentRunFromRecord(record) : run)));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "The agent run could not be cancelled.");
      } finally {
        setCancellingId(null);
      }
    },
    [agent.id, cancellingId],
  );

  const latestChanges = runs.find((run) => run.changes && run.changes.length > 0);
  const activeRun = runs.find(isActiveRun);
  const isRunning = submitting || activeRun !== undefined;
  const runButtonLabel = submitting ? "Submitting…" : activeRun?.status === "queued" ? "Queued…" : isRunning ? "Running…" : "Run Agent";

  return (
    <div className="flex h-dvh flex-col bg-[var(--projects-bg)] text-[var(--projects-text)]">
      <div className="shrink-0 border-b border-[var(--projects-border)] px-4 pt-14 sm:px-6 lg:px-7 lg:pt-6">
        <Link
          href="/agent"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--projects-muted)] transition-colors hover:text-[var(--projects-text)]"
        >
          <ArrowLeft size={14} strokeWidth={1.8} aria-hidden="true" />
          Agents
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3 pb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="m-0 truncate text-[22px] font-semibold leading-7 tracking-[-0.02em]">{agent.name}</h1>
              <AgentStatusDot status={agent.status} withLabel />
            </div>
            <div className="projects-mono mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--projects-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <FolderGit2 size={12} strokeWidth={1.7} aria-hidden="true" />
                {agent.project}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <GitBranch size={12} strokeWidth={1.7} aria-hidden="true" />
                {agent.branch}
              </span>
            </div>
          </div>

          <div className="flex w-full shrink-0 items-center gap-2 lg:w-auto">
            <button
              type="button"
              onClick={handleRunAgent}
              disabled={isRunning}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-[var(--projects-accent-border)] bg-[var(--projects-accent-strong)] px-3.5 text-[13px] font-semibold leading-none text-white transition-colors hover:bg-[var(--projects-accent-hover)] disabled:cursor-default disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--projects-accent)]/70 lg:w-auto"
            >
              {isRunning ? <LoaderCircle size={14} strokeWidth={2} className="animate-spin" aria-hidden="true" /> : <Play size={14} strokeWidth={1.8} aria-hidden="true" />}
              {runButtonLabel}
            </button>

            <div className="relative" data-workspace-menu>
              <button
                type="button"
                aria-label="Workspace actions"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((prev) => !prev)}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-[var(--projects-border)] text-[var(--projects-muted)] transition-colors hover:bg-white/[0.05] hover:text-[var(--projects-text)]"
              >
                <MoreVertical size={15} strokeWidth={1.8} aria-hidden="true" />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-30 mt-1 w-40 rounded-[10px] border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-1 shadow-xl shadow-black/30"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setTab("settings");
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs leading-4 text-[var(--projects-text)] transition-colors hover:bg-[var(--projects-control)]"
                  >
                    <Settings2 size={13} strokeWidth={1.8} aria-hidden="true" />
                    Settings
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-3 rounded-md border border-[var(--projects-danger)]/30 bg-[var(--projects-danger)]/10 px-3 py-2 text-[12.5px] text-[var(--projects-danger)]">
            {error}
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto border-b border-[var(--projects-divider)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className={cn(
                  "relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-[13px] transition-colors",
                  active ? "font-medium text-[var(--projects-text)]" : "text-[var(--projects-muted)] hover:text-[var(--projects-text)]",
                )}
              >
                <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
                {label}
                {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--projects-accent)]" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {tab === "chat" && <AgentChat agent={agent} messages={messages} onReview={() => setTab("changes")} onCancel={cancelRun} />}
        {tab === "tasks" && <AgentTasks runs={runs} />}
        {tab === "changes" && (
          <div className="mx-auto w-full max-w-[760px] px-4 py-5 sm:px-6">
            {latestChanges ? (
              <>
                <ChangesSummary
                  changes={latestChanges.changes ?? []}
                  onReview={() => {
                    setTab("chat");
                    requestAnimationFrame(scrollToBottom);
                  }}
                />
                <p className="m-0 mt-3 text-[12px] leading-4 text-[var(--projects-muted)]">
                  Changes recorded by the execution worker for run {latestChanges.id.slice(0, 8)}.
                </p>
              </>
            ) : (
              <p className="m-0 text-[13.5px] text-[var(--projects-muted)]">No changes have been recorded yet.</p>
            )}
          </div>
        )}
        {tab === "activity" && <AgentActivity runs={runs} />}
        {tab === "settings" && <AgentSettings agent={agent} onAgentChange={onAgentChange} />}
      </div>

      {tab === "chat" && <AgentComposer model={agent.model} disabled={isRunning} onSend={handleSend} />}
    </div>
  );
}
