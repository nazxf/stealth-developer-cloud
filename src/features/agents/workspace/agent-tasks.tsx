import { Ban, Check, CircleDashed, CircleX, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentRun } from "../types";

type AgentTaskStatus = "in-progress" | "queued" | "completed" | "failed" | "cancelled";

type AgentTask = {
  id: string;
  title: string;
  detail: string;
  status: AgentTaskStatus;
  meta?: string;
};

function taskStatus(status: AgentRun["status"]): AgentTaskStatus {
  if (status === "running") return "in-progress";
  if (status === "queued") return "queued";
  if (status === "failed") return "failed";
  if (status === "cancelled") return "cancelled";
  return "completed";
}

function taskDetail(run: AgentRun) {
  if (run.status === "queued") return "Accepted and waiting for an execution worker.";
  if (run.status === "running") return "Execution worker is processing this request.";
  if (run.status === "failed") return run.errorMessage ?? "Execution failed.";
  if (run.status === "cancelled") return "Execution was cancelled.";
  return run.outputText ?? "Execution completed.";
}

function taskMeta(run: AgentRun) {
  const date = new Date(run.updatedAt);
  if (Number.isNaN(date.getTime())) return undefined;
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (elapsedMinutes < 1) return "just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  if (elapsedMinutes < 1_440) return `${Math.floor(elapsedMinutes / 60)}h ago`;
  return `${Math.floor(elapsedMinutes / 1_440)}d ago`;
}

export function AgentTasks({ runs }: { runs: AgentRun[] }) {
  const tasks: AgentTask[] = runs.map((run) => ({
    id: run.id,
    title: run.prompt,
    detail: taskDetail(run),
    status: taskStatus(run.status),
    meta: taskMeta(run),
  }));

  const sectionDefinitions: Array<{ label: string; statuses: AgentTaskStatus[]; Icon: typeof Check; iconClass: string }> = [
    { label: "In progress", statuses: ["in-progress"], Icon: LoaderCircle, iconClass: "text-[var(--projects-accent)] animate-spin" },
    { label: "Queued", statuses: ["queued"], Icon: CircleDashed, iconClass: "text-[var(--projects-muted)]" },
    { label: "Completed", statuses: ["completed"], Icon: Check, iconClass: "text-[var(--projects-accent)]" },
    { label: "Failed", statuses: ["failed"], Icon: CircleX, iconClass: "text-[var(--projects-danger)]" },
    { label: "Cancelled", statuses: ["cancelled"], Icon: Ban, iconClass: "text-[var(--projects-muted)]" },
  ];
  const sections = sectionDefinitions
    .map((section) => ({ ...section, items: tasks.filter((task) => section.statuses.includes(task.status)) }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-5 sm:px-6">
      {sections.length === 0 ? (
        <p className="m-0 text-[13.5px] text-[var(--projects-muted)]">No runs have been queued yet.</p>
      ) : (
        sections.map((section) => (
          <section key={section.label} className="mt-5 first:mt-0">
            <h2 className="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--projects-muted)]">{section.label}</h2>
            <ul className="m-0 mt-2.5 list-none divide-y divide-[var(--projects-divider)] overflow-hidden rounded-md border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-0">
              {section.items.map((task) => (
                <li key={task.id} className="flex items-start gap-3 px-4 py-3">
                  <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center", section.iconClass)} aria-hidden="true">
                    <section.Icon size={14} strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[13.5px] font-medium leading-5 text-[var(--projects-text)]">{task.title}</p>
                    <p className="m-0 mt-0.5 text-[12.5px] leading-[18px] text-[var(--projects-muted)]">{task.detail}</p>
                  </div>
                  {task.meta && <span className="shrink-0 pt-0.5 text-[11.5px] leading-4 text-[var(--projects-muted)]">{task.meta}</span>}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
