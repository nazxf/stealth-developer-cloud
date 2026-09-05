import { LoaderCircle, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { browserAPI, browserAPIErrorMessage, type BrowserAgentCatalog, type BrowserAgentRole, type BrowserAgentTool } from "@/lib/browser-api";
import { queryClient } from "./query-client";
import { queryKeys } from "./query-keys";

export type AgentProjectOption = { id: string; name: string };

const defaultInstructions = "Inspect the repository before making changes. Read project instructions before editing. Prefer small, focused changes and run typecheck after editing.";

const agentCreateSchema = z.object({
  projectID: z.string().min(1, "Choose a project."),
  name: z.string().trim().min(2, "Agent name must be at least 2 characters.").max(120, "Agent name must be 120 characters or fewer.").refine((value) => !/[\u0000\t\r\n]/.test(value), "Agent name contains an unsupported control character."),
  description: z.string().trim().max(2000, "Description must be 2000 characters or fewer."),
  role: z.enum(["General", "Frontend", "Reviewer", "Documentation"]),
  branch: z.string().trim().min(1, "Branch is required.").max(255, "Branch must be 255 characters or fewer.").refine((value) => !/[\u0000\t\r\n]/.test(value), "Branch contains an unsupported control character."),
  provider: z.string().trim().min(1, "Provider is required.").max(64, "Provider must be 64 characters or fewer.").refine((value) => !/[\u0000\t\r\n]/.test(value), "Provider contains an unsupported control character."),
  model: z.string().trim().min(1, "Model is required.").max(128, "Model must be 128 characters or fewer.").refine((value) => !/[\u0000\t\r\n]/.test(value), "Model contains an unsupported control character."),
  instructions: z.string().trim().max(10000, "Instructions must be 10000 characters or fewer."),
  tools: z.array(z.enum(["Read files", "Search code", "Edit files", "Terminal", "Run tests", "Git diff"])).max(6),
});

function errorMessage(error: unknown) {
  return browserAPIErrorMessage(error, "The agent could not be created.");
}

export function AgentCreateForm({ projects, catalog, onClose }: { projects: AgentProjectOption[]; catalog: BrowserAgentCatalog; onClose: () => void }) {
  const initialProvider = catalog.providers[0];
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedRole, setSelectedRole] = useState<BrowserAgentRole>(catalog.roles[0] ?? "General");
  const [projectID, setProjectID] = useState(projects[0]?.id ?? "");
  const [branch, setBranch] = useState("main");
  const [provider, setProvider] = useState(initialProvider?.id ?? "");
  const [model, setModel] = useState(initialProvider?.models[0] ?? "");
  const [instructions, setInstructions] = useState(defaultInstructions);
  const [selectedTools, setSelectedTools] = useState<BrowserAgentTool[]>([...catalog.tools]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = agentCreateSchema.safeParse({ projectID, name, description, role: selectedRole, branch, provider, model, instructions, tools: selectedTools });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the agent settings.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await browserAPI.createAgent({
        project_id: parsed.data.projectID,
        name: parsed.data.name,
        description: parsed.data.description,
        role: parsed.data.role,
        branch: parsed.data.branch,
        provider: parsed.data.provider,
        model: parsed.data.model,
        instructions: parsed.data.instructions || null,
        tools: parsed.data.tools,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.agents() });
      onClose();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setPending(false);
    }
  }

  const selectedProvider = catalog.providers.find((item) => item.id === provider) ?? catalog.providers[0];
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/65 p-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="vite-create-agent-title" className="my-8 w-full max-w-2xl rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5 shadow-2xl shadow-black/40"><div className="flex items-start justify-between gap-4"><div><h2 id="vite-create-agent-title" className="m-0 text-lg font-semibold">Create agent</h2><p className="m-0 mt-1 text-sm text-[var(--projects-muted)]">Configure a durable coding agent for a project.</p></div><button type="button" onClick={onClose} disabled={pending} aria-label="Close create agent dialog" className="inline-flex size-8 items-center justify-center rounded-md text-[var(--projects-muted)] hover:bg-[var(--projects-control)]"><X size={17} aria-hidden="true" /></button></div><p role="status" className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">{catalog.execution.message}</p><form onSubmit={(event) => void submit(event)} className="mt-5 space-y-4" noValidate><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-[var(--projects-muted)] sm:col-span-2">Name<input required value={name} onChange={(event) => setName(event.target.value)} disabled={pending} className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm" placeholder="Frontend Engineer" /></label><label className="text-xs text-[var(--projects-muted)]">Project<select required value={projectID} onChange={(event) => setProjectID(event.target.value)} disabled={pending} className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm"><option value="">Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label className="text-xs text-[var(--projects-muted)]">Role<select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as BrowserAgentRole)} disabled={pending} className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm">{catalog.roles.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="text-xs text-[var(--projects-muted)]">Provider<select value={provider} onChange={(event) => { const nextProvider = catalog.providers.find((item) => item.id === event.target.value); setProvider(event.target.value); setModel(nextProvider?.models[0] ?? ""); }} disabled={pending} className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm">{catalog.providers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-xs text-[var(--projects-muted)]">Model<select required value={model} onChange={(event) => setModel(event.target.value)} disabled={pending || !selectedProvider?.models.length} className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm">{(selectedProvider?.models ?? []).map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="text-xs text-[var(--projects-muted)]">Branch<input value={branch} onChange={(event) => setBranch(event.target.value)} disabled={pending} className="mt-1 block h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm" /></label><label className="text-xs text-[var(--projects-muted)] sm:col-span-2">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} disabled={pending} rows={2} className="mt-1 block w-full resize-y rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-sm" /></label><label className="text-xs text-[var(--projects-muted)] sm:col-span-2">Instructions<textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} disabled={pending} rows={4} className="mt-1 block w-full resize-y rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 font-mono text-xs leading-5" /></label></div><fieldset><legend className="text-xs font-medium text-[var(--projects-muted)]">Tools</legend><div className="mt-2 flex flex-wrap gap-2">{catalog.tools.map((tool) => <label key={tool} className="inline-flex items-center gap-2 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-xs"><input type="checkbox" checked={selectedTools.includes(tool)} onChange={(event) => setSelectedTools((current) => event.target.checked ? [...new Set([...current, tool])] : current.filter((item) => item !== tool))} disabled={pending} className="accent-[var(--projects-accent)]" />{tool}</label>)}</div></fieldset>{error ? <p role="alert" className="text-sm text-rose-200">{error}</p> : null}<div className="flex justify-end gap-2 border-t border-[var(--projects-divider)] pt-4"><button type="button" onClick={onClose} disabled={pending} className="h-9 rounded-lg border border-[var(--projects-border)] px-3 py-1.5 text-sm">Cancel</button><button type="submit" disabled={pending || !projects.length || !catalog.providers.length || !selectedProvider?.models.length} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-sm font-semibold text-white disabled:opacity-60">{pending ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}{pending ? "Creating…" : "Create agent"}</button></div></form></div></div>;
}
