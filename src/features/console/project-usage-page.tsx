import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Activity, Clock3, Database, Download, FileText, HardDrive, Play, Radio, Server, Users, Webhook } from "lucide-react";
import { StealthAPIError, stealthAPI, type ProjectUsage, type ProjectUsageMetering } from "@/lib/stealth-api";

export const USAGE_RANGES = [7, 30, 90] as const;
export type UsageRange = (typeof USAGE_RANGES)[number];

const numberFormatter = new Intl.NumberFormat("en-US");
const compactNumberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function usageRangeFromQuery(value: string | string[] | undefined): UsageRange {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "7" ? 7 : candidate === "90" ? 90 : 30;
}

function usageWindow(rangeDays: UsageRange) {
  const now = new Date();
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - rangeDays + 1);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

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
  return numberFormatter.format(value);
}

function formatDuration(value: number) {
  if (value < 1000) return `${formatCount(value)} ms`;
  const seconds = value / 1000;
  if (seconds < 60) return `${compactNumberFormatter.format(seconds)} s`;
  return `${compactNumberFormatter.format(seconds / 60)} min`;
}

function formatUsageDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
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

function MeteringCard({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: string; detail: string }) {
  return (
    <article className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="m-0 text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--projects-muted)]">{label}</p>
          <p className="m-0 mt-3 text-[26px] font-semibold tracking-[-0.04em] text-[var(--projects-text)]">{value}</p>
        </div>
        <span className="flex size-9 items-center justify-center rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] text-[var(--projects-accent)]">
          <Icon size={17} aria-hidden="true" />
        </span>
      </div>
      <p className="m-0 mt-2 text-[12px] text-[var(--projects-muted)]">{detail}</p>
    </article>
  );
}

function MeteringGrid({ usage }: { usage: ProjectUsage }) {
  return (
    <div className="mt-8">
      <div>
        <p className="m-0 text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--projects-muted)]">Durable metering</p>
        <p className="m-0 mt-1 text-[13px] leading-5 text-[var(--projects-muted)]">Rolling 30-day activity recorded transactionally by the API and Function workers.</p>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MeteringCard icon={Activity} label="API requests" value={formatCount(usage.api_request_count_30d)} detail="Requests in the rolling window" />
        <MeteringCard icon={Download} label="API egress" value={formatBytes(usage.api_egress_bytes_30d)} detail="Response bytes in the rolling window" />
        <MeteringCard icon={Play} label="Function invocations" value={formatCount(usage.function_invocation_count_30d)} detail={`${formatCount(usage.function_failure_count_30d)} failed invocations`} />
        <MeteringCard icon={Clock3} label="Function compute" value={formatDuration(usage.function_compute_ms_30d)} detail="Recorded execution time" />
      </div>
    </div>
  );
}

function MeteringTable({ projectId, metering, rangeDays }: { projectId: string; metering: ProjectUsageMetering; rangeDays: UsageRange }) {
  return (
    <section className="mt-8 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5" aria-labelledby="daily-metering-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--projects-divider)] pb-4">
        <div>
          <h2 id="daily-metering-title" className="m-0 text-[17px] font-semibold text-[var(--projects-text)]">Daily metering</h2>
          <p className="m-0 mt-1 text-[12px] leading-5 text-[var(--projects-muted)]">Exact non-empty UTC buckets from {metering.from} through {metering.to}.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <nav aria-label="Usage range" className="flex items-center gap-0.5 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] p-0.5">
            {USAGE_RANGES.map((days) => (
              <Link
                key={days}
                href={`/projects/${encodeURIComponent(projectId)}/usage?range=${days}`}
                scroll={false}
                aria-current={days === rangeDays ? "page" : undefined}
                className={`inline-flex h-7 items-center rounded-md px-2.5 text-[11px] font-medium transition-colors ${days === rangeDays ? "bg-[color-mix(in_srgb,var(--projects-accent)_14%,transparent)] text-[var(--projects-accent)]" : "text-[var(--projects-muted)] hover:text-[var(--projects-text)]"}`}
              >
                {days}d
              </Link>
            ))}
          </nav>
          <span className="rounded-full border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-1.5 text-[11px] text-[var(--projects-muted)]">{metering.days.length} active days</span>
        </div>
      </div>

      {metering.days.length === 0 ? (
        <p className="m-0 px-2 py-10 text-center text-[13px] text-[var(--projects-muted)]">No API requests or Function executions have been metered in this window.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-md border border-[var(--projects-border)]">
          <table className="w-full min-w-[760px] text-left text-[12px]">
            <caption className="sr-only">Daily project API and Function usage</caption>
            <thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] text-[10.5px] uppercase tracking-[0.08em] text-[var(--projects-muted)]">
              <tr>
                <th scope="col" className="px-3 py-2">UTC date</th>
                <th scope="col" className="px-3 py-2 text-right">API requests</th>
                <th scope="col" className="px-3 py-2 text-right">Egress</th>
                <th scope="col" className="px-3 py-2 text-right">Invocations</th>
                <th scope="col" className="px-3 py-2 text-right">Failures</th>
                <th scope="col" className="px-3 py-2 text-right">Compute</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--projects-divider)]">
              {metering.days.map((day) => (
                <tr key={day.date}>
                  <th scope="row" className="px-3 py-2.5 font-mono text-[11px] font-medium text-[var(--projects-text)]">{formatUsageDate(day.date)}</th>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--projects-text)]">{formatCount(day.api_request_count)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--projects-muted)]">{formatBytes(day.api_egress_bytes)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--projects-text)]">{formatCount(day.function_invocation_count)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--projects-muted)]">{formatCount(day.function_failure_count)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--projects-muted)]">{formatDuration(day.function_compute_ms)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-[var(--projects-divider)] bg-[var(--projects-control)] font-semibold">
              <tr>
                <th scope="row" className="px-3 py-2.5 text-[var(--projects-text)]">Total</th>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--projects-text)]">{formatCount(metering.totals.api_request_count)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--projects-text)]">{formatBytes(metering.totals.api_egress_bytes)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--projects-text)]">{formatCount(metering.totals.function_invocation_count)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--projects-text)]">{formatCount(metering.totals.function_failure_count)}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--projects-text)]">{formatDuration(metering.totals.function_compute_ms)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

export async function ProjectUsagePage({ projectId, rangeDays = 30 }: { projectId: string; rangeDays?: UsageRange }) {
  try {
    const meteringWindow = usageWindow(rangeDays);
    const [{ usage }, { metering }] = await Promise.all([
      stealthAPI.projectUsage(projectId),
      stealthAPI.projectUsageMetering(projectId, meteringWindow),
    ]);
    return (
      <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--projects-border)] pb-6">
          <div><p className="m-0 font-mono text-[12px] text-[var(--projects-muted)]">project: {projectId}</p><h1 className="m-0 mt-2 text-[28px] font-semibold tracking-[-0.035em] text-[var(--projects-text)]">Usage</h1><p className="m-0 mt-2 max-w-2xl text-[14px] leading-6 text-[var(--projects-muted)]">Current tenant-owned resource totals from PostgreSQL. These values are a live snapshot, not simulated billing estimates.</p></div>
          <time dateTime={usage.captured_at} className="rounded-full border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-1.5 text-[11px] text-[var(--projects-muted)]">Captured {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(usage.captured_at))}</time>
        </header>
        <UsageGrid usage={usage} />
        <MeteringGrid usage={usage} />
        <MeteringTable projectId={projectId} metering={metering} rangeDays={rangeDays} />
        <p className="m-0 mt-6 text-[11px] leading-5 text-[var(--projects-muted)]">Storage, Functions, and Sites percentages use the sum of project quotas. Metering values are usage facts; plan limits, invoices, and quota enforcement belong to the billing layer.</p>
      </section>
    );
  } catch (error) {
    if (error instanceof StealthAPIError && error.status === 401) redirect("/login");
    if (error instanceof StealthAPIError && error.status === 404) notFound();
    return <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10"><div role="alert" className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-5 py-6"><p className="m-0 text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--projects-muted)]">Usage</p><h1 className="m-0 mt-2 text-[22px] font-semibold tracking-[-0.03em] text-[var(--projects-text)]">Unable to load project usage</h1><p className="m-0 mt-2 max-w-xl text-[14px] leading-6 text-[var(--projects-muted)]">The Stealth API did not return the project usage snapshot. Refresh the page and try again.</p></div></section>;
  }
}
