import { LoaderCircle, Plus, X } from "lucide-react";
import type { FormEvent } from "react";
import { type BrowserFunctionRuntime } from "@/lib/api/browser-api";
import { Field, inputClass, runtimes } from "./function-ui";

export function CreateFunctionDialog({
  pending,
  name,
  setName,
  runtime,
  setRuntime,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  name: string;
  setName: (value: string) => void;
  runtime: BrowserFunctionRuntime;
  setRuntime: (value: BrowserFunctionRuntime) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-function-title"
        className="w-full max-w-md rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5 shadow-2xl shadow-black/40"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="create-function-title"
              className="m-0 text-lg font-semibold"
            >
              Create function
            </h2>
            <p className="m-0 mt-1 text-sm text-[var(--projects-muted)]">
              Start with a worker runtime and deploy source next.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close create function dialog"
            className="inline-flex size-8 items-center justify-center rounded-md text-[var(--projects-muted)] hover:bg-[var(--projects-control)]"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <Field label="Name">
            <input
              required
              minLength={2}
              maxLength={63}
              pattern="[a-z0-9][a-z0-9-]{1,62}"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={pending}
              className={inputClass()}
              placeholder="api-worker"
            />
          </Field>
          <Field label="Runtime">
            <select
              value={runtime}
              onChange={(event) =>
                setRuntime(event.target.value as BrowserFunctionRuntime)
              }
              disabled={pending}
              className={inputClass()}
            >
              {runtimes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex justify-end gap-2 border-t border-[var(--projects-divider)] pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="h-9 rounded-lg border border-[var(--projects-border)] px-3 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? (
                <LoaderCircle
                  size={14}
                  className="animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Plus size={14} aria-hidden="true" />
              )}
              {pending ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
