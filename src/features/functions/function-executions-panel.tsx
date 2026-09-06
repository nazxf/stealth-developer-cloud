import { Play, Terminal } from "lucide-react";
import type { FormEvent } from "react";
import { browserAPIErrorMessage, type BrowserFunctionExecutionLog } from "@/lib/api/browser-api";
import { Field, formatDate, inputClass, statusClass } from "./function-ui";

type FunctionExecution = {
  id: string;
  status: string;
  trigger: string;
  response_status?: number | null;
  error_message?: string | null;
  created_at: string;
  finished_at?: string | null;
};

export function ExecutionsPanel({
  pending,
  executions,
  loading,
  selectedExecutionID,
  onSelectExecution,
  logs,
  logsLoading,
  logsError,
  executionTrigger,
  setExecutionTrigger,
  executionInput,
  setExecutionInput,
  onInvoke,
}: {
  pending: boolean;
  executions: FunctionExecution[];
  loading: boolean;
  selectedExecutionID: string;
  onSelectExecution: (executionID: string) => void;
  logs: BrowserFunctionExecutionLog[];
  logsLoading: boolean;
  logsError: unknown;
  executionTrigger: string;
  setExecutionTrigger: (value: string) => void;
  executionInput: string;
  setExecutionInput: (value: string) => void;
  onInvoke: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="mt-5 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="m-0 text-lg font-semibold">Executions</h3>
          <p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">
            Invocation is queued; the worker owns runtime execution.
          </p>
        </div>
        <Play
          size={18}
          className="text-[var(--projects-accent)]"
          aria-hidden="true"
        />
      </div>
      <form
        onSubmit={onInvoke}
        className="mt-4 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto]"
        noValidate
      >
        <Field label="Trigger">
          <input
            value={executionTrigger}
            onChange={(event) => setExecutionTrigger(event.target.value)}
            disabled={pending}
            className={inputClass()}
            placeholder="manual"
          />
        </Field>
        <Field label="JSON input">
          <textarea
            value={executionInput}
            onChange={(event) => setExecutionInput(event.target.value)}
            disabled={pending}
            rows={2}
            className="mt-1 block w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 font-mono text-xs text-[var(--projects-text)]"
          />
        </Field>
        <button
          type="submit"
          disabled={pending}
          className="mt-auto inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-xs font-semibold text-white disabled:opacity-50"
        >
          <Play size={13} aria-hidden="true" />
          Invoke
        </button>
      </form>
      {loading ? (
        <p className="m-0 mt-5 text-sm text-[var(--projects-muted)]">
          Loading executions…
        </p>
      ) : executions.length ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--projects-border)]">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] uppercase tracking-[0.08em] text-[var(--projects-muted)]">
              <tr>
                <th scope="col" className="px-3 py-2">
                  Status
                </th>
                <th scope="col" className="px-3 py-2">
                  Trigger
                </th>
                <th scope="col" className="px-3 py-2">
                  Response
                </th>
                <th scope="col" className="px-3 py-2">
                  Created
                </th>
                <th scope="col" className="px-3 py-2">
                  Finished
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--projects-divider)]">
              {executions.map((execution) => (
                <tr key={execution.id}>
                  <td className="px-3 py-3">
                    <button type="button" onClick={() => onSelectExecution(execution.id)} className="text-left">
                      <span
                        className={`rounded-full border px-2 py-1 ${statusClass(execution.status)} ${selectedExecutionID === execution.id ? "ring-2 ring-[var(--projects-accent)]/50" : ""}`}
                      >
                        {execution.status}
                      </span>
                      {execution.error_message ? (
                        <p
                          className="m-0 mt-1 max-w-[220px] truncate text-[var(--projects-danger)]"
                          title={execution.error_message}
                        >
                          {execution.error_message}
                        </p>
                      ) : null}
                    </button>
                  </td>
                  <td className="px-3 py-3 font-mono text-[var(--projects-muted)]">
                    {execution.trigger}
                  </td>
                  <td className="px-3 py-3 text-[var(--projects-muted)]">
                    {execution.response_status ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-[var(--projects-muted)]">
                    {formatDate(execution.created_at)}
                  </td>
                  <td className="px-3 py-3 text-[var(--projects-muted)]">
                    {formatDate(execution.finished_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="m-0 mt-5 rounded-lg border border-dashed border-[var(--projects-border)] p-10 text-center text-sm text-[var(--projects-muted)]">
          No executions yet.
        </p>
      )}
      {selectedExecutionID ? (
        <section className="mt-5 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2"><Terminal size={15} className="text-[var(--projects-accent)]" aria-hidden="true" /><h4 className="m-0 text-sm font-semibold">Runtime logs</h4></div>
            <span className="font-mono text-[10px] text-[var(--projects-muted)]">execution: {selectedExecutionID}</span>
          </div>
          <p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">Secret-redacted output emitted by the trusted Function worker.</p>
          {logsLoading ? <p className="m-0 mt-4 text-xs text-[var(--projects-muted)]">Loading logs…</p> : logsError ? <p role="alert" className="m-0 mt-4 text-xs text-rose-200">{browserAPIErrorMessage(logsError, "Unable to load execution logs.")}</p> : logs.length ? <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-3">{logs.map((log) => <p key={log.id} className="m-0 border-b border-[var(--projects-divider)] py-1.5 font-mono text-[10px] leading-5 last:border-0"><span className={`mr-2 uppercase ${log.level === "error" ? "text-rose-200" : log.level === "warn" ? "text-amber-200" : "text-[var(--projects-accent)]"}`}>{log.level}</span><span className="mr-2 text-[var(--projects-muted)]">#{log.sequence}</span>{log.message}</p>)}</div> : <p className="m-0 mt-4 rounded-lg border border-dashed border-[var(--projects-border)] p-6 text-center text-xs text-[var(--projects-muted)]">No worker logs have been emitted for this execution.</p>}
        </section>
      ) : null}
    </div>
  );
}
