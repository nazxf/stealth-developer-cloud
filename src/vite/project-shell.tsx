import { Link } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Boxes,
  Database,
  Gauge,
  KeyRound,
  LayoutDashboard,
  Mail,
  Server,
  Settings2,
  ShieldCheck,
  ScrollText,
  Sparkles,
  Webhook,
  Workflow,
} from "lucide-react";

type NavigationItem = {
  label: string;
  resource: string;
  icon: typeof LayoutDashboard;
};

const navigationItems: NavigationItem[] = [
  { label: "Overview", resource: "__overview__", icon: LayoutDashboard },
  { label: "Services", resource: "services", icon: Server },
  { label: "Deployments", resource: "deployments", icon: Workflow },
  { label: "Usage", resource: "usage", icon: BarChart3 },
  { label: "Logs", resource: "logs", icon: ScrollText },
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

const linkClass =
  "inline-flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-[var(--projects-muted)] transition-colors hover:bg-[var(--projects-control)] hover:text-[var(--projects-text)] lg:flex";
const activeClass =
  "bg-[color-mix(in_srgb,var(--projects-accent)_12%,transparent)] text-[var(--projects-text)]";

export function ProjectShellNavigation({ projectId }: { projectId: string }) {
  return (
    <aside className="mb-6 lg:mb-0">
      <div className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-3 lg:sticky lg:top-20">
        <p className="m-0 px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--projects-muted)]">
          Project
        </p>
        <p
          className="m-0 truncate px-2 pb-3 font-mono text-xs text-[var(--projects-text)]"
          title={projectId}
        >
          {projectId}
        </p>
        <nav
          className="flex gap-1 overflow-x-auto lg:block lg:overflow-visible"
          aria-label="Project navigation"
        >
          {navigationItems.map((item) => (
            <ProjectNavLink key={item.resource} item={item} projectId={projectId} />
          ))}
        </nav>
      </div>
    </aside>
  );
}

function ProjectNavLink({
  item,
  projectId,
}: {
  item: NavigationItem;
  projectId: string;
}) {
  const Icon = item.icon;
  if (item.resource === "__overview__") {
    return (
      <Link
        to="/projects/$projectId"
        params={{ projectId }}
        activeOptions={{ exact: true }}
        activeProps={{ className: activeClass }}
        className={linkClass}
      >
        <Icon size={15} aria-hidden="true" />
        {item.label}
      </Link>
    );
  }

  if (item.resource === "services") {
    return (
      <Link
        to="/projects/$projectId/services"
        params={{ projectId }}
        activeProps={{ className: activeClass }}
        className={linkClass}
      >
        <Icon size={15} aria-hidden="true" />
        {item.label}
      </Link>
    );
  }

  const explicitResources = new Set([
    "deployments",
    "usage",
    "logs",
    "auth",
    "databases",
    "storage",
    "functions",
    "sites",
    "realtime",
    "webhooks",
    "messaging",
    "api-keys",
    "settings",
  ]);
  if (explicitResources.has(item.resource)) {
    return (
      <Link
        to={`/projects/$projectId/${item.resource}` as never}
        params={{ projectId } as never}
        activeProps={{ className: activeClass }}
        className={linkClass}
      >
        <Icon size={15} aria-hidden="true" />
        {item.label}
      </Link>
    );
  }

  return (
    <Link
      to="/projects/$projectId/$resource"
      params={{ projectId, resource: item.resource }}
      activeProps={{ className: activeClass }}
      className={linkClass}
    >
      <Icon size={15} aria-hidden="true" />
      {item.label}
    </Link>
  );
}
