import type { KeyboardEvent, PointerEvent } from "react";
import { Activity, Boxes, Database, FunctionSquare, type LucideIcon } from "lucide-react";
import type { ServiceCanvasPosition, ServiceCanvasService } from "./service-canvas";

const nodeStyles: Record<ServiceCanvasService["kind"], { label: string; icon: LucideIcon; color: string }> = {
  function: { label: "Function", icon: FunctionSquare, color: "text-violet-300" },
  site: { label: "Site", icon: Activity, color: "text-sky-300" },
  database: { label: "Database", icon: Database, color: "text-emerald-300" },
  storage: { label: "Storage bucket", icon: Boxes, color: "text-amber-300" },
};

export function ServiceNode({
  service,
  position,
  selected,
  canManage,
  onPointerDown,
  onKeyDown,
  onSelect,
}: {
  service: ServiceCanvasService;
  position: ServiceCanvasPosition;
  selected: boolean;
  canManage: boolean;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onSelect: () => void;
}) {
  const style = nodeStyles[service.kind];
  const Icon = style.icon;
  return (
    <article
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${style.label} ${service.name}`}
      className={`absolute w-56 select-none rounded-xl border p-4 shadow-lg transition-[border-color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--projects-accent)] ${selected ? "border-[var(--projects-accent)] shadow-[0_0_0_2px_color-mix(in_srgb,var(--projects-accent)_20%,transparent)]" : "border-[var(--projects-border)] hover:border-[var(--projects-border-hover)]"} ${canManage ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
      style={{ left: position.x, top: position.y, touchAction: "none", background: "color-mix(in srgb, var(--projects-card-bg) 94%, var(--projects-bg))" }}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`inline-flex size-9 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--projects-accent)_12%,transparent)] ${style.color}`}><Icon size={17} aria-hidden="true" /></span>
        <span className={`rounded-full border px-2 py-1 text-[10px] ${service.status === "active" || service.status === "available" ? "border-[var(--projects-accent)]/40 text-[var(--projects-accent)]" : "border-[var(--projects-border)] text-[var(--projects-muted)]"}`}>{service.status}</span>
      </div>
      <p className="m-0 mt-3 text-[10px] uppercase tracking-[0.1em] text-[var(--projects-muted)]">{style.label}</p>
      <h3 className="m-0 mt-1 truncate text-sm font-semibold">{service.name}</h3>
      <p className="m-0 mt-1 truncate text-xs text-[var(--projects-muted)]">{service.detail}</p>
    </article>
  );
}
