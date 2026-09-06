import { CheckCircle2, FileArchive, LoaderCircle, Terminal, Trash2, Upload } from "lucide-react";
import type { FormEvent, RefObject } from "react";
import { browserAPIErrorMessage, type BrowserFunction, type BrowserFunctionBuildLog } from "@/lib/api/browser-api";
import { formatDate, statusClass } from "./function-ui";

type FunctionDeployment = {
  id: string;
  version: number;
  source: string;
  source_name?: string | null;
  status: string;
  build_status: string;
  error_message?: string | null;
  created_at: string;
  activated_at?: string | null;
};

export function DeploymentsPanel({
  selected,
  canManage,
  pending,
  source,
  setSource,
  sourceInputRef,
  activateUpload,
  setActivateUpload,
  deployments,
  loading,
  selectedDeploymentID,
  onSelectDeployment,
  buildLogs,
  buildLogsLoading,
  buildLogsError,
  onUpload,
  onActivate,
  onDelete,
}: {
  selected: BrowserFunction;
  canManage: boolean;
  pending: boolean;
  source: File | null;
  setSource: (value: File | null) => void;
  sourceInputRef: RefObject<HTMLInputElement | null>;
  activateUpload: boolean;
  setActivateUpload: (value: boolean) => void;
  deployments: FunctionDeployment[];
  loading: boolean;
  selectedDeploymentID: string;
  onSelectDeployment: (deploymentID: string) => void;
  buildLogs: BrowserFunctionBuildLog[];
  buildLogsLoading: boolean;
  buildLogsError: unknown;
  onUpload: (event: FormEvent<HTMLFormElement>) => void;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="mt-5 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5">
      <div className="flex items-start gap-3">
        <FileArchive
          size={19}
          className="mt-0.5 text-[var(--projects-muted)]"
          aria-hidden="true"
        />
        <div>
          <h3 className="m-0 text-lg font-semibold">Deployments</h3>
          <p className="m-0 mt-1 text-xs leading-5 text-[var(--projects-muted)]">
            Source archives are immutable. Workers build and activate one
            release at a time.
          </p>
        </div>
      </div>
      {canManage ? (
        <form
          onSubmit={onUpload}
          className="mt-4 grid gap-3 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] p-3 md:grid-cols-[minmax(0,1fr)_auto_auto]"
          noValidate
        >
          <label className="text-xs text-[var(--projects-muted)]">
            Source archive
            <input
              ref={sourceInputRef}
              required
              type="file"
              name="source"
              accept=".zip,.tar,.gz,.tgz,application/zip,application/gzip"
              onChange={(event) => setSource(event.target.files?.[0] ?? null)}
              disabled={pending}
              className="mt-1 block w-full text-xs text-[var(--projects-text)] file:mr-3 file:rounded file:border-0 file:bg-[var(--projects-accent-strong)] file:px-2 file:py-1 file:text-[11px] file:font-semibold file:text-white"
            />
          </label>
          <label className="flex items-end gap-2 pb-2 text-xs text-[var(--projects-text)]">
            <input
              type="checkbox"
              checked={activateUpload}
              onChange={(event) => setActivateUpload(event.target.checked)}
              disabled={pending}
              className="accent-[var(--projects-accent)]"
            />
            Activate
          </label>
          <button
            type="submit"
            disabled={pending || !source}
            className="mt-auto inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-xs font-semibold text-white disabled:opacity-50"
          >
            {pending ? (
              <LoaderCircle
                size={13}
                className="animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Upload size={13} aria-hidden="true" />
            )}
            Deploy
          </button>
        </form>
      ) : null}
      {loading ? (
        <p className="m-0 mt-5 text-sm text-[var(--projects-muted)]">
          Loading deployment history…
        </p>
      ) : deployments.length ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--projects-border)]">
          <table className="w-full min-w-[720px] text-left text-xs">
            <caption className="sr-only">
              Deployments for {selected.name}
            </caption>
            <thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] uppercase tracking-[0.08em] text-[var(--projects-muted)]">
              <tr>
                <th scope="col" className="px-3 py-2">
                  Version
                </th>
                <th scope="col" className="px-3 py-2">
                  Status
                </th>
                <th scope="col" className="px-3 py-2">
                  Source
                </th>
                <th scope="col" className="px-3 py-2">
                  Created
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--projects-divider)]">
              {deployments.map((deployment) => (
                <tr key={deployment.id}>
                  <td className="px-3 py-3 font-mono text-[var(--projects-muted)]">
                    v{deployment.version}
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => onSelectDeployment(deployment.id)}
                      aria-pressed={selectedDeploymentID === deployment.id}
                      aria-label={`View build logs for deployment ${deployment.id}`}
                      className={`rounded-md text-left ${selectedDeploymentID === deployment.id ? "ring-2 ring-[var(--projects-accent)]/50" : ""}`}
                    >
                      <div className="flex flex-wrap gap-1">
                        <span
                          className={`rounded-full border px-2 py-1 ${statusClass(deployment.status)}`}
                        >
                          {deployment.status}
                        </span>
                        {deployment.build_status !== deployment.status ? (
                          <span
                            className={`rounded-full border px-2 py-1 ${statusClass(deployment.build_status)}`}
                          >
                            build {deployment.build_status}
                          </span>
                        ) : null}
                      </div>
                      {deployment.error_message ? (
                        <p
                          className="m-0 mt-1 max-w-[220px] truncate text-[var(--projects-danger)]"
                          title={deployment.error_message}
                        >
                          {deployment.error_message}
                        </p>
                      ) : null}
                    </button>
                  </td>
                  <td
                    className="max-w-[200px] truncate px-3 py-3 text-[var(--projects-muted)]"
                    title={deployment.source_name ?? deployment.source}
                  >
                    {deployment.source_name ?? deployment.source}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-[var(--projects-muted)]">
                    <time dateTime={deployment.created_at}>
                      {formatDate(deployment.created_at)}
                    </time>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {canManage &&
                    deployment.status === "ready" &&
                    deployment.build_status === "succeeded" ? (
                      <button
                        type="button"
                        onClick={() => onActivate(deployment.id)}
                        disabled={pending}
                        className="mr-2 inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 px-2 py-1 text-emerald-200"
                      >
                        <CheckCircle2 size={12} aria-hidden="true" />
                        Activate
                      </button>
                    ) : null}
                    {canManage && deployment.status !== "active" ? (
                      <button
                        type="button"
                        onClick={() => onDelete(deployment.id)}
                        disabled={pending}
                        aria-label={`Delete deployment ${deployment.id}`}
                        className="inline-flex items-center rounded-lg border border-rose-500/30 p-1.5 text-rose-200"
                      >
                        <Trash2 size={12} aria-hidden="true" />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="m-0 mt-5 rounded-lg border border-dashed border-[var(--projects-border)] p-10 text-center text-sm text-[var(--projects-muted)]">
          No deployments yet. Upload a source archive to create one.
        </p>
      )}
      {selectedDeploymentID ? (
        <section className="mt-5 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Terminal size={15} className="text-[var(--projects-accent)]" aria-hidden="true" />
              <h4 className="m-0 text-sm font-semibold">Build logs</h4>
            </div>
            <span className="font-mono text-[10px] text-[var(--projects-muted)]">
              deployment: {selectedDeploymentID}
            </span>
          </div>
          <p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">
            Secret-redacted output emitted by the trusted Function build worker.
          </p>
          {buildLogsLoading ? (
            <p className="m-0 mt-4 text-xs text-[var(--projects-muted)]">Loading build logs…</p>
          ) : buildLogsError ? (
            <p role="alert" className="m-0 mt-4 text-xs text-rose-200">
              {browserAPIErrorMessage(buildLogsError, "Unable to load build logs.")}
            </p>
          ) : buildLogs.length ? (
            <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-3">
              {buildLogs.map((log) => (
                <p key={log.id} className="m-0 border-b border-[var(--projects-divider)] py-1.5 font-mono text-[10px] leading-5 last:border-0">
                  <span className={`mr-2 uppercase ${log.level === "error" ? "text-rose-200" : log.level === "warn" ? "text-amber-200" : "text-[var(--projects-accent)]"}`}>
                    {log.level}
                  </span>
                  <span className="mr-2 text-[var(--projects-muted)]">#{log.sequence}</span>
                  {log.message}
                </p>
              ))}
            </div>
          ) : (
            <p className="m-0 mt-4 rounded-lg border border-dashed border-[var(--projects-border)] p-6 text-center text-xs text-[var(--projects-muted)]">
              No build logs have been emitted for this deployment.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
