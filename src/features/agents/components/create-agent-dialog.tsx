import { useEffect, useState, type FormEvent } from "react";
import { Bot, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { AGENT_ROLES, ALL_TOOLS, DEFAULT_INSTRUCTIONS } from "../data";
import type { AgentCreateDraft, AgentRole, AgentTool } from "../types";

const fieldClass =
  "h-10 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-[13px] leading-4 text-[var(--projects-text)] outline-none transition-colors focus:border-[var(--projects-border-hover)]";
const selectClass = `${fieldClass} appearance-none pr-9`;
const labelClass = "mb-1.5 block text-[12px] font-medium text-[var(--projects-muted)]";
const sectionClass = "text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--projects-muted)]";

const PROVIDERS = ["OpenAI", "Anthropic"] as const;
const MODELS_BY_PROVIDER: Record<string, string[]> = {
  OpenAI: ["GPT-5.6", "GPT-5.6 mini"],
  Anthropic: ["Claude Sonnet 4.5", "Claude Haiku 4.5"],
};

function CheckRow({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer select-none items-center gap-2.5 text-[13px] leading-4 text-[var(--projects-text)]",
        disabled && "cursor-default opacity-70",
      )}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden="true"
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--projects-accent)]",
          checked
            ? "border-[var(--projects-accent)] bg-[var(--projects-accent)]"
            : "border-[var(--projects-border-hover)] bg-transparent",
        )}
      >
        {checked && <Check size={11} strokeWidth={3} className="text-[#0b0b0d]" />}
      </span>
      {label}
    </label>
  );
}

function SelectField({
  value,
  onChange,
  children,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  ariaLabel: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={ariaLabel}
        className={selectClass}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        strokeWidth={1.8}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--projects-muted)]"
        aria-hidden="true"
      />
    </div>
  );
}

export function CreateAgentDialog({
  open,
  onClose,
  projects,
  pending = false,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  projects: Array<{ id: string; name: string }>;
  pending?: boolean;
  onCreate: (draft: AgentCreateDraft) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<AgentRole>("General");
  const [description, setDescription] = useState("");
  const [provider, setProvider] = useState<string>("OpenAI");
  const [model, setModel] = useState<string>("GPT-5.6");
  const [project, setProject] = useState<string>(projects[0]?.id ?? "");
  const [branch, setBranch] = useState("main");
  const [instructions, setInstructions] = useState(DEFAULT_INSTRUCTIONS);
  const [tools, setTools] = useState<AgentTool[]>([...ALL_TOOLS]);
  const [nameError, setNameError] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    setName("");
    setRole("General");
    setDescription("");
    setProvider("OpenAI");
    setModel("GPT-5.6");
    setProject(projects[0]?.id ?? "");
    setBranch("main");
    setInstructions(DEFAULT_INSTRUCTIONS);
    setTools([...ALL_TOOLS]);
    setNameError(undefined);
  }, [open, projects]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const toggleTool = (tool: AgentTool, checked: boolean) => {
    setTools((prev) => (checked ? [...new Set([...prev, tool])] : prev.filter((item) => item !== tool)));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setNameError("Agent name is required.");
      return;
    }
    if (!project) {
      setNameError("Select a project before creating an agent.");
      return;
    }
    void onCreate({ projectId: project, name, role, description, provider, model, branch, instructions, tools });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-agent-title"
        className="relative flex max-h-[94dvh] w-full flex-col rounded-t-[10px] border border-[var(--projects-border)] bg-[var(--projects-card-bg)] shadow-2xl shadow-black/40 sm:max-h-[88dvh] sm:max-w-[600px] sm:rounded-[10px]"
      >
        <div className="flex items-start gap-3 border-b border-[var(--projects-divider)] px-5 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] text-[var(--projects-accent)]">
            <Bot size={17} strokeWidth={1.7} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="create-agent-title" className="m-0 text-[16px] font-semibold leading-5 text-[var(--projects-text)]">
              Create new agent
            </h2>
            <p className="m-0 mt-0.5 text-[13px] leading-5 text-[var(--projects-muted)]">
              Configure a coding agent for your project.
            </p>
          </div>
        </div>

        <form
          id="create-agent-form"
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4"
          noValidate
        >
          <section className="space-y-3">
            <p className={cn("m-0", sectionClass)}>Identity</p>
            <label className="block">
              <span className={labelClass}>Agent name</span>
              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (nameError) setNameError(undefined);
                }}
                autoFocus
                placeholder="e.g. Frontend Engineer"
                aria-invalid={!!nameError}
                className={cn(fieldClass, nameError && "border-[var(--projects-danger)]")}
              />
              {nameError && <span className="mt-1 block text-[12px] text-[var(--projects-danger)]">{nameError}</span>}
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Role</span>
                <SelectField value={role} onChange={(value) => setRole(value as AgentRole)} ariaLabel="Role">
                  {AGENT_ROLES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </SelectField>
              </label>
              <label className="block">
                <span className={labelClass}>Default branch</span>
                <input
                  value={branch}
                  onChange={(event) => setBranch(event.target.value)}
                  placeholder="main"
                  className="projects-mono block h-10 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-[12.5px] leading-4 text-[var(--projects-text)] outline-none transition-colors focus:border-[var(--projects-border-hover)]"
                />
              </label>
            </div>
            <label className="block">
              <span className={labelClass}>Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={2}
                placeholder="Build UI, fix frontend bugs, and refactor React components."
                className="w-full resize-none rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[13px] leading-5 text-[var(--projects-text)] outline-none transition-colors placeholder:text-[var(--projects-muted)] focus:border-[var(--projects-border-hover)]"
              />
            </label>
          </section>

          <section className="space-y-3">
            <p className={cn("m-0", sectionClass)}>Model</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Provider</span>
                <SelectField
                  value={provider}
                  onChange={(value) => {
                    setProvider(value);
                    setModel(MODELS_BY_PROVIDER[value][0]);
                  }}
                  ariaLabel="Provider"
                >
                  {PROVIDERS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </SelectField>
              </label>
              <label className="block">
                <span className={labelClass}>Model</span>
                <SelectField value={model} onChange={setModel} ariaLabel="Model">
                  {(MODELS_BY_PROVIDER[provider] ?? []).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </SelectField>
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <p className={cn("m-0", sectionClass)}>Project access</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Project</span>
                {projects.length > 0 ? (
                  <SelectField value={project} onChange={setProject} ariaLabel="Project">
                    {projects.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </SelectField>
                ) : (
                  <p className="m-0 rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2.5 text-[12.5px] leading-5 text-[var(--projects-muted)]">
                    No projects are available for this account.
                  </p>
                )}
                <p className="m-0 mt-1.5 text-[11.5px] leading-4 text-[var(--projects-muted)]">
                  Agents inherit the selected project&apos;s access boundary. Owners and admins can manage configuration.
                </p>
              </label>
              <div className="hidden sm:block">
                <span className={labelClass}>Control plane</span>
                <div className="rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2.5 text-[12.5px] leading-5 text-[var(--projects-muted)]">
                  Provider credentials are not stored in this form. Connect a provider before running the agent.
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <p className={cn("m-0", sectionClass)}>Instructions</p>
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              rows={7}
              className="w-full resize-y rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2.5 text-[13px] leading-[20px] text-[var(--projects-text)] outline-none transition-colors focus:border-[var(--projects-border-hover)]"
            />
          </section>

          <section className="space-y-3">
            <p className={cn("m-0", sectionClass)}>Tools</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {ALL_TOOLS.map((tool) => (
                <div
                  key={tool}
                  className="rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2.5"
                >
                  <CheckRow label={tool} checked={tools.includes(tool)} onChange={(checked) => toggleTool(tool, checked)} />
                </div>
              ))}
            </div>
          </section>
        </form>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--projects-divider)] px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-md border border-[var(--projects-border)] px-4 text-[13px] font-medium text-[var(--projects-text)] transition-colors hover:bg-white/[0.04]"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-agent-form"
            disabled={pending || projects.length === 0}
            className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[var(--projects-accent-border)] bg-[var(--projects-accent-strong)] px-4 text-[13px] font-semibold leading-none text-white transition-colors hover:bg-[var(--projects-accent-hover)] disabled:cursor-default disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--projects-accent)]/70"
          >
            <Check size={15} strokeWidth={2} aria-hidden="true" />
            {pending ? "Creating…" : "Create Agent"}
          </button>
        </div>
      </div>
    </div>
  );
}
