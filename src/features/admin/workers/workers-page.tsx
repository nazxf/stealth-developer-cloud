"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { AdminHeader, AdminPageBody, AdminPanel, AdminPanelHeader, Mono } from "../components/admin-panel";
import { DetailDrawer, DetailField } from "../components/detail-drawer";
import { RunStatusBadge } from "../components/domain-badges";
import { StatusBadge } from "../components/status-badge";
import type { AgentRun } from "../types/runs";

/**
 * Workers view: the Console can truthfully expose the durable hand-off queue,
 * but host inventory, CPU, and worker heartbeats belong to the private runtime.
 */
export function WorkersPage({ initialRuns, agentCount, unavailableAgents }: { initialRuns: AgentRun[]; agentCount: number; unavailableAgents: number }) {
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const selected = useMemo(() => initialRuns.find((run) => run.id === selectedID) ?? null, [initialRuns, selectedID]);
  const queued = initialRuns.filter((run) => run.status === "queued").length;
  const running = initialRuns.filter((run) => run.status === "running").length;
  const terminal = initialRuns.filter((run) => ["completed", "failed", "cancelled"].includes(run.status)).length;

  return (
    <AdminPageBody>
      <AdminHeader title="Workers" subtitle="Durable execution queue handed to trusted runtime workers.">
        <Link href="/admin/runs" className="inline-flex h-9 items-center rounded-lg border border-[var(--projects-border)] px-3.5 text-[12.5px] font-medium text-[var(--projects-text)] transition-colors hover:border-[var(--projects-border-hover)] hover:bg-white/[0.04]">Open Agent Runs</Link>
      </AdminHeader>

      {unavailableAgents > 0 ? <p className="m-0 rounded-lg border border-[color-mix(in_srgb,var(--projects-warning)_40%,var(--projects-border))] bg-[color-mix(in_srgb,var(--projects-warning)_7%,#141416)] px-3.5 py-3 text-[12.5px] leading-5 text-[var(--projects-warning)]">{unavailableAgents} agent run list{unavailableAgents === 1 ? " is" : "s are"} temporarily unavailable. Queue totals include records read successfully.</p> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Tile label="Queued" value={String(queued)} tone={queued > 0 ? "warning" : "neutral"} /><Tile label="Running" value={String(running)} tone={running > 0 ? "info" : "neutral"} /><Tile label="Terminal records" value={String(terminal)} /><Tile label="Agents" value={String(agentCount)} /></div>

      <AdminPanel flush>
        <div className="p-4 pb-2"><AdminPanelHeader title="Execution queue" subtitle="Rows are persisted Agent Run records. A queue item remains visible until the trusted worker reports a terminal state." /></div>
        <div aria-hidden="true" className="hidden grid-cols-[110px_minmax(0,1.4fr)_minmax(0,1.2fr)_110px_110px] gap-3 border-y border-[var(--projects-divider)] bg-[var(--projects-control)] px-4 py-2 lg:grid"><Col>Run</Col><Col>Agent</Col><Col>Project</Col><Col>Status</Col><Col>Queued</Col></div>
        <ul className="m-0 list-none p-0">{initialRuns.length === 0 ? <li className="px-4 py-12 text-center text-[13px] text-[var(--projects-muted)]">No durable Agent Runs have been queued.</li> : initialRuns.map((run) => <li key={run.id} className="border-b border-[var(--projects-divider)] last:border-b-0"><button type="button" onClick={() => setSelectedID((current) => current === run.id ? null : run.id)} aria-expanded={selectedID === run.id} className="block w-full px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"><span className="hidden items-center gap-3 lg:grid lg:grid-cols-[110px_minmax(0,1.4fr)_minmax(0,1.2fr)_110px_110px]"><Mono className="text-[12px] font-medium text-[var(--projects-text)]">{run.id}</Mono><span className="truncate text-[12.5px] text-[var(--projects-text)]">{run.agent}</span><span className="truncate text-[12px] text-[var(--projects-muted)]">{run.project}</span><RunStatusBadge status={run.status} /><Mono className="text-[11px] text-[var(--projects-muted)]">{run.queuedAt}</Mono></span><span className="block lg:hidden"><span className="flex items-center gap-2"><Mono className="text-[12px] font-medium text-[var(--projects-text)]">{run.id}</Mono><span className="truncate text-[12px] text-[var(--projects-muted)]">{run.agent} · {run.project}</span><span className="ml-auto shrink-0"><RunStatusBadge status={run.status} /></span></span><Mono className="mt-1 block text-[11px] leading-4 text-[var(--projects-muted)]">{run.queuedAt} · {run.duration}</Mono></span></button></li>)}</ul>
      </AdminPanel>

      <AdminPanel>
        <AdminPanelHeader title="Runtime boundary" subtitle="What this Console can verify versus what remains private to the worker deployment." />
        <div className="grid gap-3 sm:grid-cols-3"><Boundary title="Queue persistence" detail="Queued, running, and terminal Agent Run states are read from PostgreSQL." state="Connected" tone="success" /><Boundary title="Worker execution" detail="A trusted worker owns provider calls, tools, sandbox execution, and output writes." state="Worker-owned" tone="info" /><Boundary title="Host telemetry" detail="Per-host CPU, memory, disk, and heartbeat history are private deployment signals." state="Private" tone="neutral" /></div>
      </AdminPanel>

      <RunDetail run={selected} onClose={() => setSelectedID(null)} />
    </AdminPageBody>
  );
}

function RunDetail({ run, onClose }: { run: AgentRun | null; onClose: () => void }) {
  return <DetailDrawer open={run !== null} onClose={onClose} title={<><Mono>{run?.id}</Mono>{run && <span className="ml-2"><RunStatusBadge status={run.status} /></span>}</>} subtitle={run ? `${run.agent} · ${run.project}` : undefined}>{run ? <div className="flex flex-col gap-4"><div className="grid grid-cols-2 gap-x-4"><DetailField label="Status"><RunStatusBadge status={run.status} /></DetailField><DetailField label="User">{run.user}</DetailField><DetailField label="Queued">{run.queuedAt}</DetailField><DetailField label="Started">{run.startedAt}</DetailField><DetailField label="Duration">{run.duration}</DetailField><DetailField label="Model">{run.model}</DetailField><DetailField label="Prompt" wide><p className="m-0 whitespace-pre-wrap">{run.prompt}</p></DetailField></div>{run.outputText ? <div><p className="m-0 mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--projects-muted)]">Output</p><pre className="m-0 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--projects-border)] bg-[#0f0f11] p-3 text-[12px] leading-5 text-[var(--projects-text)]">{run.outputText}</pre></div> : null}{run.error ? <p className="m-0 rounded-lg border border-[color-mix(in_srgb,var(--projects-danger)_45%,var(--projects-border))] bg-[color-mix(in_srgb,var(--projects-danger)_8%,#0f0f11)] p-3 text-[12.5px] leading-5 text-[var(--projects-danger)]">{run.error}</p> : null}<Link href={`/agent/${encodeURIComponent(run.agentId)}`} className="inline-flex h-8 w-fit items-center rounded-md border border-[var(--projects-border)] px-3 text-[12px] font-medium text-[var(--projects-text)] transition-colors hover:border-[var(--projects-border-hover)] hover:bg-white/[0.04]">Open agent workspace</Link></div> : null}</DetailDrawer>;
}

function Tile({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "success" | "warning" | "info" }) {
  return <article className="rounded-lg border border-[var(--projects-border)] bg-[#141416] px-3.5 py-3"><p className="m-0 text-[11px] leading-4 text-[var(--projects-muted)]">{label}</p><p className={`m-0 text-[17px] font-semibold leading-6 ${tone === "success" ? "text-[var(--projects-accent)]" : tone === "warning" ? "text-[var(--projects-warning)]" : tone === "info" ? "text-[var(--admin-info)]" : "text-[var(--projects-text)]"}`}>{value}</p></article>;
}

function Boundary({ title, detail, state, tone }: { title: string; detail: string; state: string; tone: "success" | "info" | "neutral" }) {
  return <article className="rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] p-3.5"><div className="flex items-center gap-2"><h3 className="m-0 min-w-0 flex-1 text-[12.5px] font-medium text-[var(--projects-text)]">{title}</h3><StatusBadge tone={tone} label={state} /></div><p className="m-0 mt-2 text-[11.5px] leading-5 text-[var(--projects-muted)]">{detail}</p></article>;
}

function Col({ children }: { children: ReactNode }) {
  return <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--projects-muted)]">{children}</span>;
}
