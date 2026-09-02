"use client";

import { Boxes, Database, HardDrive, Users } from "lucide-react";
import { AdminHeader, AdminPageBody } from "../components/admin-panel";
import { MetricCard } from "../components/metric-card";
import { StatTile } from "../components/stat-tile";
import { LiveIndicator, UpdatedLabel } from "../components/live-indicator";
import { useAdminHealth } from "../hooks/use-admin-health";
import { SystemStatus } from "./system-status";
import { ResourceOverview } from "./resource-overview";
import { ServiceHealthTable } from "./service-health-table";
import { RecentIncidents } from "./recent-incidents";
import { RecentRuns } from "./recent-runs";
import type { AgentRun } from "../types/runs";
import type { AdminOverviewSnapshot } from "./admin-overview-types";
import type { Incident } from "../types/incidents";

/**
 * Admin Overview — live workspace aggregates and platform health.
 * Current resource usage, Agent runs, and organization incidents are durable;
 * historical host charts remain unavailable until their query contracts exist.
 */
export function AdminOverview({ snapshot, recentRuns, unavailableAgents, recentIncidents }: { snapshot: AdminOverviewSnapshot; recentRuns: AgentRun[]; unavailableAgents: number; recentIncidents: Incident[] }) {
  const health = useAdminHealth();

  return (
    <AdminPageBody>
      <AdminHeader title="Admin Overview" subtitle="Live workspace aggregates, platform health, and telemetry.">
        <LiveIndicator label="API live · usage connected" />
      </AdminHeader>

      <SystemStatus health={health} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Users}
          label="Application users"
          value={formatCount(snapshot.applicationUsers)}
          hint={`${formatCount(snapshot.projects)} projects`}
        />
        <MetricCard
          icon={Database}
          label="Database rows"
          value={formatCount(snapshot.databaseRowCount)}
          hint={`${formatCount(snapshot.databaseCount)} databases`}
        />
        <MetricCard
          icon={HardDrive}
          label="Storage"
          value={formatBytes(snapshot.storageBytes)}
          hint={`of ${formatBytes(snapshot.storageQuotaBytes)}`}
        />
        <MetricCard
          icon={Boxes}
          label="Functions + sites"
          value={formatCount(snapshot.functionCount + snapshot.siteCount)}
          hint={`${formatCount(snapshot.functionCount)} fn · ${formatCount(snapshot.siteCount)} sites`}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="m-0 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--projects-muted)]">
            Workspace footprint
          </h2>
          <span className="flex items-center gap-3 text-[11px] text-[var(--projects-muted)]">
            <span>{snapshot.capturedAt ? `Usage snapshot ${formatSnapshotTime(snapshot.capturedAt)}` : "Usage snapshot unavailable"}</span>
            <UpdatedLabel />
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Organizations" value={formatCount(snapshot.organizations)} />
          <StatTile label="Projects" value={formatCount(snapshot.projects)} />
          <StatTile label="Database tables" value={formatCount(snapshot.databaseTableCount)} />
          <StatTile label="Storage files" value={formatCount(snapshot.storageFileCount)} />
          <StatTile label="Realtime events" value={formatCount(snapshot.realtimeEventCount)} />
          <StatTile label="Webhook deliveries · 7d" value={formatCount(snapshot.webhookDeliveryCount7d)} />
          <StatTile label="Function artifacts" value={formatBytes(snapshot.functionArtifactBytes)} hint={`/ ${formatBytes(snapshot.functionQuotaBytes)}`} />
          <StatTile
            label="Usage coverage"
            value={`${formatCount(snapshot.projects - snapshot.unavailableProjects)} / ${formatCount(snapshot.projects)}`}
            hint="projects"
            tone={snapshot.unavailableProjects === 0 ? "success" : "warning"}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ResourceOverview snapshot={snapshot} className="lg:col-span-2" />
        <RecentIncidents incidents={recentIncidents} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ServiceHealthTable health={health} />
        <RecentRuns runs={recentRuns} unavailableAgents={unavailableAgents} />
      </div>
    </AdminPageBody>
  );
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
