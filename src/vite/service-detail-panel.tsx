import { ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { ServiceCanvasPosition, ServiceCanvasService } from "./service-canvas";

export function ServiceDetailPanel({
  projectId,
  service,
  position,
}: {
  projectId: string;
  service: ServiceCanvasService;
  position?: ServiceCanvasPosition;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-bg)] p-4" aria-live="polite">
      <div className="min-w-0">
        <p className="m-0 text-[10px] uppercase tracking-[0.1em] text-[var(--projects-muted)]">Selected service</p>
        <p className="m-0 mt-1 truncate text-sm font-semibold">{service.name}</p>
        <p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">{service.detail} · position {Math.round(position?.x ?? 0)}, {Math.round(position?.y ?? 0)}</p>
      </div>
      <Link to={`/projects/$projectId/${service.resource}` as never} params={{ projectId } as never} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--projects-accent)] hover:underline">
        Open resource <ExternalLink size={13} aria-hidden="true" />
      </Link>
    </div>
  );
}
