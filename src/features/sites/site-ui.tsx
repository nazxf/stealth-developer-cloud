import type { ReactNode } from "react";

export type Runtime = "node-22" | "python-3.13" | "go-1.24";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs text-[var(--projects-muted)]">
      {label}
      {children}
    </label>
  );
}
export function inputClass() {
  return "mt-1 block h-9 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm text-[var(--projects-text)]";
}
export function formatDate(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(new Date(value))
    : "—";
}
export function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KiB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MiB`;
  return `${(value / 1024 ** 3).toFixed(2)} GiB`;
}
export function statusClass(status: string) {
  if (["active", "ready", "verified", "succeeded"].includes(status))
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (["failed", "cancelled", "disabled"].includes(status))
    return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  return "border-amber-500/30 bg-amber-500/10 text-amber-100";
}
