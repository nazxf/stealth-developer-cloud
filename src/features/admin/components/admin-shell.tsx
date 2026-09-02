"use client";

import { useCallback, useState, type ReactNode } from "react";
import { PanelToggleIcon } from "@/features/navigation/sidebar-shared";
import { AdminSidebar } from "./admin-sidebar";

/**
 * Shared chrome for every /admin route: the admin navigation panel plus the
 * content area. Deliberately separate from ApplicationShell so customer
 * pages keep the customer sidebar and admin pages never mount it.
 */
export function AdminShell({ children, accountEmail }: { children: ReactNode; accountEmail: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="min-h-dvh bg-[var(--projects-bg)]">
      {/* Mobile-only opener, same pinned position as the customer shell. */}
      <button
        type="button"
        onClick={openSidebar}
        aria-label="Open admin sidebar"
        aria-haspopup="dialog"
        className="fixed left-4 top-3 z-[65] inline-flex size-9 items-center justify-center rounded-lg border border-[var(--projects-border)] bg-[#141416] text-[var(--projects-text)] shadow-[0_1px_3px_rgba(0,0,0,0.35)] transition-colors hover:border-[var(--projects-border-hover)] lg:hidden"
      >
        <PanelToggleIcon className="size-[18px]" />
      </button>
      <div className="lg:flex">
        <AdminSidebar open={sidebarOpen} onClose={closeSidebar} accountEmail={accountEmail} />
        <main className="relative min-h-dvh min-w-0 flex-1">
          <div className="border-b border-[var(--projects-border)] bg-[#16151a] px-4 py-2 text-[11.5px] leading-4 text-[var(--projects-muted)] sm:px-6 lg:px-7">
            <span className="font-medium text-[var(--projects-text)]">Preview telemetry.</span>{" "}
            API liveness/readiness, workspace audit events, and incident records are connected; historical charts remain preview data until their query APIs are enabled.
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
