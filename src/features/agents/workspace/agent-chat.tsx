import {
  Bot,
  Check,
  CircleAlert,
  FilePenLine,
  FileText,
  LoaderCircle,
  Search,
  Terminal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent, AgentStep, WorkspaceMessage } from "../types";
import { ChangesSummary } from "./changes-summary";

const STEP_ICONS = {
  read: FileText,
  edit: FilePenLine,
  search: Search,
  command: Terminal,
  check: Check,
} as const;

function StepRow({ step, nextPending }: { step: AgentStep; nextPending: boolean }) {
  const Icon = STEP_ICONS[step.type];
  const running = step.status === "pending" && nextPending;

  return (
    <li className="flex items-center gap-2.5 px-3 py-1.5">
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center",
          step.status === "done" ? "text-[var(--projects-accent)]" : running ? "text-[var(--projects-accent)]" : "text-[var(--projects-ring)]",
        )}
        aria-hidden="true"
      >
        {step.status === "done" ? (
          <Check size={13} strokeWidth={2.2} />
        ) : running ? (
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--projects-accent)] opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-[var(--projects-accent)]" />
          </span>
        ) : (
          <span className="size-1.5 rounded-full bg-current opacity-70" />
        )}
      </span>

      <span className="w-[86px] shrink-0 text-[12px] leading-4 text-[var(--projects-muted)]">{step.label}</span>
      <span className="projects-mono min-w-0 flex-1 truncate text-[12px] leading-4 text-[var(--projects-text)]">
        {step.target}
      </span>

      <span
        className={cn(
          "shrink-0 text-[11px] leading-4",
          step.status === "done" ? "text-[var(--projects-muted)]" : running ? "text-[var(--projects-accent)]" : "text-[var(--projects-ring)]",
        )}
      >
        {step.status === "done" ? "done" : running ? "running" : "queued"}
      </span>
    </li>
  );
}

function AgentMessage({
  message,
  agentName,
  onReview,
  onCancel,
}: {
  message: Extract<WorkspaceMessage, { role: "agent" }>;
  agentName: string;
  onReview?: () => void;
  onCancel?: (runId: string) => void | Promise<void>;
}) {
  const firstPendingIndex = message.steps.findIndex((step) => step.status === "pending");
  const currentStep = message.status === "running" ? message.steps[firstPendingIndex] : undefined;

  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] text-[var(--projects-accent)]">
        <Bot size={14} strokeWidth={1.7} aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-semibold text-[var(--projects-text)]">{agentName}</span>
          <span className="text-[11px] leading-4 text-[var(--projects-muted)]">{message.time}</span>
        </div>

        <p className="m-0 mt-1 text-[13.5px] leading-5 text-[var(--projects-text)]">{message.text}</p>

        {message.steps.length > 0 && (
          <ul className="m-0 mt-2.5 list-none divide-y divide-[var(--projects-divider)] overflow-hidden rounded-md border border-[var(--projects-border)] bg-[var(--projects-surface)] p-0">
            {message.steps.map((step, index) => (
              <StepRow key={step.id} step={step} nextPending={index === firstPendingIndex} />
            ))}
          </ul>
        )}

        {message.status === "queued" && (
          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            <p className="m-0 flex items-center gap-2 text-[12.5px] text-[var(--projects-muted)]">
              <LoaderCircle size={13} strokeWidth={2} className="animate-spin text-[var(--projects-accent)]" aria-hidden="true" />
              Queued — waiting for an execution worker
            </p>
            {onCancel && (
              <button
                type="button"
                onClick={() => void onCancel(message.runId)}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--projects-border)] px-2 text-[11.5px] font-medium text-[var(--projects-muted)] transition-colors hover:text-[var(--projects-text)]"
              >
                <X size={12} strokeWidth={1.8} aria-hidden="true" />
                Cancel
              </button>
            )}
          </div>
        )}

        {message.status === "running" && (
          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            <p className="m-0 flex items-center gap-2 text-[12.5px] text-[var(--projects-muted)]">
              <LoaderCircle size={13} strokeWidth={2} className="animate-spin text-[var(--projects-accent)]" aria-hidden="true" />
              Working
              {currentStep ? ` — ${currentStep.target}...` : "..."}
            </p>
            {onCancel && (
              <button
                type="button"
                onClick={() => void onCancel(message.runId)}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--projects-border)] px-2 text-[11.5px] font-medium text-[var(--projects-muted)] transition-colors hover:text-[var(--projects-text)]"
              >
                <X size={12} strokeWidth={1.8} aria-hidden="true" />
                Cancel
              </button>
            )}
          </div>
        )}

        {message.status === "failed" && (
          <p className="m-0 mt-2.5 flex items-center gap-2 text-[12.5px] text-[var(--projects-danger)]">
            <CircleAlert size={13} strokeWidth={1.8} aria-hidden="true" />
            Execution failed
          </p>
        )}

        {message.status === "cancelled" && (
          <p className="m-0 mt-2.5 text-[12.5px] text-[var(--projects-muted)]">Execution cancelled</p>
        )}

        {message.status === "completed" && message.changes && message.changes.length > 0 && (
          <ChangesSummary
            changes={message.changes}
            onReview={onReview}
          />
        )}
      </div>
    </div>
  );
}

export function AgentChat({
  agent,
  messages,
  onReview,
  onCancel,
}: {
  agent: Agent;
  messages: WorkspaceMessage[];
  onReview?: () => void;
  onCancel?: (runId: string) => void | Promise<void>;
}) {
  return (
    <div className="mx-auto w-full max-w-[760px] space-y-5 px-4 py-5 sm:px-6">
      {messages.map((message) =>
        message.role === "user" ? (
          <div key={message.id} className="flex justify-end">
            <div className="flex max-w-[85%] flex-col items-end">
              <div className="rounded-lg border border-[var(--projects-accent-border)] bg-[color-mix(in_srgb,var(--projects-accent)_14%,transparent)] px-3.5 py-2.5">
                <p className="m-0 text-[13.5px] leading-5 text-[var(--projects-text)]">{message.text}</p>
              </div>
              <span className="mt-1 text-[11px] leading-4 text-[var(--projects-muted)]">
                You · {message.time}
              </span>
            </div>
          </div>
        ) : (
          <AgentMessage
            key={message.id}
            message={message}
            agentName={agent.name}
            onReview={onReview}
            onCancel={onCancel}
          />
        ),
      )}

      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CircleAlert size={18} className="text-[var(--projects-muted)]" aria-hidden="true" />
          <p className="m-0 mt-2 text-[13.5px] text-[var(--projects-muted)]">
            No conversation yet — send the agent a prompt to get started.
          </p>
        </div>
      )}
    </div>
  );
}
