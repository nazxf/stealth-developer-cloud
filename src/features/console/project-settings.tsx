"use client";

import { Check, Clipboard, LoaderCircle, Save, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Project } from "@/lib/stealth-api";

type ErrorPayload = { error?: { message?: string } };

class ProjectSettingsError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function updateProject(projectId: string, name: string) {
  const response = await fetch(`/api/stealth/projects/${encodeURIComponent(projectId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as ErrorPayload | null;
    throw new ProjectSettingsError(response.status, payload?.error?.message ?? "Project settings could not be saved.");
  }
  return response.json() as Promise<{ project: Project }>;
}

function IdentifierRow({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--projects-divider)] py-3 first:border-t-0 first:pt-0 last:pb-0">
      <span className="text-[12px] text-[var(--projects-muted)]">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        <code className="max-w-[min(68vw,28rem)] truncate rounded-md bg-[var(--projects-control)] px-2 py-1 font-mono text-[11px] text-[var(--projects-text)]" title={value}>{value}</code>
        <button type="button" onClick={onCopy} className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-[var(--projects-border)] text-[var(--projects-muted)] outline-none transition-colors hover:bg-white/[0.05] hover:text-[var(--projects-text)] focus-visible:ring-2 focus-visible:ring-[var(--projects-accent)]" aria-label={`Copy ${label.toLowerCase()}`}>
          {copied ? <Check size={13} aria-hidden="true" /> : <Clipboard size={13} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

export function ProjectSettings({ project }: { project: Project }) {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"project" | "organization" | null>(null);

  async function copyIdentifier(kind: "project" | "organization", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied((current) => current === kind ? null : current), 1500);
    } catch {
      setError("The identifier could not be copied. Select it manually instead.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const nextName = name.trim();
    if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(nextName)) {
      setError("Project name must be a lowercase slug between 2 and 63 characters.");
      setMessage(null);
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await updateProject(project.id, nextName);
      setName(result.project.name);
      setMessage(result.project.name === project.name ? "Project settings are already up to date." : "Project settings saved.");
      router.refresh();
    } catch (reason) {
      if (reason instanceof ProjectSettingsError && reason.status === 403) {
        setError("Only project owners and admins can change project settings.");
      } else if (reason instanceof ProjectSettingsError && reason.status === 409) {
        setError("A project with this name already exists in the organization.");
      } else {
        setError(reason instanceof Error ? reason.message : "Project settings could not be saved.");
      }
      setMessage(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="border-b border-[var(--projects-border)] pb-6">
        <p className="m-0 font-mono text-[12px] text-[var(--projects-muted)]">project: {project.id}</p>
        <h1 className="m-0 mt-2 text-[28px] font-semibold tracking-[-0.035em] text-[var(--projects-text)]">Settings</h1>
        <p className="m-0 mt-2 max-w-2xl text-[14px] leading-6 text-[var(--projects-muted)]">Manage the project identity and inspect immutable identifiers used by SDKs, deployments, and audit events.</p>
      </header>

      <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <form onSubmit={(event) => void submit(event)} className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] text-[var(--projects-accent)]"><Settings2 size={17} aria-hidden="true" /></span>
            <div>
              <h2 className="m-0 text-[16px] font-semibold text-[var(--projects-text)]">Project identity</h2>
              <p className="m-0 mt-1 text-[12px] leading-5 text-[var(--projects-muted)]">The name is a lowercase slug and must be unique within the organization.</p>
            </div>
          </div>
          <label className="mt-5 block text-[12px] font-medium text-[var(--projects-muted)]" htmlFor="project-name">
            Name
            <input id="project-name" value={name} onChange={(event) => setName(event.target.value)} disabled={busy} required minLength={2} maxLength={63} pattern="[a-z0-9][a-z0-9-]{1,62}" autoComplete="off" spellCheck={false} className="mt-1 block h-10 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 font-mono text-[13px] text-[var(--projects-text)] outline-none transition-colors placeholder:text-[var(--projects-muted)] focus:border-[var(--projects-accent)] focus-visible:ring-2 focus-visible:ring-[var(--projects-accent)] disabled:cursor-not-allowed disabled:opacity-60" />
          </label>
          <p className="m-0 mt-2 text-[11px] leading-5 text-[var(--projects-muted)]">Use 2–63 characters: <code className="rounded bg-[var(--projects-control)] px-1">a-z</code>, <code className="rounded bg-[var(--projects-control)] px-1">0-9</code>, and hyphens. Renaming does not change the project ID.</p>
          {error ? <p role="alert" className="m-0 mt-4 rounded-md border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-[12px] leading-5 text-rose-200">{error}</p> : null}
          {message ? <p role="status" className="m-0 mt-4 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-[12px] leading-5 text-emerald-200">{message}</p> : null}
          <div className="mt-5 flex justify-end border-t border-[var(--projects-divider)] pt-4">
            <button type="submit" disabled={busy} aria-busy={busy} className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--projects-accent-strong)] px-3.5 text-[12px] font-semibold text-white outline-none transition-colors hover:bg-[var(--projects-accent-hover)] focus-visible:ring-2 focus-visible:ring-[var(--projects-accent)] disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>

        <aside className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5">
          <h2 className="m-0 text-[16px] font-semibold text-[var(--projects-text)]">Identifiers</h2>
          <p className="m-0 mt-1 text-[12px] leading-5 text-[var(--projects-muted)]">These values are stable and safe to use in configuration.</p>
          <div className="mt-5">
            <IdentifierRow label="Project ID" value={project.id} copied={copied === "project"} onCopy={() => void copyIdentifier("project", project.id)} />
            <IdentifierRow label="Organization ID" value={project.organization_id} copied={copied === "organization"} onCopy={() => void copyIdentifier("organization", project.organization_id)} />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--projects-divider)] py-3 last:pb-0">
              <span className="text-[12px] text-[var(--projects-muted)]">Created</span>
              <time dateTime={project.created_at} className="font-mono text-[11px] text-[var(--projects-text)]">{project.created_at.slice(0, 10)}</time>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
