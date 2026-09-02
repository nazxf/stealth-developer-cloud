"use client";

import type { ReactNode } from "react";
import { Boxes, Database, HardDrive, RadioTower, Users, Webhook } from "lucide-react";
import { AdminHeader, AdminPageBody, AdminPanel, AdminPanelHeader, Mono } from "../components/admin-panel";
import { StatTile } from "../components/stat-tile";
import { ResourceBar } from "../components/resource-bar";
import type { AdminOverviewSnapshot } from "../overview/admin-overview-types";

/** Usage — current workspace aggregates from PostgreSQL-backed project usage. */
export function UsagePage({ snapshot }: { snapshot: AdminOverviewSnapshot }) {
  const storagePercent = ratio(snapshot.storageBytes, snapshot.storageQuotaBytes);
  const functionPercent = ratio(snapshot.functionArtifactBytes, snapshot.functionQuotaBytes);
  const sitePercent = ratio(snapshot.siteArtifactBytes + snapshot.siteReservedBytes, snapshot.siteQuotaBytes);

  return (
    <AdminPageBody>
      <AdminHeader title="Usage" subtitle="Current resource footprint across the authenticated workspace." />

      {snapshot.unavailableProjects > 0 && (
        <p className="m-0 rounded-lg border border-[color-mix(in_srgb,var(--projects-warning)_40%,var(--projects-border))] bg-[color-mix(in_srgb,var(--projects-warning)_7%,#141416)] px-3.5 py-3 text-[12.5px] leading-5 text-[var(--projects-warning)]">
          {snapshot.unavailableProjects} of {snapshot.projects} project usage snapshots were unavailable. Totals include only projects read successfully.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile icon={Users} label="Application users" value={formatCount(snapshot.applicationUsers)} />
        <StatTile icon={Database} label="Database rows" value={formatCount(snapshot.databaseRowCount)} />
        <StatTile icon={HardDrive} label="Storage bytes" value={formatBytes(snapshot.storageBytes)} />
        <StatTile icon={Boxes} label="Functions + sites" value={formatCount(snapshot.functionCount + snapshot.siteCount)} />
      </div>

      <AdminPanel>
        <AdminPanelHeader title="Capacity" subtitle="Durable artifact and file quotas reported by each project." />
        <div className="grid gap-5 md:grid-cols-3">
          <ResourceBar label="Storage" value={storagePercent} detail={`${formatBytes(snapshot.storageBytes)} / ${formatBytes(snapshot.storageQuotaBytes)}`} />
          <ResourceBar label="Function artifacts" value={functionPercent} detail={`${formatBytes(snapshot.functionArtifactBytes)} / ${formatBytes(snapshot.functionQuotaBytes)}`} />
          <ResourceBar label="Site artifacts" value={sitePercent} detail={`${formatBytes(snapshot.siteArtifactBytes + snapshot.siteReservedBytes)} / ${formatBytes(snapshot.siteQuotaBytes)}`} />
        </div>
      </AdminPanel>

      <AdminPanel flush>
        <div className="px-4 pb-3 pt-4">
          <AdminPanelHeader title="Resource footprint" subtitle={snapshot.capturedAt ? `Usage snapshots through ${formatSnapshotTime(snapshot.capturedAt)}.` : "No usage snapshot timestamp was returned."} />
        </div>
        <div className="admin-scrollbar overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-y border-[var(--projects-divider)] bg-[var(--projects-control)]">
                <Th>Resource</Th>
                <Th>Current</Th>
                <Th>Supporting detail</Th>
              </tr>
            </thead>
            <tbody>
              <Row icon={Users} label="Application users" value={formatCount(snapshot.applicationUsers)} detail="project identities" />
              <Row icon={Database} label="Databases" value={formatCount(snapshot.databaseCount)} detail={`${formatCount(snapshot.databaseTableCount)} tables · ${formatCount(snapshot.databaseRowCount)} rows`} />
              <Row icon={HardDrive} label="Storage" value={formatBytes(snapshot.storageBytes)} detail={`${formatCount(snapshot.storageFileCount)} files · quota ${formatBytes(snapshot.storageQuotaBytes)}`} />
              <Row icon={Boxes} label="Functions" value={formatCount(snapshot.functionCount)} detail={`${formatBytes(snapshot.functionArtifactBytes)} artifacts · quota ${formatBytes(snapshot.functionQuotaBytes)}`} />
              <Row icon={RadioTower} label="Sites" value={formatCount(snapshot.siteCount)} detail={`${formatBytes(snapshot.siteArtifactBytes + snapshot.siteReservedBytes)} published/reserved · quota ${formatBytes(snapshot.siteQuotaBytes)}`} />
              <Row icon={Webhook} label="Webhook deliveries" value={formatCount(snapshot.webhookDeliveryCount7d)} detail="last 7 days" />
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </AdminPageBody>
  );
}

function Row({ icon: Icon, label, value, detail }: { icon: typeof Users; label: string; value: string; detail: string }) {
  return (
    <tr className="border-b border-[var(--projects-divider)] last:border-b-0 hover:bg-white/[0.02]">
      <Td><span className="flex items-center gap-2.5"><span className="flex size-7 items-center justify-center rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] text-[var(--projects-muted)]"><Icon size={14} strokeWidth={1.8} aria-hidden="true" /></span><span className="text-[12.5px] text-[var(--projects-text)]">{label}</span></span></Td>
      <Td><Mono className="text-[12px] text-[var(--projects-text)]">{value}</Mono></Td>
      <Td><span className="text-[12px] text-[var(--projects-muted)]">{detail}</span></Td>
    </tr>
  );
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

function formatSnapshotTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "unknown" : `${date.toISOString().slice(0, 16).replace("T", " ")}Z`;
}

function Th({ children }: { children: ReactNode }) {
  return <th scope="col" className="px-3.5 py-2 text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--projects-muted)]">{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-3.5 py-2.5">{children}</td>;
}
