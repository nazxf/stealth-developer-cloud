import { Save, Settings2, Trash2 } from "lucide-react";
import type { FormEvent } from "react";
import { type BrowserFunction, type BrowserFunctionRuntime } from "@/lib/api/browser-api";
import { Field, inputClass, runtimes } from "./function-ui";

export function SettingsPanel({
  selected,
  canManage,
  pending,
  name,
  setName,
  runtime,
  setRuntime,
  entrypoint,
  setEntrypoint,
  commands,
  setCommands,
  timeout,
  setTimeout,
  quota,
  setQuota,
  enabled,
  setEnabled,
  logging,
  setLogging,
  executePermissions,
  setExecutePermissions,
  onSave,
  onDelete,
}: {
  selected: BrowserFunction;
  canManage: boolean;
  pending: boolean;
  name: string;
  setName: (value: string) => void;
  runtime: BrowserFunctionRuntime;
  setRuntime: (value: BrowserFunctionRuntime) => void;
  entrypoint: string;
  setEntrypoint: (value: string) => void;
  commands: string;
  setCommands: (value: string) => void;
  timeout: string;
  setTimeout: (value: string) => void;
  quota: string;
  setQuota: (value: string) => void;
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  logging: boolean;
  setLogging: (value: boolean) => void;
  executePermissions: string;
  setExecutePermissions: (value: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
}) {
  return (
    <form
      onSubmit={onSave}
      className="mt-5 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"
      noValidate
    >
      <div className="flex items-start gap-3">
        <Settings2
          size={19}
          className="mt-0.5 text-[var(--projects-muted)]"
          aria-hidden="true"
        />
        <div>
          <h3 className="m-0 text-lg font-semibold">Function settings</h3>
          <p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">
            Runtime and deployment policy are applied to the next release.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <Field label="Name">
          <input
            required
            minLength={2}
            maxLength={63}
            pattern="[a-z0-9][a-z0-9-]{1,62}"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={!canManage || pending}
            className={inputClass()}
          />
        </Field>
        <Field label="Runtime">
          <select
            value={runtime}
            onChange={(event) =>
              setRuntime(event.target.value as BrowserFunctionRuntime)
            }
            disabled={!canManage || pending}
            className={inputClass()}
          >
            {runtimes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Entrypoint">
          <input
            required
            value={entrypoint}
            onChange={(event) => setEntrypoint(event.target.value)}
            disabled={!canManage || pending}
            className={`${inputClass()} font-mono text-xs`}
          />
        </Field>
        <Field label="Build commands">
          <input
            value={commands}
            onChange={(event) => setCommands(event.target.value)}
            disabled={!canManage || pending}
            className={`${inputClass()} font-mono text-xs`}
            placeholder="npm install && npm run build"
          />
        </Field>
        <Field label="Timeout seconds">
          <input
            type="number"
            min={1}
            max={900}
            value={timeout}
            onChange={(event) => setTimeout(event.target.value)}
            disabled={!canManage || pending}
            className={inputClass()}
          />
        </Field>
        <Field label="Artifact quota bytes">
          <input
            type="number"
            min={selected.artifact_used_bytes}
            value={quota}
            onChange={(event) => setQuota(event.target.value)}
            disabled={!canManage || pending}
            className={inputClass()}
          />
        </Field>
        <Field label="Execute permissions">
          <input
            value={executePermissions}
            onChange={(event) => setExecutePermissions(event.target.value)}
            disabled={!canManage || pending}
            className={`${inputClass()} font-mono text-xs`}
            placeholder="any, users, user:uuid"
          />
        </Field>
        <div className="flex items-end gap-4 pb-2 text-xs">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              disabled={!canManage || pending}
              className="accent-[var(--projects-accent)]"
            />
            Enabled
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={logging}
              onChange={(event) => setLogging(event.target.checked)}
              disabled={!canManage || pending}
              className="accent-[var(--projects-accent)]"
            />
            Logging
          </label>
        </div>
      </div>
      {canManage ? (
        <div className="mt-5 flex flex-wrap justify-between gap-3 border-t border-[var(--projects-divider)] pt-4">
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-500/30 px-3 text-xs text-rose-200"
          >
            <Trash2 size={13} aria-hidden="true" />
            Delete function
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-xs font-semibold text-white disabled:opacity-50"
          >
            <Save size={13} aria-hidden="true" />
            Save settings
          </button>
        </div>
      ) : null}
    </form>
  );
}
