import type { ProjectUsage } from "@/lib/stealth-api";

type UsageRow = {
  label: string;
  value: string;
  limit: string;
  percent?: number;
};

const numberFormatter = new Intl.NumberFormat("en-US");
const byteFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

function formatCount(value: number) {
  return numberFormatter.format(value);
}

function formatBytes(value: number) {
  if (value < 1024) return `${formatCount(value)} B`;
  const units = ["KiB", "MiB", "GiB", "TiB"];
  let amount = value;
  let unit = "B";
  for (const candidate of units) {
    amount /= 1024;
    unit = candidate;
    if (amount < 1024 || candidate === units.at(-1)) break;
  }
  return `${byteFormatter.format(amount)} ${unit}`;
}

function percent(used: number, limit: number) {
  if (limit <= 0) return undefined;
  return Math.min(100, Math.max(0, (used / limit) * 100));
}

function rowsFor(usage: ProjectUsage): UsageRow[] {
  return [
    { label: "Application users", value: formatCount(usage.application_users), limit: "identities" },
    { label: "Database rows", value: formatCount(usage.database_row_count), limit: `${formatCount(usage.database_count)} databases` },
    {
      label: "File storage",
      value: formatBytes(usage.storage_bytes),
      limit: formatBytes(usage.storage_quota_bytes),
      percent: percent(usage.storage_bytes, usage.storage_quota_bytes),
    },
    {
      label: "Function artifacts",
      value: formatBytes(usage.function_artifact_bytes),
      limit: formatBytes(usage.function_quota_bytes),
      percent: percent(usage.function_artifact_bytes, usage.function_quota_bytes),
    },
  ];
}

export function UsagePanel({ usage }: { usage: ProjectUsage }) {
  const rows = rowsFor(usage);

  return (
    <aside
      aria-labelledby="usage-panel-title"
      className="mt-6 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-[15px]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="usage-panel-title" className="m-0 text-[13px] font-semibold leading-[18px] text-[var(--projects-text)]">
            Resource usage
          </h2>
          <p className="m-0 text-xs leading-4 text-[var(--projects-muted)]">Live PostgreSQL snapshot</p>
        </div>
        <time dateTime={usage.captured_at} className="shrink-0 text-[10px] text-[var(--projects-muted)]">
          {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(usage.captured_at))}
        </time>
      </div>

      <div className="mt-[17px] divide-y divide-dashed divide-[var(--projects-divider)]">
        {rows.map((row) => (
          <div key={row.label} className="flex min-h-[42px] items-center gap-3 py-1.5">
            <span className="size-2.5 shrink-0 rounded-full bg-[var(--projects-accent)]" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate font-mono text-[10px] leading-[14px] tracking-[0.02em] text-[var(--projects-text)]">
              {row.label}
            </span>
            <span className="shrink-0 text-right font-mono text-[10px] leading-[14px]">
              <strong className="font-semibold text-[var(--projects-text)]">{row.value}</strong>
              <span className="px-2 text-[var(--projects-muted)]">/</span>
              <span className="text-[var(--projects-muted)]">{row.limit}</span>
            </span>
            {row.percent !== undefined ? (
              <span className="w-12 shrink-0 text-right text-[10px] tabular-nums text-[var(--projects-muted)]">
                {row.percent.toFixed(1)}%
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </aside>
  );
}
