"use client";

import { useState, type FormEvent } from "react";
import { GitBranch, LoaderCircle } from "lucide-react";
import type { SiteDeployment } from "@/lib/stealth-api";

type Props = {
  projectId: string;
  siteId: string;
  canManage: boolean;
  onCreated: (deployment: SiteDeployment) => void;
};

type ErrorPayload = { error?: { message?: string } };

class GitDeployError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function bridgeJSON<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "include", headers: { accept: "application/json", ...init.headers } });
  const payload = await response.json().catch(() => null) as T | ErrorPayload | null;
  if (!response.ok) throw new GitDeployError(response.status, (payload as ErrorPayload | null)?.error?.message ?? "The Git deployment could not be completed.");
  return payload as T;
}

function deploymentPath(projectId: string, siteId: string) {
  return `/api/stealth/projects/${encodeURIComponent(projectId)}/sites/${encodeURIComponent(siteId)}/deployments/git`;
}

export function SiteGitDeployPanel({ projectId, siteId, canManage, onCreated }: Props) {
  const [repository, setRepository] = useState("");
  const [ref, setRef] = useState("main");
  const [runtime, setRuntime] = useState<"node-22" | "python-3.13" | "go-1.24">("node-22");
  const [command, setCommand] = useState("npm run build");
  const [outputDirectory, setOutputDirectory] = useState("dist");
  const [activate, setActivate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || busy || !repository.trim() || !command.trim()) return;
    setBusy(true); setError(null);
    try {
      const result = await bridgeJSON<{ deployment: SiteDeployment }>(deploymentPath(projectId, siteId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repository: repository.trim(), ref: ref.trim() || "main", build_runtime: runtime, build_command: command.trim(), output_directory: outputDirectory.trim() || ".", activate }),
      });
      onCreated(result.deployment);
      setRepository(""); setRef("main");
    } catch (reason) {
      if (reason instanceof GitDeployError && reason.status === 401) { window.location.assign("/login"); return; }
      setError(reason instanceof Error ? reason.message : "The Git deployment could not be created.");
    } finally { setBusy(false); }
  }

  return (
    <section className="mt-5 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5">
      <div className="flex items-start gap-3"><GitBranch size={19} className="mt-0.5 text-[var(--projects-muted)]" aria-hidden="true" /><div><h3 className="m-0 text-[17px] font-semibold text-[var(--projects-text)]">Deploy from Git</h3><p className="m-0 mt-1 max-w-2xl text-[12px] leading-5 text-[var(--projects-muted)]">Pull a public GitHub or GitLab repository, normalize its archive root, and build it in the network-isolated worker.</p></div></div>
      {error ? <div role="alert" className="mt-3 rounded-md border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-100">{error}</div> : null}
      {canManage ? <form onSubmit={(event) => void submit(event)} className="mt-4 grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(130px,1fr)_auto]"><label className="text-[11px] text-[var(--projects-muted)]">Repository URL<input value={repository} onChange={(event) => setRepository(event.target.value)} placeholder="https://github.com/acme/site" autoComplete="off" spellCheck={false} required maxLength={512} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[12px] text-[var(--projects-text)]" /></label><label className="text-[11px] text-[var(--projects-muted)]">Branch or tag<input value={ref} onChange={(event) => setRef(event.target.value)} placeholder="main" maxLength={256} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[12px] text-[var(--projects-text)]" /></label><label className="flex items-end gap-2 pb-2 text-[12px] text-[var(--projects-text)]"><input type="checkbox" checked={activate} onChange={(event) => setActivate(event.target.checked)} className="accent-[var(--projects-accent)]" />Activate</label><label className="text-[11px] text-[var(--projects-muted)]">Build command<input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="npm run build" maxLength={4000} required className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[12px] text-[var(--projects-text)]" /></label><label className="text-[11px] text-[var(--projects-muted)]">Output directory<select value={outputDirectory} onChange={(event) => setOutputDirectory(event.target.value)} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[12px] text-[var(--projects-text)]"><option value=".">.</option><option value="dist">dist</option><option value="build">build</option><option value="out">out</option></select></label><label className="text-[11px] text-[var(--projects-muted)]">Runtime<select value={runtime} onChange={(event) => setRuntime(event.target.value as typeof runtime)} className="mt-1 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 text-[12px] text-[var(--projects-text)]"><option value="node-22">Node 22</option><option value="python-3.13">Python 3.13</option><option value="go-1.24">Go 1.24</option></select></label><button type="submit" disabled={busy || !repository.trim() || !command.trim()} className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--projects-accent-strong)] px-3 text-[12px] font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : <GitBranch size={13} aria-hidden="true" />}Deploy Git</button></form> : <p className="m-0 mt-4 text-[12px] text-[var(--projects-muted)]">Read-only project role.</p>}
    </section>
  );
}
