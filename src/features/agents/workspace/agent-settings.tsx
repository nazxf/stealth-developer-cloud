import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_TOOLS, AGENT_ROLES } from "../data";
import type { Agent, AgentRole, AgentTool } from "../types";

const fieldClass =
  "h-10 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-[13px] leading-4 text-[var(--projects-text)] outline-none transition-colors focus:border-[var(--projects-border-hover)]";
const labelClass = "mb-1.5 block text-[12px] font-medium text-[var(--projects-muted)]";
const sectionClass = "text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--projects-muted)]";

export function AgentSettings({
  agent,
  onAgentChange,
}: {
  agent: Agent;
  onAgentChange: (agent: Agent) => void | Promise<void>;
}) {
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description);
  const [role, setRole] = useState<AgentRole>(agent.role);
  const [model, setModel] = useState(agent.model);
  const [instructions, setInstructions] = useState(agent.instructions ?? "");
  const [tools, setTools] = useState<AgentTool[]>([...agent.tools]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync the form whenever a different agent is opened.
  useEffect(() => {
    setName(agent.name);
    setDescription(agent.description);
    setRole(agent.role);
    setModel(agent.model);
    setInstructions(agent.instructions ?? "");
    setTools([...agent.tools]);
    setSaved(false);
    setError(null);
  }, [agent]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onAgentChange({
        ...agent,
        name: name.trim() || agent.name,
        description: description.trim(),
        role,
        model,
        instructions,
        tools,
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The agent settings could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const toggleTool = (tool: AgentTool, checked: boolean) => {
    setTools((prev) => (checked ? [...new Set([...prev, tool])] : prev.filter((item) => item !== tool)));
  };

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-5 sm:px-6">
      <p className="projects-mono m-0 text-[11px] text-[var(--projects-muted)]">agent id: {agent.id}</p>

      <section className="mt-4 space-y-3.5">
        <p className={cn("m-0", sectionClass)}>Identity</p>
        <label className="block">
          <span className={labelClass}>Agent name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Role</span>
            <div className="relative">
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as AgentRole)}
                aria-label="Role"
                className={cn(fieldClass, "appearance-none pr-9")}
              >
                {AGENT_ROLES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                strokeWidth={1.8}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--projects-muted)]"
                aria-hidden="true"
              />
            </div>
          </label>
          <label className="block">
            <span className={labelClass}>Model</span>
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
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
            className="w-full resize-none rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[13px] leading-5 text-[var(--projects-text)] outline-none transition-colors focus:border-[var(--projects-border-hover)]"
          />
        </label>
      </section>

      <section className="mt-5 space-y-3">
        <p className={cn("m-0", sectionClass)}>Instructions</p>
        <textarea
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          rows={7}
          className="w-full resize-y rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2.5 text-[13px] leading-[20px] text-[var(--projects-text)] outline-none transition-colors focus:border-[var(--projects-border-hover)]"
        />
      </section>

      <section className="mt-5 space-y-3">
        <p className={cn("m-0", sectionClass)}>Tools</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {ALL_TOOLS.map((tool) => {
            const checked = tools.includes(tool);
            return (
              <label
                key={tool}
                className={cn(
                  "flex cursor-pointer select-none items-center gap-2.5 rounded-md border px-3 py-2.5 text-[13px] leading-4 text-[var(--projects-text)] transition-colors",
                  checked
                    ? "border-[var(--projects-accent-border)] bg-[color-mix(in_srgb,var(--projects-accent)_10%,transparent)]"
                    : "border-[var(--projects-border)] bg-[var(--projects-control)]",
                )}
              >
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={checked}
                  onChange={(event) => toggleTool(tool, event.target.checked)}
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
                {tool}
              </label>
            );
          })}
        </div>
      </section>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[var(--projects-accent-border)] bg-[var(--projects-accent-strong)] px-4 text-[13px] font-semibold leading-none text-white transition-colors hover:bg-[var(--projects-accent-hover)] disabled:cursor-default disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--projects-accent)]/70"
        >
          {saved ? <Check size={15} strokeWidth={2} aria-hidden="true" /> : null}
          {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
        </button>
        {saved && <span className="text-[12.5px] text-[var(--projects-muted)]">Settings updated.</span>}
        {error && <span role="alert" className="text-[12.5px] text-[var(--projects-danger)]">{error}</span>}
      </div>
    </div>
  );
}
