import { Bot, FolderGit2, LoaderCircle, UserPlus } from "lucide-react";
import type { Agent } from "../types";

/** Coding-agent relevant summary — no server/infra metrics. */
export function AgentSummary({ agents }: { agents: Agent[] }) {
  const activeAgents = agents.filter((agent) => agent.status === "active").length;
  const runningTasks = agents.filter((agent) => agent.currentTask).length;
  const today = new Date();
  const createdToday = agents.filter((agent) => {
    const created = new Date(agent.createdAt);
    return created.getUTCFullYear() === today.getUTCFullYear() && created.getUTCMonth() === today.getUTCMonth() && created.getUTCDate() === today.getUTCDate();
  }).length;
  const projectCount = new Set(agents.map((agent) => agent.projectId ?? agent.project)).size;

  const items = [
    { label: "Active Agents", value: String(activeAgents), Icon: Bot },
    { label: "Running Tasks", value: String(runningTasks), Icon: LoaderCircle },
    { label: "Created Today", value: String(createdToday), Icon: UserPlus },
    { label: "Projects", value: String(projectCount), Icon: FolderGit2 },
  ];

  return (
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Agent summary">
      {items.map(({ label, value, Icon }) => (
        <div
          key={label}
          className="flex items-center gap-3 rounded-md border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-3.5 py-3"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] text-[var(--projects-accent)]">
            <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="m-0 truncate text-[11px] leading-4 text-[var(--projects-muted)]">{label}</p>
            <p className="m-0 text-[18px] font-semibold leading-6 text-[var(--projects-text)]">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
