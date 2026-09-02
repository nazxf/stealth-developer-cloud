import { Database, FileText, HardDrive, Users } from "lucide-react";
import { AdminPanel, AdminPanelHeader } from "../components/admin-panel";
import { ResourceBar } from "../components/resource-bar";
import type { AdminOverviewSnapshot } from "./admin-overview-types";

/** Current workspace footprint backed by the project usage aggregates. */
export function ResourceOverview({ snapshot, className }: { snapshot: AdminOverviewSnapshot; className?: string }) {
  const siteBytes = snapshot.siteArtifactBytes + snapshot.siteReservedBytes;
  return (
    <AdminPanel className={className}>
      <AdminPanelHeader title="Workspace resources" subtitle="Current PostgreSQL-backed usage and quota aggregates across the authenticated workspace." />
      <div className="grid gap-4 sm:grid-cols-3">
        <ResourceBar label="Storage" value={ratio(snapshot.storageBytes, snapshot.storageQuotaBytes)} detail={`${formatBytes(snapshot.storageBytes)} / ${formatBytes(snapshot.storageQuotaBytes)}`} />
        <ResourceBar label="Function artifacts" value={ratio(snapshot.functionArtifactBytes, snapshot.functionQuotaBytes)} detail={`${formatBytes(snapshot.functionArtifactBytes)} / ${formatBytes(snapshot.functionQuotaBytes)}`} />
        <ResourceBar label="Site artifacts" value={ratio(siteBytes, snapshot.siteQuotaBytes)} detail={`${formatBytes(siteBytes)} / ${formatBytes(snapshot.siteQuotaBytes)}`} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Footprint icon={Database} label="Database footprint" value={`${formatCount(snapshot.databaseRowCount)} rows`} detail={`${formatCount(snapshot.databaseCount)} databases · ${formatCount(snapshot.databaseTableCount)} tables`} />
        <Footprint icon={FileText} label="Published artifacts" value={`${formatCount(snapshot.functionCount + snapshot.siteCount)} resources`} detail={`${formatCount(snapshot.functionCount)} Functions · ${formatCount(snapshot.siteCount)} Sites`} />
        <Footprint icon={Users} label="Application users" value={formatCount(snapshot.applicationUsers)} detail="Across all projects" />
        <Footprint icon={HardDrive} label="Storage files" value={formatCount(snapshot.storageFileCount)} detail={`${formatBytes(snapshot.storageBytes)} stored`} />
      </div>
      <p className="m-0 mt-4 border-t border-[var(--projects-divider)] pt-3 text-[11.5px] leading-5 text-[var(--projects-muted)]">CPU, memory, network, and historical time-series metrics are not persisted by the current tenant API and are intentionally not estimated here.</p>
    </AdminPanel>
  );
}

function Footprint({ icon: Icon, label, value, detail }: { icon: typeof Database; label: string; value: string; detail: string }) {
  return <article className="flex min-w-0 items-start gap-2.5 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] p-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-[var(--projects-border)] bg-[var(--projects-card-bg)] text-[var(--projects-muted)]"><Icon size={14} aria-hidden="true" /></span><div className="min-w-0"><p className="m-0 text-[10.5px] uppercase tracking-[0.06em] text-[var(--projects-muted)]">{label}</p><p className="m-0 mt-0.5 truncate text-[14px] font-semibold text-[var(--projects-text)]">{value}</p><p className="m-0 mt-0.5 truncate text-[11px] text-[var(--projects-muted)]">{detail}</p></div></article>;
}

function ratio(value: number, quota: number) {
  if (!Number.isFinite(value) || !Number.isFinite(quota) || quota <= 0) return 0;
  return Math.min(100, Math.max(0, (value / quota) * 100));
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(Math.max(0, value));
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** exponent;
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: amount >= 100 ? 0 : 1 }).format(amount)} ${units[exponent]}`;
}
