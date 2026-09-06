type LoadingStateProps = {
  label?: string;
};

/** Shared loading surface for route-level async boundaries. */
export function LoadingState({ label = "Loading Stealth…" }: LoadingStateProps) {
  return (
    <div
      className="grid min-h-[18rem] place-items-center rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] text-sm text-[var(--projects-muted)]"
      aria-live="polite"
    >
      {label}
    </div>
  );
}

type EmptyStateProps = {
  title: string;
  detail: string;
};

/** Shared empty state for route-level collections and not-found views. */
export function EmptyState({ title, detail }: EmptyStateProps) {
  return (
    <div className="mt-6 rounded-xl border border-dashed border-[var(--projects-border)] p-12 text-center">
      <p className="m-0 font-semibold">{title}</p>
      <p className="m-0 mt-2 text-sm text-[var(--projects-muted)]">{detail}</p>
    </div>
  );
}
