"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Boxes, CircleAlert, FolderKanban, Layers3 } from "lucide-react";
import { AdminHeader, AdminPageBody, Mono } from "../components/admin-panel";
import { AdminSelect } from "../components/admin-select";
import { CopyButton } from "../components/copy-button";
import { DetailDrawer, DetailField } from "../components/detail-drawer";
import { StatTile } from "../components/stat-tile";
import { StatusBadge } from "../components/status-badge";
import { ToolbarSearch } from "../components/toolbar-search";
import type { FunctionErrorGroup, FunctionFailure } from "../types/errors";

type StatusFilter = "all" | "failed";

/**
 * Errors — durable failed Function executions grouped by exact message. The
 * API does not persist error resolution, traces, users, or historical rates,
 * so this page intentionally reports only the records that exist.
 */
export function ErrorsPage({
  initialGroups,
  failures,
  organizationCount,
  projectCount,
  functionCount,
  unavailableOrganizations,
  unavailableProjects,
  unavailableFunctions,
}: {
  initialGroups: FunctionErrorGroup[];
  failures: FunctionFailure[];
  organizationCount: number;
  projectCount: number;
  functionCount: number;
  unavailableOrganizations: number;
  unavailableProjects: number;
  unavailableFunctions: number;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [project, setProject] = useState("all");
  const [fn, setFn] = useState("all");
  const [selected, setSelected] = useState<FunctionErrorGroup | null>(null);

  const projectOptions = useMemo(() => uniqueGroups(initialGroups, "projectId").map((group) => ({ value: group.projectId, label: `${group.projectName} · ${group.organizationName}` })), [initialGroups]);
  const functionOptions = useMemo(() => uniqueGroups(initialGroups, "functionId").map((group) => ({ value: group.functionId, label: `${group.functionName} · ${group.projectName}` })), [initialGroups]);
  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return initialGroups.filter((group) => {
      if (status !== "all" && group.status !== status) return false;
      if (project !== "all" && group.projectId !== project) return false;
      if (fn !== "all" && group.functionId !== fn) return false;
      if (!normalizedQuery) return true;
      return [group.id, group.organizationName, group.projectName, group.functionName, group.runtime, group.message].join(" ").toLowerCase().includes(normalizedQuery);
    });
  }, [initialGroups, query, status, project, fn]);

  const failedExecutions = failures.length;
  const affectedFunctions = new Set(failures.map((failure) => failure.functionId)).size;
  const affectedProjects = new Set(failures.map((failure) => failure.projectId)).size;
  const hasPartialData = unavailableOrganizations + unavailableProjects + unavailableFunctions > 0;

  return (
    <AdminPageBody>
      <AdminHeader title="Errors" subtitle="Failed Function executions recorded by the platform.">
        <Mono className="hidden h-9 items-center rounded-lg border border-[var(--projects-border)] bg-[#141416] px-3 text-[12px] text-[var(--projects-muted)] sm:inline-flex">
          {visible.length} / {initialGroups.length} groups
        </Mono>
      </AdminHeader>

      {hasPartialData ? (
        <p className="m-0 rounded-lg border border-[color-mix(in_srgb,var(--projects-warning)_40%,var(--projects-border))] bg-[color-mix(in_srgb,var(--projects-warning)_7%,#141416)] px-3.5 py-3 text-[12.5px] leading-5 text-[var(--projects-warning)]">
          Some workspace resources could not be read ({unavailableOrganizations} organizations, {unavailableProjects} projects, {unavailableFunctions} functions). The page shows failures that were read successfully.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={CircleAlert} label="Failed executions" value={formatCount(failedExecutions)} tone={failedExecutions > 0 ? "danger" : "neutral"} />
        <StatTile icon={Layers3} label="Error groups" value={formatCount(initialGroups.length)} />
        <StatTile icon={Boxes} label="Functions affected" value={`${formatCount(affectedFunctions)} / ${formatCount(functionCount)}`} />
        <StatTile icon={FolderKanban} label="Projects affected" value={`${formatCount(affectedProjects)} / ${formatCount(projectCount)}`} hint={`${organizationCount} org${organizationCount === 1 ? "" : "s"}`} />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <ToolbarSearch value={query} onChange={setQuery} placeholder="Search function, project, message..." label="Search errors" />
        <AdminSelect
          label="Filter by status"
          value={status}
          onChange={setStatus}
          options={[{ value: "all", label: "All statuses" }, { value: "failed", label: "Failed" }]}
        />
        <AdminSelect
          label="Filter by project"
          value={project}
          onChange={setProject}
          search
          options={[{ value: "all", label: "All projects" }, ...projectOptions]}
        />
        <AdminSelect
          label="Filter by function"
          value={fn}
          onChange={setFn}
          search
          options={[{ value: "all", label: "All functions" }, ...functionOptions]}
        />
        <Mono className="ml-auto text-[11.5px] text-[var(--projects-muted)]">{visible.length} groups</Mono>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--projects-border)] bg-[#141416]">
        <ul className="m-0 list-none p-0">
          {visible.length === 0 ? (
            <li className="px-4 py-12 text-center text-[13px] text-[var(--projects-muted)]">
              {initialGroups.length === 0 ? "No failed Function executions have been recorded." : "No error groups match the current filters."}
            </li>
          ) : (
            visible.map((group) => (
              <li key={group.id} className="border-b border-[var(--projects-divider)] last:border-b-0">
                <button
                  type="button"
                  onClick={() => setSelected(group)}
                  aria-label={`Inspect ${group.functionName} failure`}
                  aria-expanded={selected?.id === group.id}
                  className="block w-full px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <StatusBadge tone="danger" label="Failed" />
                    <Mono className="text-[13px] font-medium text-[var(--projects-text)]">{group.functionName}</Mono>
                    <span className="ml-auto text-[12px] text-[var(--projects-muted)]">{group.count} execution{group.count === 1 ? "" : "s"}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--projects-muted)]">
                    <span>{group.organizationName}</span>
                    <span>{group.projectName}</span>
                    <Mono>{group.runtime}</Mono>
                    <span>last seen {formatTimestamp(group.lastSeen)}</span>
                    <span>first seen {formatTimestamp(group.firstSeen)}</span>
                  </div>
                  <p className="m-0 mt-1.5 truncate text-[12px] leading-4 text-[var(--projects-muted)]/85">{group.message}</p>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      <ErrorDetail group={selected} onClose={() => setSelected(null)} />
    </AdminPageBody>
  );
}

function ErrorDetail({ group, onClose }: { group: FunctionErrorGroup | null; onClose: () => void }) {
  return (
    <DetailDrawer
      open={group !== null}
      onClose={onClose}
      title={<><Mono className="truncate">{group?.functionName}</Mono>{group && <span className="ml-2"><StatusBadge tone="danger" label="Failed" /></span>}</>}
      subtitle={group ? `${group.projectName} · ${group.organizationName}` : undefined}
    >
      {group ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-x-4">
            <DetailField label="Status"><StatusBadge tone="danger" label="Failed" /></DetailField>
            <DetailField label="Runtime"><Mono>{group.runtime}</Mono></DetailField>
            <DetailField label="Project">{group.projectName}</DetailField>
            <DetailField label="Organization">{group.organizationName}</DetailField>
            <DetailField label="Executions">{formatCount(group.count)}</DetailField>
            <DetailField label="Latest execution"><Mono className="flex items-center gap-1">{group.latestExecutionId}<CopyButton text={group.latestExecutionId} /></Mono></DetailField>
            <DetailField label="First seen">{formatTimestamp(group.firstSeen)}</DetailField>
            <DetailField label="Last seen">{formatTimestamp(group.lastSeen)}</DetailField>
          </div>

          <div>
            <p className="m-0 mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--projects-muted)]">Error message</p>
            <p className="m-0 rounded-lg border border-[color-mix(in_srgb,var(--projects-danger)_35%,var(--projects-border))] bg-[color-mix(in_srgb,var(--projects-danger)_7%,#0f0f11)] p-3 text-[12.5px] leading-5 text-[var(--projects-text)]">{group.message}</p>
          </div>

          <div>
            <p className="m-0 mb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--projects-muted)]">Recent executions</p>
            <ul className="m-0 list-none divide-y divide-[var(--projects-divider)] rounded-lg border border-[var(--projects-border)] bg-[#0f0f11] p-0">
              {group.occurrences.map((failure) => <FailureRow key={failure.executionId} failure={failure} />)}
            </ul>
          </div>

          <Link href={`/projects/${encodeURIComponent(group.projectId)}/functions`} className="inline-flex h-8 w-fit items-center rounded-md border border-[var(--projects-border)] px-3 text-[12px] font-medium text-[var(--projects-text)] transition-colors hover:border-[var(--projects-border-hover)] hover:bg-white/[0.04]">Open Functions</Link>
        </div>
      ) : null}
    </DetailDrawer>
  );
}

function FailureRow({ failure }: { failure: FunctionFailure }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-[12px]">
      <Mono className="text-[var(--projects-text)]">{failure.executionId}</Mono>
      <span className="text-[var(--projects-muted)]">trigger: {failure.trigger}</span>
      <span className="ml-auto text-[var(--projects-muted)]">{formatTimestamp(failure.createdAt)}</span>
      <span className="w-full text-[11px] text-[var(--projects-muted)]">{formatDuration(failure.startedAt, failure.finishedAt)}{failure.responseStatus ? ` · response ${failure.responseStatus}` : ""}</span>
    </li>
  );
}

function uniqueGroups(groups: FunctionErrorGroup[], field: "projectId" | "functionId") {
  const seen = new Set<string>();
  return groups.filter((group) => {
    if (seen.has(group[field])) return false;
    seen.add(group[field]);
    return true;
  });
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatTimestamp(value: string) {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return "—";
  return `${timestamp.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function formatDuration(startedAt?: string, finishedAt?: string) {
  if (!startedAt || !finishedAt) return "Duration unavailable";
  const start = Date.parse(startedAt);
  const finish = Date.parse(finishedAt);
  if (!Number.isFinite(start) || !Number.isFinite(finish) || finish < start) return "Duration unavailable";
  const seconds = Math.floor((finish - start) / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}
