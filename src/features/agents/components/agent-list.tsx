import { useEffect, useState } from "react";
import Link from "next/link";
import { Bot, ChevronRight, Cpu, FolderGit2, GitBranch, MoreVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatLastActive } from "../data";
import type { Agent } from "../types";
import { AgentStatusDot } from "./agent-status";

function AgentRowMenu({ agent, onDelete }: { agent: Agent; onDelete: (id: string) => void | Promise<void> }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest("[data-agent-menu]")) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative z-20" data-agent-menu>
      <button
        type="button"
        aria-label={`Agent actions for ${agent.name}`}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-[var(--projects-muted)] transition-colors hover:bg-white/[0.05] hover:text-[var(--projects-text)]"
      >
        <MoreVertical size={15} strokeWidth={1.8} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 w-44 rounded-[10px] border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-1 shadow-xl shadow-black/30"
        >
          <Link
            href={`/agent/${agent.id}`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs leading-4 text-[var(--projects-text)] transition-colors hover:bg-[var(--projects-control)]"
          >
            Open agent
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDelete(agent.id);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs leading-4 text-[var(--projects-danger)] transition-colors hover:bg-[var(--projects-control)]"
          >
            <Trash2 size={13} strokeWidth={1.8} aria-hidden="true" />
            Delete agent
          </button>
        </div>
      )}
    </div>
  );
}

function AgentRow({ agent, onDelete }: { agent: Agent; onDelete: (id: string) => void | Promise<void> }) {
  return (
    <article className="group relative flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--projects-control)] lg:grid lg:grid-cols-[minmax(0,2.3fr)_110px_minmax(0,1.7fr)_170px_auto] lg:items-center lg:gap-5">
      <Link
        href={`/agent/${agent.id}`}
        aria-label={`Open agent ${agent.name}`}
        className="absolute inset-0 z-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--projects-accent)] focus-visible:ring-inset"
      >
        <span className="sr-only">Open agent {agent.name}</span>
      </Link>

      <div className="pointer-events-none relative z-10 flex min-w-0 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] text-[var(--projects-accent)]">
          <Bot size={17} strokeWidth={1.7} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="m-0 truncate text-[14px] font-semibold leading-5 text-[var(--projects-text)]">
              {agent.name}
            </h2>
            <AgentStatusDot status={agent.status} />
          </div>
          <p className="m-0 mt-0.5 line-clamp-1 text-[12.5px] leading-[18px] text-[var(--projects-muted)]">
            {agent.description}
          </p>
          <p className="projects-mono m-0 mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--projects-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <FolderGit2 size={12} strokeWidth={1.7} aria-hidden="true" />
              {agent.project}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <GitBranch size={12} strokeWidth={1.7} aria-hidden="true" />
              {agent.branch}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Cpu size={12} strokeWidth={1.7} aria-hidden="true" />
              {agent.model}
            </span>
          </p>
        </div>
      </div>

      <div className="pointer-events-none relative z-10 hidden lg:block">
        <span className="inline-flex h-6 items-center rounded-md border border-[var(--projects-border)] px-2 text-[11px] leading-none text-[var(--projects-muted)]">
          {agent.role}
        </span>
      </div>

      <div className="pointer-events-none relative z-10 min-w-0 lg:border-l lg:border-[var(--projects-divider)] lg:pl-5">
        {agent.currentTask ? (
          <>
            <p className="m-0 flex items-center gap-2 text-[13px] font-medium leading-5 text-[var(--projects-text)]">
              {agent.currentTask}
            </p>
            <p className="m-0 flex items-center gap-1.5 text-[11.5px] leading-4 text-[var(--projects-accent)]">
              <span className="size-1.5 rounded-full bg-[var(--projects-accent)]" aria-hidden="true" />
              in progress
            </p>
          </>
        ) : (
          <p className="m-0 text-[12.5px] italic leading-5 text-[var(--projects-muted)]">No active task</p>
        )}
      </div>

      <div className="pointer-events-none relative z-10 hidden text-[12px] leading-5 text-[var(--projects-muted)] lg:block">
        {formatLastActive(agent.lastActiveMinutes)}
      </div>

      <div className="relative z-10 flex items-center gap-2 lg:justify-end">
        <span className="mr-auto text-[12px] text-[var(--projects-muted)] lg:hidden">
          {formatLastActive(agent.lastActiveMinutes)}
        </span>
        <span className="mr-auto inline-flex h-6 items-center rounded-md border border-[var(--projects-border)] px-2 text-[11px] leading-none text-[var(--projects-muted)] lg:hidden">
          {agent.role}
        </span>
        <Link
          href={`/agent/${agent.id}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--projects-border)] px-3 text-[12px] font-medium text-[var(--projects-text)] transition-colors hover:border-[var(--projects-border-hover)] hover:bg-white/[0.04]"
        >
          Open Agent
          <ChevronRight size={13} strokeWidth={1.8} aria-hidden="true" />
        </Link>
        <AgentRowMenu agent={agent} onDelete={onDelete} />
      </div>
    </article>
  );
}

export function AgentList({
  agents,
  onDelete,
}: {
  agents: Agent[];
  onDelete: (id: string) => void | Promise<void>;
}) {
  return (
    <div className="mt-5 overflow-hidden rounded-md border border-[var(--projects-border)] bg-[var(--projects-card-bg)]">
      <div
        className="hidden lg:grid lg:grid-cols-[minmax(0,2.3fr)_110px_minmax(0,1.7fr)_170px_auto] lg:items-center lg:gap-5 lg:border-b lg:border-[var(--projects-divider)] lg:bg-[var(--projects-control)] lg:px-4 lg:py-2.5"
        aria-hidden="true"
      >
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--projects-muted)]">Agent</span>
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--projects-muted)]">Role</span>
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--projects-muted)]">
          Current task
        </span>
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--projects-muted)]">Active</span>
        <span className="text-right text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--projects-muted)]">
          Actions
        </span>
      </div>

      {agents.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <p className="m-0 text-[14px] text-[var(--projects-muted)]">No agents found.</p>
          <p className="m-0 mt-1 text-xs text-[var(--projects-muted)]/75">
            Try another search term or create a new agent.
          </p>
        </div>
      ) : (
        agents.map((agent, index) => (
          <div
            key={agent.id}
            className={cn(index > 0 && "border-t border-[var(--projects-divider)]")}
          >
            <AgentRow agent={agent} onDelete={onDelete} />
          </div>
        ))
      )}
    </div>
  );
}
