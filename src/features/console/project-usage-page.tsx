import { notFound, redirect } from "next/navigation";
import { Database, FileText, HardDrive, Radio, Server, Users, Webhook } from "lucide-react";
import { StealthAPIError, stealthAPI, type ProjectUsage } from "@/lib/stealth-api";

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  const units = ["KiB", "MiB", "GiB", "TiB"];
  let amount = value;
  let unit = "B";
  for (const candidate of units) {
    amount /= 1024;
    unit = candidate;
    if (amount < 1024 || candidate === units.at(-1)) break;
  }
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(amount)} ${unit}`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function usagePercent(used: number, limit: number) {
  if (limit <= 0) return 0;
  return Math.min(100, Math.max(0, (used / limit) * 100));
}

function UsageCard({ icon: Icon, label, value, detail, percent }: { icon: typeof Users; label: string; value: string; detail: string; percent?: number }) {
  return (
    <article className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5">
      <div className="flex items-start justify-between gap-3"><div><p className="m-0 text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--projects-muted)]">{label}</p><p className="m-0 mt-3 text-[26px] font-semibold tracking-[-0.04em] text-[var(--projects-text)]">{value}</p></div><span className="flex size-9 items-center justify-center rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] text-[var(--projects-accent)]"><Icon size={17} aria-hidden="true" /></span></div>
      <p className="m-0 mt-2 text-[12px] text-[var(--projects-muted)]">{detail}</p>
      {percent !== undefined ? <div className="mt-4"><div className="h-1.5 overflow-hidden rounded-full bg-[var(--projects-control)]"><span className={`block h-full rounded-full ${percent >= 90 ? "bg-rose-400" : percent >= 75 ? "bg-amber-300" : "bg-[var(--projects-accent)]"}`} style={{ width: `${percent}%` }} /></div><p className="m-0 mt-1 text-right text-[10px] text-[var(--projects-muted)]">{percent.toFixed(1)}% used</p></div> : null}
    </article>
  );
}

function UsageGrid({ usage }: { usage: ProjectUsage }) {
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <UsageCard icon={Users} label="Application users" value={formatCount(usage.application_users)} detail="Identities in this project" />
      <UsageCard icon={Database} label="Database" value={formatCount(usage.database_row_count)} detail={`${formatCount(usage.database_count)} databases · ${formatCount(usage.database_table_count)} tables`} />
      <UsageCard icon={FileText} label="Storage files" value={formatCount(usage.storage_file_count)} detail={`${formatBytes(usage.storage_bytes)} of ${formatBytes(usage.storage_quota_bytes)} bucket quota`} percent={usagePercent(usage.storage_bytes, usage.storage_quota_bytes)} />
      <UsageCard icon={Server} label="Functions" value={formatCount(usage.function_count)} detail={`${formatBytes(usage.function_artifact_bytes)} of ${formatBytes(usage.function_quota_bytes)} artifact quota`} percent={usagePercent(usage.function_artifact_bytes, usage.function_quota_bytes)} />
      <UsageCard icon={HardDrive} label="Sites" value={formatCount(usage.site_count)} detail={`${formatBytes(usage.site_artifact_bytes)} published · ${formatBytes(usage.site_reserved_bytes)} reserved`} percent={usagePercent(usage.site_artifact_bytes + usage.site_reserved_bytes, usage.site_quota_bytes)} />
      <UsageCard icon={Radio} label="Realtime events" value={formatCount(usage.realtime_event_count)} detail="Events retained in the seven-day stream" />
      <UsageCard icon={Webhook} label="Webhook deliveries" value={formatCount(usage.webhook_delivery_count_7d)} detail="Retained delivery records from the last seven days" />
    </div>
  );
}

export async function ProjectUsagePage({ projectId }: { projectId: string }) {
  try {
    const { usage } = await stealthAPI.projectUsage(projectId);
    return (
      <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--projects-border)] pb-6">
          <div><p className="m-0 font-mono text-[12px] text-[var(--projects-muted)]">project: {projectId}</p><h1 className="m-0 mt-2 text-[28px] font-semibold tracking-[-0.035em] text-[var(--projects-text)]">Usage</h1><p className="m-0 mt-2 max-w-2xl text-[14px] leading-6 text-[var(--projects-muted)]">Current tenant-owned resource totals from PostgreSQL. These values are a live snapshot, not simulated billing estimates.</p></div>
          <time dateTime={usage.captured_at} className="rounded-full border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-1.5 text-[11px] text-[var(--projects-muted)]">Captured {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(usage.captured_at))}</time>
        </header>
        <UsageGrid usage={usage} />
        <p className="m-0 mt-6 text-[11px] leading-5 text-[var(--projects-muted)]">Storage, Functions, and Sites percentages use the sum of project quotas. Network egress, compute time, and billing invoices will be added when durable metering is available.</p>
      </section>
    );
  } catch (error) {
    if (error instanceof StealthAPIError && error.status === 401) redirect("/login");
    if (error instanceof StealthAPIError && error.status === 404) notFound();
    return <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10"><div role="alert" className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-5 py-6"><p className="m-0 text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--projects-muted)]">Usage</p><h1 className="m-0 mt-2 text-[22px] font-semibold tracking-[-0.03em] text-[var(--projects-text)]">Unable to load project usage</h1><p className="m-0 mt-2 max-w-xl text-[14px] leading-6 text-[var(--projects-muted)]">The Stealth API did not return the project usage snapshot. Refresh the page and try again.</p></div></section>;
  }
}
