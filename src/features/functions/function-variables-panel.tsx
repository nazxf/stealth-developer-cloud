import { Plus, Trash2 } from "lucide-react";
import type { FormEvent } from "react";
import { type BrowserFunctionVariable } from "@/lib/api/browser-api";
import { Field, formatDate, inputClass } from "./function-ui";

export function VariablesPanel({
  canManage,
  pending,
  variables,
  loading,
  variableKey,
  setVariableKey,
  variableValue,
  setVariableValue,
  variableSecret,
  setVariableSecret,
  variableDescription,
  setVariableDescription,
  onCreate,
  onDelete,
}: {
  canManage: boolean;
  pending: boolean;
  variables: BrowserFunctionVariable[];
  loading: boolean;
  variableKey: string;
  setVariableKey: (value: string) => void;
  variableValue: string;
  setVariableValue: (value: string) => void;
  variableSecret: boolean;
  setVariableSecret: (value: boolean) => void;
  variableDescription: string;
  setVariableDescription: (value: string) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (variable: BrowserFunctionVariable) => void;
}) {
  return (
    <div className="mt-5 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5">
      <div>
        <h3 className="m-0 text-lg font-semibold">Encrypted variables</h3>
        <p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">
          Secret values are write-only and never returned by the API.
        </p>
      </div>
      {canManage ? (
        <form
          onSubmit={onCreate}
          className="mt-4 grid gap-3 md:grid-cols-2"
          noValidate
        >
          <Field label="Key">
            <input
              required
              value={variableKey}
              onChange={(event) => setVariableKey(event.target.value)}
              disabled={pending}
              className={inputClass()}
              placeholder="DATABASE_URL"
            />
          </Field>
          <Field label="Value">
            <input
              required
              type="password"
              value={variableValue}
              onChange={(event) => setVariableValue(event.target.value)}
              disabled={pending}
              className={inputClass()}
            />
          </Field>
          <Field label="Description">
            <input
              value={variableDescription}
              onChange={(event) => setVariableDescription(event.target.value)}
              disabled={pending}
              className={inputClass()}
              placeholder="Used by the API worker"
            />
          </Field>
          <label className="flex items-end gap-2 pb-2 text-xs text-[var(--projects-text)]">
            <input
              type="checkbox"
              checked={variableSecret}
              onChange={(event) => setVariableSecret(event.target.checked)}
              disabled={pending}
              className="accent-[var(--projects-accent)]"
            />
            Store as encrypted secret
            <button
              type="submit"
              disabled={pending}
              className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-xs font-semibold text-white disabled:opacity-50"
            >
              <Plus size={13} aria-hidden="true" />
              Add variable
            </button>
          </label>
        </form>
      ) : null}
      {loading ? (
        <p className="m-0 mt-5 text-sm text-[var(--projects-muted)]">
          Loading variables…
        </p>
      ) : variables.length ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--projects-border)]">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] uppercase tracking-[0.08em] text-[var(--projects-muted)]">
              <tr>
                <th scope="col" className="px-3 py-2">
                  Key
                </th>
                <th scope="col" className="px-3 py-2">
                  Kind
                </th>
                <th scope="col" className="px-3 py-2">
                  Value
                </th>
                <th scope="col" className="px-3 py-2">
                  Updated
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--projects-divider)]">
              {variables.map((variable) => (
                <tr key={variable.id}>
                  <td className="px-3 py-3 font-mono">{variable.key}</td>
                  <td className="px-3 py-3 text-[var(--projects-muted)]">
                    {variable.kind}
                  </td>
                  <td className="px-3 py-3 text-[var(--projects-muted)]">
                    {variable.has_value ? "••••••••" : "empty"}
                  </td>
                  <td className="px-3 py-3 text-[var(--projects-muted)]">
                    {formatDate(variable.updated_at)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => onDelete(variable)}
                        disabled={pending}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 px-2 py-1 text-rose-200"
                      >
                        <Trash2 size={12} aria-hidden="true" />
                        Delete
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
          No variables configured.
        </p>
      )}
    </div>
  );
}
