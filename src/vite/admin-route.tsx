import { Link } from "@tanstack/react-router";

export default function AdminRoute() {
  return (
    <section>
      <p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--projects-muted)]">Operations</p>
      <h1 className="m-0 mt-2 text-3xl font-semibold">Admin workspace</h1>
      <p className="m-0 mt-3 max-w-2xl text-sm leading-6 text-[var(--projects-muted)]">
        Admin pages are being moved to lazy Vite routes. The Go health, metrics,
        traces, and worker APIs remain the source of truth.
      </p>
      <div className="mt-6 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5">
        <Link to="/" className="text-sm text-[var(--projects-accent)] hover:underline">Return to projects</Link>
      </div>
    </section>
  );
}

