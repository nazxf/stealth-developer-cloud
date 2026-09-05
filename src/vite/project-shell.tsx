import { Link } from "@tanstack/react-router";
import { Activity, Boxes, Database, Gauge, KeyRound, LayoutDashboard, Mail, Settings2, ShieldCheck, Sparkles, Webhook, Workflow } from "lucide-react";

type NavigationItem = { label: string; resource: string; icon: typeof LayoutDashboard };

const navigationItems: NavigationItem[] = [
  { label: "Overview", resource: "__overview__", icon: LayoutDashboard },
  { label: "Deployments", resource: "deployments", icon: Workflow },
  { label: "Auth", resource: "auth", icon: ShieldCheck },
  { label: "Databases", resource: "databases", icon: Database },
  { label: "Storage", resource: "storage", icon: Boxes },
  { label: "Functions", resource: "functions", icon: Sparkles },
  { label: "Sites", resource: "sites", icon: Activity },
  { label: "Realtime", resource: "realtime", icon: Gauge },
  { label: "Webhooks", resource: "webhooks", icon: Webhook },
  { label: "Messaging", resource: "messaging", icon: Mail },
  { label: "API keys", resource: "api-keys", icon: KeyRound },
  { label: "Settings", resource: "settings", icon: Settings2 },
];

export function ProjectShellNavigation({ projectId }: { projectId: string }) {
  return <aside className="mb-6 lg:mb-0"><div className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-3 lg:sticky lg:top-20"><p className="m-0 px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--projects-muted)]">Project</p><p className="m-0 truncate px-2 pb-3 font-mono text-xs text-[var(--projects-text)]" title={projectId}>{projectId}</p><nav className="flex gap-1 overflow-x-auto lg:block lg:overflow-visible" aria-label="Project navigation">{navigationItems.map(({ label, resource, icon: Icon }) => resource === "__overview__" ? <Link key={resource} to="/projects/$projectId" params={{ projectId }} activeOptions={{ exact: true }} activeProps={{ className: "bg-[color-mix(in_srgb,var(--projects-accent)_12%,transparent)] text-[var(--projects-text)]" }} className="inline-flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-[var(--projects-muted)] transition-colors hover:bg-[var(--projects-control)] hover:text-[var(--projects-text)] lg:flex"><Icon size={15} aria-hidden="true" />{label}</Link> : resource === "deployments" ? <Link key={resource} to="/projects/$projectId/deployments" params={{ projectId }} activeProps={{ className: "bg-[color-mix(in_srgb,var(--projects-accent)_12%,transparent)] text-[var(--projects-text)]" }} className="inline-flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-[var(--projects-muted)] transition-colors hover:bg-[var(--projects-control)] hover:text-[var(--projects-text)] lg:flex"><Icon size={15} aria-hidden="true" />{label}</Link> : resource === "messaging" ? <Link key={resource} to="/projects/$projectId/messaging" params={{ projectId }} activeProps={{ className: "bg-[color-mix(in_srgb,var(--projects-accent)_12%,transparent)] text-[var(--projects-text)]" }} className="inline-flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-[var(--projects-muted)] transition-colors hover:bg-[var(--projects-control)] hover:text-[var(--projects-text)] lg:flex"><Icon size={15} aria-hidden="true" />{label}</Link> : resource === "api-keys" ? <Link key={resource} to="/projects/$projectId/api-keys" params={{ projectId }} activeProps={{ className: "bg-[color-mix(in_srgb,var(--projects-accent)_12%,transparent)] text-[var(--projects-text)]" }} className="inline-flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-[var(--projects-muted)] transition-colors hover:bg-[var(--projects-control)] hover:text-[var(--projects-text)] lg:flex"><Icon size={15} aria-hidden="true" />{label}</Link> : <Link key={resource} to="/projects/$projectId/$resource" params={{ projectId, resource }} activeProps={{ className: "bg-[color-mix(in_srgb,var(--projects-accent)_12%,transparent)] text-[var(--projects-text)]" }} className="inline-flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-[var(--projects-muted)] transition-colors hover:bg-[var(--projects-control)] hover:text-[var(--projects-text)] lg:flex"><Icon size={15} aria-hidden="true" />{label}</Link>)}</nav></div></aside>;
}
