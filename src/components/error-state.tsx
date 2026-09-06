import { RotateCcw } from "lucide-react";
import { browserAPIErrorMessage } from "@/lib/browser-api";

type ErrorStateProps = {
  error: unknown;
  fallback?: string;
  onRetry?: () => void;
};

/** Shared async failure state with a safe message and an explicit retry path. */
export function ErrorState({ error, fallback = "Unable to load this view.", onRetry }: ErrorStateProps) {
  const message = browserAPIErrorMessage(error, fallback);
  return (
    <div role="alert" className="rounded-xl border border-[var(--projects-danger)]/40 bg-[var(--projects-card-bg)] p-6 text-sm text-[var(--projects-text)]">
      <p className="m-0 font-semibold">Something went wrong</p>
      <p className="m-0 mt-2 text-[var(--projects-muted)]">{message}</p>
      <button
        type="button"
        onClick={onRetry ?? (() => window.location.reload())}
        className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-xs font-semibold hover:border-[var(--projects-border-hover)]"
      >
        <RotateCcw size={14} aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}
