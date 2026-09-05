import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bot, CheckCircle2, Clock3, GitBranch, LoaderCircle, Square, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { browserAPI, browserAPIErrorMessage, type BrowserAgentRun } from "@/lib/browser-api";
import { AgentRunForm } from "./agent-run-form";
import { queryClient } from "./query-client";
import { queryKeys } from "./query-keys";
import { ErrorState as AsyncErrorState } from "./error-state";

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) : "—";
}

function statusIcon(status: BrowserAgentRun["status"]) {
  if (status === "completed") return <CheckCircle2 size={15} className="text-[var(--projects-accent)]" aria-hidden="true" />;
  if (status === "failed" || status === "cancelled") return <XCircle size={15} className="text-[var(--projects-danger)]" aria-hidden="true" />;
  if (status === "running") return <LoaderCircle size={15} className="animate-spin text-[var(--projects-warning)]" aria-hidden="true" />;
  return <Clock3 size={15} className="text-[var(--projects-muted)]" aria-hidden="true" />;
}

function LoadingState() {
  return <div className="grid min-h-[18rem] place-items-center rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] text-sm text-[var(--projects-muted)]" aria-live="polite">Loading agent…</div>;
}

function ErrorState({ error }: { error: unknown }) {
  return <AsyncErrorState error={error} fallback="Unable to load this agent." />;
}

export default function AgentDetailRoute() {
  const { agentId } = useParams({ from: "/agent/$agentId" });
  const agentQuery = useQuery({ queryKey: queryKeys.agent(agentId), queryFn: () => browserAPI.agent(agentId) });
  const runsQuery = useQuery({ queryKey: queryKeys.agentRuns(agentId), queryFn: () => browserAPI.agentRuns(agentId, { limit: 50 }) });
  const [selectedRunID, setSelectedRunID] = useState<string | null>(null);
  const [cancelPending, setCancelPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const selectedRun = runsQuery.data?.runs.find((run) => run.id === selectedRunID) ?? runsQuery.data?.runs[0];
  const logsQuery = useQuery({ queryKey: queryKeys.agentRunLogs(agentId, selectedRun?.id), queryFn: () => browserAPI.agentRunLogs(agentId, selectedRun!.id, { limit: 100 }), enabled: Boolean(selectedRun?.id) });

  useEffect(() => {
    const hasActiveRun = runsQuery.data?.runs.some((run) => run.status === "queued" || run.status === "running");
    if (!hasActiveRun) return;
    const timer = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.agentRuns(agentId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.agent(agentId) });
    }, 2500);
    return () => window.clearInterval(timer);
  }, [agentId, runsQuery.data?.runs]);

  async function cancelRun(runID: string) {
    if (cancelPending) return;
    setCancelPending(runID);
    setError("");
    try {
      await browserAPI.cancelAgentRun(agentId, runID);
      await queryClient.invalidateQueries({ queryKey: queryKeys.agentRuns(agentId) });
    } catch (requestError) {
      setError(browserAPIErrorMessage(requestError, "The agent run could not be cancelled."));
    } finally {
      setCancelPending(null);
    }
  }

  if (agentQuery.isPending || runsQuery.isPending) return <LoadingState />;
  if (agentQuery.error || runsQuery.error) return <ErrorState error={agentQuery.error ?? runsQuery.error} />;
  const agent = agentQuery.data.agent;
  const runs = runsQuery.data.runs;

  return <section><Link to="/agent" className="text-sm text-[var(--projects-accent)] hover:underline">← All agents</Link><header className="mt-5 flex flex-wrap items-start justify-between gap-5 border-b border-[var(--projects-border)] pb-6"><div className="flex items-start gap-3"><span className="inline-flex size-11 items-center justify-center rounded-xl border border-[var(--projects-border)] bg-[var(--projects-control)] text-[var(--projects-accent)]"><Bot size={21} aria-hidden="true" /></span><div><p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--projects-muted)]">Agent workspace</p><h1 className="m-0 mt-1 text-3xl font-semibold tracking-[-0.04em]">{agent.name}</h1><p className="m-0 mt-2 max-w-2xl text-sm text-[var(--projects-muted)]">{agent.description || "No description"}</p><div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--projects-muted)]"><span>{agent.project_name}</span><span className="inline-flex items-center gap-1"><GitBranch size={13} aria-hidden="true" />{agent.branch}</span><span>{agent.provider} · {agent.model}</span><span className="rounded-full border border-[var(--projects-border)] px-2 py-0.5">{agent.status}</span></div></div></div></header>
    {error ? <p role="alert" className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"><AgentRunForm agentID={agentId} tools={agent.tools} onQueued={setSelectedRunID} onError={setError} /><div className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="m-0 text-lg font-semibold">Run history</h2><p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">{runs.length} loaded</p></div></div>{runs.length ? <div className="mt-4 divide-y divide-[var(--projects-divider)]">{runs.map((run) => <div key={run.id} className="py-4"><div className="flex flex-wrap items-start justify-between gap-3"><button type="button" onClick={() => setSelectedRunID(run.id)} className="flex min-w-0 items-start gap-2 text-left hover:text-[var(--projects-accent)]">{statusIcon(run.status)}<span className="min-w-0"><span className="block truncate text-sm font-medium">{run.prompt}</span><span className="mt-1 block text-xs text-[var(--projects-muted)]">{formatDate(run.created_at)} · {run.status}</span></span></button>{run.status === "queued" || run.status === "running" ? <button type="button" onClick={() => void cancelRun(run.id)} disabled={cancelPending !== null} className="inline-flex h-8 items-center gap-1 rounded-md border border-rose-500/25 px-2.5 text-xs text-rose-200 hover:bg-rose-500/10 disabled:opacity-60">{cancelPending === run.id ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : <Square size={12} aria-hidden="true" />}{cancelPending === run.id ? "Cancelling…" : "Cancel"}</button> : null}</div>{selectedRun?.id === run.id ? <div className="mt-3 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] p-3 text-xs"><div className="flex flex-wrap gap-2">{run.steps.map((step) => <span key={step.id} className="rounded border border-[var(--projects-border)] px-2 py-1 text-[var(--projects-muted)]">{step.label} · {step.status}</span>)}</div>{run.output_text ? <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs leading-5 text-[var(--projects-text)]">{run.output_text}</pre> : null}{run.error_message ? <p className="m-0 mt-3 text-rose-200">{run.error_message}</p> : null}{logsQuery.isPending ? <p className="m-0 mt-3 text-[var(--projects-muted)]">Loading logs…</p> : logsQuery.error ? <p className="m-0 mt-3 text-rose-200">Unable to load logs.</p> : logsQuery.data.logs.length ? <div className="mt-3 max-h-40 overflow-auto border-t border-[var(--projects-divider)] pt-2">{logsQuery.data.logs.map((log) => <p key={log.id} className="m-0 py-1 font-mono text-[10px] text-[var(--projects-muted)]"><span className="mr-2 text-[var(--projects-accent)]">{log.level}</span>{log.message}</p>)}</div> : null}</div> : null}</div>)}</div> : <p className="m-0 mt-6 rounded-lg border border-dashed border-[var(--projects-border)] p-8 text-center text-sm text-[var(--projects-muted)]">No runs yet. Queue the first task above.</p>}</div></div></section>;
}
