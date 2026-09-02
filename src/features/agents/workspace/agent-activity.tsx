import { Ban, Check, CircleX, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentRun } from "../types";

function activityIcon(status: AgentRun["status"]) {
  if (status === "completed") return Check;
  if (status === "failed") return CircleX;
  if (status === "cancelled") return Ban;
  return Play;
}

function activityClass(status: AgentRun["status"]) {
  if (status === "completed") return "text-[var(--projects-accent)]";
  if (status === "failed") return "text-[var(--projects-danger)]";
  return "text-[var(--projects-muted)]";
}

function activityMeta(run: AgentRun) {
  const date = new Date(run.updatedAt);
  const when = Number.isNaN(date.getTime()) ? "—" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${run.status} · ${when}`;
}

export function AgentActivity({ runs }: { runs: AgentRun[] }) {
  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-5 sm:px-6">
      {runs.length === 0 ? (
        <p className="m-0 text-[13.5px] text-[var(--projects-muted)]">No activity has been recorded yet.</p>
      ) : (
        <ul className="m-0 list-none overflow-hidden rounded-md border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-0">
          {runs.map((run, index) => {
            const Icon = activityIcon(run.status);
            return (
              <li key={run.id} className={cn("flex items-center gap-3 px-4 py-3", index > 0 && "border-t border-[var(--projects-divider)]")}>
                <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)]", activityClass(run.status))}>
                  <Icon size={13} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <p className="m-0 min-w-0 flex-1 truncate text-[13px] leading-5 text-[var(--projects-text)]">{run.prompt}</p>
                <span className="projects-mono shrink-0 text-[11px] text-[var(--projects-muted)]">{activityMeta(run)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
