import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StealthAPIError, stealthAPI } from "@/lib/stealth-api";
import { UsagePanel } from "@/features/projects/usage-panel";

export default async function ProjectOverviewPage({
  params,
}: Readonly<{ params: Promise<{ projectId: string }> }>) {
  const { projectId } = await params;
  let project;
  let usage;
  try {
    // The project identity and its aggregate usage are independent reads; do
    // them together so the overview does not add a serial network waterfall.
    [{ project }, { usage }] = await Promise.all([
      stealthAPI.project(projectId),
      stealthAPI.projectUsage(projectId),
    ]);
  } catch (error) {
    if (error instanceof StealthAPIError && error.status === 401) redirect("/login");
    notFound();
  }
  const usageCards: Array<{ label: string; value: number; resource: string }> = [
    { label: "Auth identities", value: usage.application_users, resource: "auth" },
    { label: "Databases", value: usage.database_count, resource: "databases" },
    { label: "Storage files", value: usage.storage_file_count, resource: "storage" },
    { label: "Functions", value: usage.function_count, resource: "functions" },
    { label: "Sites", value: usage.site_count, resource: "sites" },
    { label: "Webhook deliveries · 7d", value: usage.webhook_delivery_count_7d, resource: "webhooks" },
  ];

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-start justify-between gap-5 border-b border-[var(--projects-border)] pb-6">
        <div>
          <p className="m-0 text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--projects-muted)]">Project overview</p>
          <h1 className="m-0 mt-2 break-words text-[30px] font-semibold tracking-[-0.04em] text-[var(--projects-text)]">{project.name}</h1>
          <p className="m-0 mt-2 font-mono text-xs text-[var(--projects-muted)]">Organization {project.organization_id}</p>
          <p className="m-0 mt-3 max-w-2xl text-[14px] leading-6 text-[var(--projects-muted)]">A live view of the resources in this project. Use the project navigation to manage Auth identities, Databases, Storage, Functions, Sites, Realtime, and Webhooks.</p>
        </div>
        <Link href={`/projects/${encodeURIComponent(projectId)}/deployments`} className="inline-flex h-10 shrink-0 items-center rounded-[10px] border border-[var(--projects-accent-border)] bg-[var(--projects-accent-strong)] px-4 text-[13px] font-semibold text-white outline-none transition-colors hover:bg-[var(--projects-accent-hover)] focus-visible:ring-2 focus-visible:ring-[var(--projects-accent)]">Open deployments</Link>
      </header>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {usageCards.map(({ label, value, resource }) => (
          <Link
            key={resource}
            href={`/projects/${encodeURIComponent(projectId)}/${resource}`}
            className="rounded-lg border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-4 outline-none transition-colors hover:border-[var(--projects-border-hover)] focus-visible:ring-2 focus-visible:ring-[var(--projects-accent)]"
          >
            <p className="m-0 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--projects-muted)]">{label}</p>
            <p className="m-0 mt-2 font-mono text-[24px] font-semibold tabular-nums text-[var(--projects-text)]">{new Intl.NumberFormat("en-US").format(value)}</p>
            <span className="mt-2 inline-block text-[11px] text-[var(--projects-accent)]">Open resource →</span>
          </Link>
        ))}
      </div>

      <UsagePanel usage={usage} />
    </section>
  );
}
