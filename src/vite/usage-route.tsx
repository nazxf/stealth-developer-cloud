import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, Download, Gauge, HardDrive, LoaderCircle, RefreshCcw, Users, Workflow } from "lucide-react";
import { Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { browserAPI, browserAPIErrorMessage, type BrowserProjectUsageDay } from "@/lib/browser-api";
import { ErrorState as AsyncErrorState } from "./error-state";

const rangeOptions = [7, 30, 90, 365] as const;
type RangeDays = (typeof rangeOptions)[number];

function dateBounds(days: RangeDays) {
  const today = new Date();
  const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - days + 1);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function number(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function bytes(value: number) {
  if (value < 1024) return `${number(value)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let amount = value;
  let index = -1;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  return `${amount.toFixed(amount >= 10 ? 0 : 1)} ${units[index]}`;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function dateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
}

export default function UsageRoute() {
  const { projectId } = useParams({ from: "/projects/$projectId/usage" });
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);
  const [downloadPending, setDownloadPending] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const bounds = dateBounds(rangeDays);
  const projectQuery = useQuery({ queryKey: ["project", projectId], queryFn: () => browserAPI.project(projectId) });
  const usageQuery = useQuery({ queryKey: ["project-usage", projectId], queryFn: () => browserAPI.projectUsage(projectId) });
  const meteringQuery = useQuery({
    queryKey: ["project-usage-metering", projectId, bounds.from, bounds.to],
    queryFn: () => browserAPI.projectUsageMetering(projectId, bounds),
  });

  async function downloadCSV() {
    if (downloadPending) return;
    setDownloadPending(true);
    setDownloadError("");
    try {
      const blob = await browserAPI.downloadProjectUsageMetering(projectId, bounds);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `stealth-usage-${projectId}-${bounds.from}-to-${bounds.to}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadError(browserAPIErrorMessage(error, "Unable to download the usage export."));
    } finally {
      setDownloadPending(false);
    }
  }

  if (projectQuery.isPending || usageQuery.isPending || meteringQuery.isPending) return <StateCard title="Loading project usage…" />;
  const error = projectQuery.error ?? usageQuery.error ?? meteringQuery.error;
  if (error) return <AsyncErrorState error={error} fallback="The Go API did not return usage data." />;
  if (!projectQuery.data || !usageQuery.data || !meteringQuery.data) return <AsyncErrorState error={null} fallback="The API returned an incomplete usage response." />;

  const project = projectQuery.data.project;
  const usage = usageQuery.data.usage;
  const metering = meteringQuery.data.metering;
  const maxRequests = Math.max(...metering.days.map((day) => day.api_request_count), 1);

  return <section>
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--projects-border)] pb-6">
      <div>
        <Link to="/projects/$projectId" params={{ projectId }} className="text-sm text-[var(--projects-accent)] hover:underline">← Project overview</Link>
        <p className="m-0 mt-5 text-xs uppercase tracking-[0.12em] text-[var(--projects-muted)]">Project analytics</p>
        <h1 className="m-0 mt-2 text-3xl font-semibold tracking-[-0.04em]">Usage</h1>
        <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-[var(--projects-muted)]">Live resource footprint plus durable daily API and Function metering for {project.name}.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-[var(--projects-muted)]">Window<select value={rangeDays} onChange={(event) => setRangeDays(Number(event.target.value) as RangeDays)} className="ml-2 h-9 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-2 text-xs text-[var(--projects-text)]" aria-label="Usage window">{rangeOptions.map((days) => <option key={days} value={days}>Last {days} days</option>)}</select></label>
        <button type="button" onClick={() => void meteringQuery.refetch()} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-xs font-semibold hover:border-[var(--projects-border-hover)]"><RefreshCcw size={14} aria-hidden="true" />Refresh</button>
        <button type="button" onClick={() => void downloadCSV()} disabled={downloadPending} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-xs font-semibold text-white hover:bg-[var(--projects-accent-hover)] disabled:opacity-60">{downloadPending ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <Download size={14} aria-hidden="true" />}{downloadPending ? "Preparing…" : "Export CSV"}</button>
      </div>
    </div>
    {downloadError ? <p role="alert" className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{downloadError}</p> : null}
    <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={<Users size={17} />} label="Application users" value={number(usage.application_users)} detail="Current identities" />
      <Metric icon={<HardDrive size={17} />} label="Storage" value={`${bytes(usage.storage_bytes)} / ${bytes(usage.storage_quota_bytes)}`} detail={`${number(usage.storage_file_count)} files`} />
      <Metric icon={<Workflow size={17} />} label="Functions + sites" value={number(usage.function_count + usage.site_count)} detail={`${number(usage.function_count)} functions · ${number(usage.site_count)} sites`} />
      <Metric icon={<Activity size={17} />} label="Retained events" value={number(usage.realtime_event_count)} detail={`${number(usage.webhook_delivery_count_7d)} webhook deliveries / 7d`} />
    </div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
      <section className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="m-0 text-lg font-semibold">Daily API requests</h2><p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">{metering.from} through {metering.to} · empty days are omitted by the API</p></div><Gauge size={19} className="text-[var(--projects-accent)]" aria-hidden="true" /></div>
        {metering.days.length ? <div className="mt-6 flex h-40 items-end gap-1 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 pb-3 pt-5" role="img" aria-label="Daily API request bar chart">{metering.days.map((day) => <div key={day.date} className="group flex h-full min-w-0 flex-1 flex-col justify-end" title={`${day.date}: ${number(day.api_request_count)} requests`}><div className="min-h-1 rounded-t bg-[var(--projects-accent)] transition-[height]" style={{ height: `${Math.max((day.api_request_count / maxRequests) * 100, 2)}%` }} /><span className="mt-1 truncate text-center text-[9px] text-[var(--projects-muted)] group-last:text-[var(--projects-text)]">{dateLabel(day.date)}</span></div>)}</div> : <div className="mt-6 grid min-h-40 place-items-center rounded-lg border border-dashed border-[var(--projects-border)] text-sm text-[var(--projects-muted)]">No metering recorded in this window.</div>}
      </section>
      <section className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><div className="flex items-center gap-2"><BarChart3 size={18} className="text-[var(--projects-accent)]" aria-hidden="true" /><h2 className="m-0 text-lg font-semibold">Window totals</h2></div><div className="mt-4 divide-y divide-[var(--projects-divider)]"><Total label="API requests" value={number(metering.totals.api_request_count)} /><Total label="Egress" value={bytes(metering.totals.api_egress_bytes)} /><Total label="Function invocations" value={number(metering.totals.function_invocation_count)} /><Total label="Function failures" value={number(metering.totals.function_failure_count)} tone={metering.totals.function_failure_count ? "warning" : undefined} /><Total label="Compute time" value={`${number(metering.totals.function_compute_ms)} ms`} /></div></section>
    </div>
    <section className="mt-6 overflow-hidden rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--projects-divider)] px-5 py-4"><div><h2 className="m-0 text-lg font-semibold">Daily breakdown</h2><p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">Captured at {dateTimeLabel(usage.captured_at)}</p></div><span className="text-xs text-[var(--projects-muted)]">{metering.days.length} populated days</span></div>{metering.days.length ? <div className="max-h-[28rem] overflow-auto"><table className="w-full min-w-[760px] text-left text-sm"><caption className="sr-only">Daily usage metering</caption><thead className="sticky top-0 border-b border-[var(--projects-divider)] bg-[var(--projects-control)] text-xs uppercase tracking-[0.08em] text-[var(--projects-muted)]"><tr><th scope="col" className="px-5 py-3">Date</th><th scope="col" className="px-5 py-3">API requests</th><th scope="col" className="px-5 py-3">Egress</th><th scope="col" className="px-5 py-3">Invocations</th><th scope="col" className="px-5 py-3">Failures</th><th scope="col" className="px-5 py-3">Compute</th></tr></thead><tbody className="divide-y divide-[var(--projects-divider)]">{metering.days.map((day) => <UsageRow key={day.date} day={day} />)}</tbody></table></div> : <p className="m-0 p-10 text-center text-sm text-[var(--projects-muted)]">No daily records yet.</p>}</section>
  </section>;
}

function UsageRow({ day }: { day: BrowserProjectUsageDay }) {
  return <tr><td className="px-5 py-3 font-mono text-xs">{day.date}</td><td className="px-5 py-3">{number(day.api_request_count)}</td><td className="px-5 py-3 text-[var(--projects-muted)]">{bytes(day.api_egress_bytes)}</td><td className="px-5 py-3">{number(day.function_invocation_count)}</td><td className="px-5 py-3">{number(day.function_failure_count)}</td><td className="px-5 py-3 text-[var(--projects-muted)]">{number(day.function_compute_ms)} ms</td></tr>;
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <div className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-4"><span className="inline-flex size-8 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--projects-accent)_12%,transparent)] text-[var(--projects-accent)]">{icon}</span><p className="m-0 mt-3 text-[11px] uppercase tracking-[0.1em] text-[var(--projects-muted)]">{label}</p><p className="m-0 mt-1 truncate font-mono text-lg font-semibold">{value}</p><p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">{detail}</p></div>;
}

function Total({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  return <div className="flex items-center justify-between gap-3 py-3 text-sm first:pt-0 last:pb-0"><span className="text-[var(--projects-muted)]">{label}</span><span className={tone === "warning" ? "font-mono text-amber-200" : "font-mono"}>{value}</span></div>;
}

function StateCard({ title, detail, error = false }: { title: string; detail?: string; error?: boolean }) {
  return <div className={`grid min-h-[18rem] place-items-center rounded-xl border bg-[var(--projects-card-bg)] p-8 text-center ${error ? "border-[var(--projects-danger)]/40" : "border-[var(--projects-border)]"}`} role={error ? "alert" : undefined}><div><p className="m-0 font-semibold">{title}</p>{detail ? <p className="m-0 mt-2 text-sm text-[var(--projects-muted)]">{detail}</p> : null}</div></div>;
}
