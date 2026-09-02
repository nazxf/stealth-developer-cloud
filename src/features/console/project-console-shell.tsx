"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Braces,
  ChevronLeft,
  ChevronRight,
  Database,
  Files,
  Gauge,
  KeyRound,
  LayoutDashboard,
  Menu,
  MessageSquareMore,
  Radio,
  Rocket,
  Settings,
  ShieldCheck,
  SquareFunction,
  Webhook,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ProjectConsoleShellProps = {
  children: ReactNode;
  projectId: string;
  projectName?: string;
  organizationID?: string;
};

type NavigationItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};

const navigationGroups: Array<{ label: string; items: Omit<NavigationItem, "href">[] }> = [
  {
    label: "Build",
    items: [
      { label: "Overview", icon: LayoutDashboard },
      { label: "Auth", icon: ShieldCheck },
      { label: "Databases", icon: Database },
      { label: "Storage", icon: Files },
      { label: "Functions", icon: SquareFunction },
      { label: "Sites", icon: Braces },
      { label: "Deployments", icon: Rocket },
    ],
  },
  {
    label: "Connect",
    items: [
      { label: "Realtime", icon: Radio },
      { label: "Messaging", icon: MessageSquareMore },
    ],
  },
  {
    label: "Manage",
    items: [
      { label: "API Keys", icon: KeyRound },
      { label: "Webhooks", icon: Webhook },
      { label: "Logs", icon: Activity },
      { label: "Usage", icon: Gauge },
      { label: "Settings", icon: Settings },
    ],
  },
];

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function resourceHref(projectId: string, label: string) {
  return label === "Overview"
    ? `/projects/${encodeURIComponent(projectId)}`
    : `/projects/${encodeURIComponent(projectId)}/${label.toLowerCase().replaceAll(" ", "-")}`;
}

function CompactProjectNavigation({ projectId }: { projectId: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Project navigation" className="mt-4 flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto px-2">
      {navigationGroups.flatMap((group) => group.items).map(({ icon: Icon, label }) => {
        const href = resourceHref(projectId, label);
        const active = pathname === href;

        return (
          <Link
            key={label}
            href={href}
            aria-current={active ? "page" : undefined}
            title={label}
            className={cn(
              "inline-flex size-10 items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--projects-accent)]",
              active
                ? "bg-[color-mix(in_srgb,var(--projects-accent)_18%,transparent)] text-[var(--projects-accent)]"
                : "text-[var(--projects-muted)] hover:bg-[color-mix(in_srgb,var(--projects-text)_6%,transparent)] hover:text-[var(--projects-text)]",
            )}
          >
            <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
            <span className="sr-only">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function ProjectNavigation({ projectId, onNavigate }: { projectId: string; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Project navigation" className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 py-5">
      {navigationGroups.map((group) => (
        <section key={group.label} aria-labelledby={`project-nav-${group.label.toLowerCase()}`}>
          <h2 id={`project-nav-${group.label.toLowerCase()}`} className="px-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--projects-muted)]">
            {group.label}
          </h2>
          <ul className="mt-2 space-y-1" role="list">
            {group.items.map(({ icon: Icon, label }) => {
              const href = resourceHref(projectId, label);
              const active = pathname === href;

              return (
                <li key={label}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--projects-accent)]",
                      active
                        ? "bg-[color-mix(in_srgb,var(--projects-accent)_18%,transparent)] text-[var(--projects-text)]"
                        : "text-[var(--projects-muted)] hover:bg-[color-mix(in_srgb,var(--projects-text)_6%,transparent)] hover:text-[var(--projects-text)]",
                    )}
                  >
                    <Icon size={16} strokeWidth={1.75} aria-hidden="true" className={active ? "text-[var(--projects-accent)]" : "text-[var(--projects-muted)]"} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}

function ProjectSidebar({ projectId, projectName = projectId, organizationID, compact = false, onClose }: { projectId: string; projectName?: string; organizationID?: string; compact?: boolean; onClose?: () => void }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--projects-card-bg)]">
      <div className="flex h-14 items-center border-b border-[var(--projects-border)] px-4">
        <Link href="/" onClick={onClose} className="inline-flex min-w-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--projects-accent)]">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--projects-accent-strong)] text-[12px] font-bold text-white">S</span>
          <span className="truncate text-[14px] font-semibold text-[var(--projects-text)]">Stealth</span>
        </Link>
        {compact ? (
          <button type="button" onClick={onClose} aria-label="Close project navigation" className="ml-auto inline-flex size-9 items-center justify-center rounded-md text-[var(--projects-muted)] hover:bg-[color-mix(in_srgb,var(--projects-text)_6%,transparent)] hover:text-[var(--projects-text)] focus-visible:ring-2 focus-visible:ring-[var(--projects-accent)]">
            <X size={18} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div className="border-b border-[var(--projects-border)] px-4 py-3.5">
        <p className="m-0 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--projects-muted)]">Project</p>
        <p className="mt-1 truncate text-[12px] text-[var(--projects-text)]" title={projectName}>{projectName}</p>
        {organizationID ? <p className="mt-1 truncate font-mono text-[10px] text-[var(--projects-muted)]">{organizationID}</p> : null}
      </div>
      <ProjectNavigation projectId={projectId} onNavigate={onClose} />
      <div className="border-t border-[var(--projects-border)] p-3">
        <Link href="/" onClick={onClose} className="flex h-9 items-center gap-2 rounded-md px-2.5 text-[13px] text-[var(--projects-muted)] outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--projects-text)_6%,transparent)] hover:text-[var(--projects-text)] focus-visible:ring-2 focus-visible:ring-[var(--projects-accent)]">
          <ChevronLeft size={16} aria-hidden="true" />
          All projects
        </Link>
      </div>
    </div>
  );
}

export function ProjectConsoleShell({ children, projectId, projectName = projectId, organizationID }: ProjectConsoleShellProps) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const mobilePanelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!mobileNavigationOpen) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const body = document.body;
    const scrollY = window.scrollY;
    const previousBodyStyles = {
      left: body.style.left,
      overflow: body.style.overflow,
      position: body.style.position,
      right: body.style.right,
      top: body.style.top,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.overflow = "hidden";
    const focusFrame = requestAnimationFrame(() => {
      const firstFocusable = mobilePanelRef.current?.querySelector<HTMLElement>(focusableSelector);
      (firstFocusable ?? mobilePanelRef.current)?.focus({ preventScroll: true });
    });
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavigationOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", closeOnEscape);
      body.style.position = previousBodyStyles.position;
      body.style.top = previousBodyStyles.top;
      body.style.left = previousBodyStyles.left;
      body.style.right = previousBodyStyles.right;
      body.style.overflow = previousBodyStyles.overflow;
      window.scrollTo(0, scrollY);
      opener?.focus({ preventScroll: true });
    };
  }, [mobileNavigationOpen]);

  return (
    <div className="min-h-dvh bg-[var(--projects-bg)] text-[var(--projects-text)] lg:grid lg:grid-cols-[auto_minmax(0,1fr)]">
      <aside className={cn("hidden min-h-dvh border-r border-[var(--projects-border)] lg:block", desktopCollapsed ? "w-[68px]" : "w-[256px]")} aria-label="Project sidebar">
        {desktopCollapsed ? (
          <div className="flex h-full flex-col items-center bg-[var(--projects-card-bg)] py-3">
            <Link href="/" aria-label="All projects" title="All projects" className="inline-flex size-10 items-center justify-center rounded-md bg-[var(--projects-accent-strong)] text-[13px] font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--projects-accent)]">S</Link>
            <CompactProjectNavigation projectId={projectId} />
            <button type="button" onClick={() => setDesktopCollapsed(false)} aria-label="Expand project navigation" className="inline-flex size-10 items-center justify-center rounded-md text-[var(--projects-muted)] hover:bg-[color-mix(in_srgb,var(--projects-text)_6%,transparent)] hover:text-[var(--projects-text)] focus-visible:ring-2 focus-visible:ring-[var(--projects-accent)]">
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="relative h-dvh">
            <ProjectSidebar projectId={projectId} projectName={projectName} organizationID={organizationID} />
            <button type="button" onClick={() => setDesktopCollapsed(true)} aria-label="Collapse project navigation" className="absolute -right-3 top-20 inline-flex size-6 items-center justify-center rounded-full border border-[var(--projects-border)] bg-[var(--projects-card-bg)] text-[var(--projects-muted)] shadow-sm hover:text-[var(--projects-text)] focus-visible:ring-2 focus-visible:ring-[var(--projects-accent)]">
              <ChevronLeft size={14} aria-hidden="true" />
            </button>
          </div>
        )}
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[var(--projects-border)] bg-[var(--projects-card-bg)]/95 px-4 backdrop-blur sm:px-6">
          <button type="button" onClick={() => setMobileNavigationOpen(true)} aria-label="Open project navigation" aria-haspopup="dialog" className="inline-flex size-9 items-center justify-center rounded-md text-[var(--projects-muted)] hover:bg-[color-mix(in_srgb,var(--projects-text)_6%,transparent)] hover:text-[var(--projects-text)] focus-visible:ring-2 focus-visible:ring-[var(--projects-accent)] lg:hidden">
            <Menu size={20} aria-hidden="true" />
          </button>
          <Link href="/" className="text-[13px] text-[var(--projects-muted)] outline-none hover:text-[var(--projects-text)] focus-visible:ring-2 focus-visible:ring-[var(--projects-accent)]">Projects</Link>
          <span aria-hidden="true" className="text-[var(--projects-muted)]">/</span>
          <span className="min-w-0 truncate text-[13px] text-[var(--projects-text)]">{projectName}</span>
        </header>
        <main className="min-h-[calc(100dvh-56px)]">{children}</main>
      </div>

      {mobileNavigationOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
          <button type="button" aria-label="Close project navigation" className="absolute inset-0 bg-black/60" onClick={() => setMobileNavigationOpen(false)} />
          <aside
            ref={mobilePanelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Project navigation"
            tabIndex={-1}
            className="relative h-dvh w-[min(88vw,360px)] border-r border-[var(--projects-border)] shadow-2xl"
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              const focusable = Array.from(mobilePanelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
              if (focusable.length === 0) {
                event.preventDefault();
                mobilePanelRef.current?.focus();
                return;
              }
              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }}
          >
            <ProjectSidebar projectId={projectId} projectName={projectName} organizationID={organizationID} compact onClose={() => setMobileNavigationOpen(false)} />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
