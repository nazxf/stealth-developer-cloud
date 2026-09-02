import Link from "next/link";
import { Box, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatProjectDate } from "./data";
import { ProjectStatusBadge } from "./project-status-badge";
import { RegionLabel } from "@/components/region-flag";
import type { Project, ProjectView } from "./types";

export const projectTableColumns =
  "grid-cols-[minmax(200px,1.4fr)_minmax(80px,.6fr)_minmax(112px,1fr)_minmax(90px,.6fr)_minmax(72px,.4fr)_minmax(110px,.8fr)_40px]";

export function ProjectTableHeader() {
  return (
    <div
      className={cn(
        "grid items-center bg-[var(--projects-control)] px-5 py-3 text-[12px] font-medium text-[var(--projects-muted)]",
        projectTableColumns,
      )}
    >
      <span>Project name</span>
      <span>Cloud</span>
      <span>Region</span>
      <span>Status</span>
      <span>Plan</span>
      <span>Created</span>
      <span aria-hidden="true" />
    </div>
  );
}

function ProjectIcon({ size = "default" }: { size?: "default" | "compact" }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border border-[var(--projects-border-hover)] bg-[var(--projects-control)] text-[var(--projects-accent)]",
        size === "compact" ? "size-10" : "size-11",
      )}
    >
      <Box size={size === "compact" ? 18 : 21} strokeWidth={1.7} aria-hidden="true" />
    </span>
  );
}

export function ProjectCard({ project, view }: { project: Project; view: ProjectView }) {
  const isList = view === "list";
  const description = project.description?.trim() || "No description";
  const href = `/projects/${encodeURIComponent(project.id)}`;

  if (isList) {
    return (
      <article
        className={cn(
          "group relative grid min-w-[900px] items-center border-t border-[var(--projects-divider)] bg-[var(--projects-card-bg)] px-5 py-3.5 transition-colors hover:bg-[var(--projects-control)]",
          projectTableColumns,
        )}
      >
        <Link href={href} aria-label={`Open project ${project.name}`} className="absolute inset-0 z-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--projects-accent)]" />
        <div className="pointer-events-none relative z-10 flex min-w-0 items-center gap-3">
          <ProjectIcon size="compact" />
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold leading-5 text-[var(--projects-text)]">
              {project.name}
            </span>
            <span className="mt-0.5 block truncate text-[12px] leading-4 text-[var(--projects-muted)]">
              {description}
            </span>
          </span>
        </div>
        <span className="pointer-events-none relative z-10 truncate text-[13px] text-[var(--projects-text)]">{project.provider}</span>
        <span className="pointer-events-none relative z-10 flex min-w-0 items-center gap-2 truncate text-[13px] text-[var(--projects-muted)]">
          <RegionLabel country={project.regionCountry} region={project.region} />
        </span>
        <span className="pointer-events-none relative z-10"><ProjectStatusBadge status={project.status} variant="chip" /></span>
        <span className="pointer-events-none relative z-10 inline-flex h-6 w-fit items-center rounded border border-[var(--projects-border-hover)] px-2 font-mono text-[10px] tracking-[0.02em] text-[var(--projects-muted)]">
          {project.plan}
        </span>
        <span className="pointer-events-none relative z-10 truncate text-[12.5px] text-[var(--projects-muted)]">
          <time dateTime={project.createdAt}>{formatProjectDate(project.createdAt)}</time>
        </span>
        <button
          type="button"
          aria-label={`Project actions for ${project.name}`}
          className="relative z-20 inline-flex size-10 items-center justify-center rounded-md text-[var(--projects-muted)] transition-colors hover:bg-white/[0.05] hover:text-[var(--projects-text)]"
        >
          <MoreVertical size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </article>
    );
  }

  return (
    <article className="group relative flex min-h-[178px] w-full flex-col rounded-md border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5 transition-colors hover:border-[var(--projects-border-hover)] hover:bg-[var(--projects-control)] max-lg:min-h-0 max-lg:gap-4">
      <button
        type="button"
        aria-label={`Project actions for ${project.name}`}
        className="absolute right-3 top-3 z-20 inline-flex size-9 items-center justify-center rounded-md text-[var(--projects-muted)] transition-colors hover:bg-white/[0.05] hover:text-[var(--projects-text)]"
      >
        <MoreVertical size={16} strokeWidth={2} aria-hidden="true" />
      </button>

      <Link href={href} aria-label={`Open project ${project.name}`} className="absolute inset-0 z-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--projects-accent)]" />
      <div className="pointer-events-none relative z-10 flex items-center gap-3 pr-9">
        <ProjectIcon />
        <div className="min-w-0">
          <h2 className="m-0 truncate text-[15px] font-semibold leading-5 text-[var(--projects-text)]">{project.name}</h2>
          <p className="m-0 mt-1 flex min-w-0 items-center gap-2 truncate text-[13px] leading-[18px] text-[var(--projects-muted)]">
            {project.provider} <span aria-hidden="true">·</span>
            <RegionLabel country={project.regionCountry} region={project.region} />
          </p>
        </div>
      </div>

      <div className="pointer-events-none relative z-10 mt-auto flex items-center gap-2 max-lg:flex-wrap">
        <ProjectStatusBadge status={project.status} variant="chip" />
        <span className="inline-flex h-7 items-center rounded border border-[var(--projects-border-hover)] px-2.5 font-mono text-[10px] tracking-[0.02em] text-[var(--projects-muted)]">
          {project.plan}
        </span>
        <span className="ml-auto truncate text-[11px] text-[var(--projects-muted)] max-lg:ml-0 max-lg:w-full max-lg:whitespace-normal">
          Created {formatProjectDate(project.createdAt)}
        </span>
      </div>
    </article>
  );
}
