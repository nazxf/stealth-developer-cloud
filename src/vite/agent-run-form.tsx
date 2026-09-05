import { LoaderCircle, Play } from "lucide-react";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { browserAPI, browserAPIErrorMessage, type BrowserAgentTool } from "@/lib/browser-api";
import { queryClient } from "./query-client";
import { queryKeys } from "./query-keys";

const promptSchema = z.string().trim().min(1, "Prompt is required.").max(20_000, "Prompt must be 20000 characters or fewer.").refine((value) => !value.includes("\u0000"), "Prompt cannot contain NUL.");

function errorMessage(error: unknown) {
  return browserAPIErrorMessage(error, "The agent run could not be created.");
}

export function AgentRunForm({ agentID, tools, onQueued, onError }: { agentID: string; tools: BrowserAgentTool[]; onQueued: (runID: string) => void; onError: (message: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = promptSchema.safeParse(prompt);
    if (!parsed.success) {
      onError(parsed.error.issues[0]?.message ?? "Prompt is required.");
      return;
    }
    setPending(true);
    onError("");
    try {
      const response = await browserAPI.createAgentRun(agentID, { prompt: parsed.data });
      setPrompt("");
      onQueued(response.run.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.agentRuns(agentID) });
    } catch (requestError) {
      onError(errorMessage(requestError));
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={(event) => void submit(event)} className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5" noValidate><h2 className="m-0 text-lg font-semibold">Start a run</h2><p className="m-0 mt-2 text-sm leading-6 text-[var(--projects-muted)]">The request is queued for an available trusted worker. Status and logs update automatically.</p><label className="mt-5 block text-sm font-medium" htmlFor="vite-agent-prompt">Prompt</label><textarea id="vite-agent-prompt" required rows={7} value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={pending} placeholder="Inspect the project and propose the next safe improvement…" className="mt-1.5 block w-full resize-y rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] p-3 text-sm leading-6 outline-none focus:border-[var(--projects-accent)]" /><button type="submit" disabled={pending || !prompt.trim()} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-4 text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60">{pending ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}{pending ? "Queueing…" : "Queue run"}</button><div className="mt-5 border-t border-[var(--projects-divider)] pt-4"><p className="m-0 text-xs uppercase tracking-[0.08em] text-[var(--projects-muted)]">Allowed tools</p><div className="mt-2 flex flex-wrap gap-1.5">{tools.map((tool) => <span key={tool} className="rounded border border-[var(--projects-border)] bg-[var(--projects-control)] px-2 py-1 font-mono text-[10px] text-[var(--projects-muted)]">{tool}</span>)}</div></div></form>;
}
