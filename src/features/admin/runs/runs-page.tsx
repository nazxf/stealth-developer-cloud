"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { CircleCheck, CircleX, LoaderCircle } from "lucide-react";
import { AdminHeader, AdminPageBody, Mono } from "../components/admin-panel";
import { ToolbarSearch } from "../components/toolbar-search";
import { AdminSelect } from "../components/admin-select";
import { DetailDrawer, DetailField } from "../components/detail-drawer";
import { RunStatusBadge } from "../components/domain-badges";
import type { AgentRun, RunStep, RunStatus } from "../types/runs";

type StatusFilter = "all" | RunStatus;
type ProviderFilter = "all" | string;
type ModelFilter = "all" | string;

/**
 * Agent Runs — recent durable queue records visible to the authenticated
 * workspace. Token/cost/repository/trace fields are intentionally omitted
 * because those metering and telemetry contracts do not exist yet.
 */
export function RunsPage({
  initialRuns,
  agentCount,
  unavailableAgents,
}: {
  initialRuns: AgentRun[];
  agentCount: number;
  unavailableAgents: number;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [provider, setProvider] = useState<ProviderFilter>("all");
  const [model, setModel] = useState<ModelFilter>("all");
  const [selected, setSelected] = useState<AgentRun | null>(null);

  const providers = useMemo(() => unique(initialRuns.map((run) => run.provider).filter((value) => value !== "—")), [initialRuns]);
  const models = useMemo(() => unique(initialRuns.map((run) => run.model).filter((value) => value !== "—")), [initialRuns]);
  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return initialRuns.filter((run) => {
      if (status !== "all" && run.status !== status) return false;
      if (provider !== "all" && run.provider !== provider) return false;
      if (model !== "all" && run.model !== model) return false;
      if (!normalizedQuery) return true;
      return [run.id, run.user, run.agent, run.project, run.prompt].join(" ").toLowerCase().includes(normalizedQuery);
    });
  }, [initialRuns, query, status, provider, model]);

  return (
    <AdminPageBody>
      <AdminHeader title="Agent Runs" subtitle="Recent durable queue records in the authenticated workspace.">
        <Mono className="hidden h-9 items-center rounded-lg border border-[var(--projects-border)] bg-[#141416] px-3 text-[12px] text-[var(--projects-muted)] sm:inline-flex">
          {visible.length} / {initialRuns.length} runs · {agentCount} agents
        </Mono>
      </AdminHeader>

      {unavailableAgents > 0 && (
        <p className="m-0 rounded-lg border border-[color-mix(in_srgb,var(--projects-warning)_40%,var(--projects-border))] bg-[color-mix(in_srgb,var(--projects-warning)_7%,#141416)] px-3.5 py-3 text-[12.5px] leading-5 text-[var(--projects-warning)]">
          {unavailableAgents} agent run list{unavailableAgents === 1 ? " is" : "s are"} temporarily unavailable. The table shows records that were read successfully.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <ToolbarSearch value={query} onChange={setQuery} placeholder="Search run, agent, project, prompt..." label="Search runs" />
        <AdminSelect
          label="Filter by status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All statuses" },
            { value: "running", label: "Running" },
            { value: "completed", label: "Completed" },
            { value: "failed", label: "Failed" },
            { value: "queued", label: "Queued" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
        <AdminSelect
          label="Filter by provider"
          value={provider}
          onChange={setProvider}
          options={[{ value: "all", label: "All providers" }, ...providers.map((item) => ({ value: item, label: item }))]}
        />
        <AdminSelect
          label="Filter by model"
          value={model}
          onChange={setModel}
          search
          options={[{ value: "all", label: "All models" }, ...models.map((item) => ({ value: item, label: item }))]}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--projects-border)] bg-[#141416]">
        <div
          aria-hidden="true"
          className="hidden grid-cols-[104px_110px_minmax(0,1.5fr)_minmax(0,1.2fr)_88px_minmax(0,1.2fr)_100px_84px] gap-3 border-b border-[var(--projects-divider)] px-3.5 py-2 xl:grid"
        >
          <ColumnLabel>Run</ColumnLabel>
          <ColumnLabel>User</ColumnLabel>
          <ColumnLabel>Agent</ColumnLabel>
          <ColumnLabel>Project</ColumnLabel>
          <ColumnLabel>Provider</ColumnLabel>
          <ColumnLabel>Model</ColumnLabel>
          <ColumnLabel>Status</ColumnLabel>
          <ColumnLabel>Started</ColumnLabel>
        </div>
        <ul className="m-0 list-none p-0">
          {visible.length === 0 ? (
            <li className="px-4 py-12 text-center text-[13px] text-[var(--projects-muted)]">
              {initialRuns.length === 0 ? "No durable agent runs have been queued." : "No runs match the current filters."}
            </li>
          ) : (
            visible.map((run) => (
              <li key={run.id} className="border-b border-[var(--projects-divider)] last:border-b-0">
                <button
                  type="button"
                  onClick={() => setSelected(run)}
                  aria-label={`Inspect run ${run.id}`}
                  className="block w-full px-3.5 py-2 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <span className="hidden items-center gap-3 xl:grid xl:grid-cols-[104px_110px_minmax(0,1.5fr)_minmax(0,1.2fr)_88px_minmax(0,1.2fr)_100px_84px]">
                    <Mono className="text-[12px] font-medium text-[var(--projects-text)]">{run.id}</Mono>
                    <span className="truncate text-[12px] text-[var(--projects-muted)]">{run.user}</span>
                    <span className="truncate text-[12.5px] text-[var(--projects-text)]">{run.agent}</span>
                    <span className="truncate text-[12px] text-[var(--projects-muted)]">{run.project}</span>
                    <Mono className="text-[11.5px] text-[#b3b0ba]">{run.provider}</Mono>
                    <Mono className="truncate text-[11.5px] text-[#b3b0ba]">{run.model}</Mono>
                    <RunStatusBadge status={run.status} />
                    <Mono className="text-[11px] text-[var(--projects-muted)]">{run.startedAt}</Mono>
                  </span>
                  <span className="block xl:hidden">
                    <span className="flex items-center gap-2">
                      <Mono className="text-[12px] font-medium text-[var(--projects-text)]">{run.id}</Mono>
                      <span className="truncate text-[12px] text-[var(--projects-muted)]">{run.agent} · {run.project}</span>
                      <span className="ml-auto shrink-0">
                        <RunStatusBadge status={run.status} />
                      </span>
                    </span>
                    <Mono className="mt-1 block text-[11px] leading-4 text-[var(--projects-muted)]">
                      {run.user} · {run.model} · {run.duration} · {run.startedAt}
                    </Mono>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      <RunDetail run={selected} onClose={() => setSelected(null)} />
    </AdminPageBody>
  );
}

function RunDetail({ run, onClose }: { run: AgentRun | null; onClose: () => void }) {
  return (
    <DetailDrawer
      open={run !== null}
      onClose={onClose}
      title={
        <>
          <Mono className="truncate">{run?.id}</Mono>
          {run && <span className="ml-2"><RunStatusBadge status={run.status} /></span>}
        </>
      }
      subtitle={run ? `${run.user} · ${run.project}` : undefined}
    >
      {run && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-x-4">
            <DetailField label="User">{run.user}</DetailField>
            <DetailField label="Agent">{run.agent}</DetailField>
            <DetailField label="Project">{run.project}</DetailField>
            <DetailField label="Model">{run.model}</DetailField>
            <DetailField label="Provider">{run.provider}</DetailField>
            <DetailField label="Duration">{run.duration}</DetailField>
            <DetailField label="Queued">{run.queuedAt}</DetailField>
            <DetailField label="Started">{run.startedAt}</DetailField>
            {run.finishedAt && <DetailField label="Finished">{run.finishedAt}</DetailField>}
            <DetailField label="Prompt" wide>
              <p className="m-0 whitespace-pre-wrap">{run.prompt}</p>
            </DetailField>
          </div>

          <div>
            <p className="m-0 mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--projects-muted)]">Steps</p>
            {run.steps.length === 0 ? (
              <p className="m-0 rounded-lg border border-[var(--projects-border)] bg-[#0f0f11] p-3 text-[12.5px] text-[var(--projects-muted)]">No worker steps recorded yet.</p>
            ) : (
              <ul className="m-0 list-none p-0">
                {run.steps.map((step, index) => <StepRow key={`${step.label}-${index}`} step={step} last={index === run.steps.length - 1} />)}
              </ul>
            )}
          </div>

          {run.outputText && (
            <div>
              <p className="m-0 mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--projects-muted)]">Output</p>
              <pre className="m-0 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--projects-border)] bg-[#0f0f11] p-3 text-[12px] leading-5 text-[var(--projects-text)]">{run.outputText}</pre>
            </div>
          )}

          {run.error && (
            <div>
              <p className="m-0 mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--projects-muted)]">Error</p>
              <p className="m-0 rounded-lg border border-[color-mix(in_srgb,var(--projects-danger)_45%,var(--projects-border))] bg-[color-mix(in_srgb,var(--projects-danger)_8%,#0f0f11)] p-3 text-[12.5px] leading-5 text-[var(--projects-danger)]">{run.error}</p>
            </div>
          )}

          {run.changes.length > 0 && (
            <div>
              <p className="m-0 mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--projects-muted)]">Changes</p>
              <ul className="m-0 list-none divide-y divide-[var(--projects-divider)] rounded-lg border border-[var(--projects-border)] bg-[#0f0f11] p-0">
                {run.changes.map((change) => (
                  <li key={change.path} className="flex items-center gap-2 px-3 py-2 text-[12px]">
                    <Mono className="min-w-0 flex-1 truncate text-[var(--projects-text)]">{change.path}</Mono>
                    <Mono className="shrink-0 text-[var(--projects-muted)]">+{change.additions} −{change.deletions}</Mono>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Link href={`/agent/${encodeURIComponent(run.agentId)}`} className="inline-flex h-8 w-fit items-center rounded-md border border-[var(--projects-border)] px-3 text-[12px] font-medium text-[var(--projects-text)] transition-colors hover:border-[var(--projects-border-hover)] hover:bg-white/[0.04]">Open agent workspace</Link>
        </div>
      )}
    </DetailDrawer>
  );
}

function StepRow({ step, last }: { step: RunStep; last: boolean }) {
  const meta =
    step.state === "done"
      ? { Icon: CircleCheck, className: "text-[var(--projects-accent)]" }
      : step.state === "failed"
        ? { Icon: CircleX, className: "text-[var(--projects-danger)]" }
        : { Icon: LoaderCircle, className: "text-[var(--admin-info)]" };

  return (
    <li className="relative flex items-start gap-2.5 pb-3 last:pb-0">
      {!last && <span aria-hidden="true" className="absolute left-[7px] top-5 h-[calc(100%-12px)] w-px bg-[var(--projects-divider)]" />}
      <meta.Icon size={15} strokeWidth={2} className={`mt-0.5 shrink-0 ${meta.className} ${step.state === "running" ? "animate-spin" : ""}`} aria-hidden="true" />
      <span className="text-[12.5px] leading-5 text-[var(--projects-text)]">
        {step.label}
        {step.state === "running" && <span className="ml-2 text-[11px] text-[var(--admin-info)]">running…</span>}
        {step.state === "pending" && <span className="ml-2 text-[11px] text-[var(--projects-muted)]">pending</span>}
        {step.state === "failed" && <span className="ml-2 text-[11px] text-[var(--projects-danger)]">failed</span>}
      </span>
    </li>
  );
}

function unique(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function ColumnLabel({ children }: { children: ReactNode }) {
  return <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--projects-muted)]">{children}</span>;
}
