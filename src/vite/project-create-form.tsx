import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { browserAPI, browserAPIErrorMessage } from "@/lib/browser-api";
import { queryClient } from "./query-client";
import { queryKeys } from "./query-keys";

const projectNameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,62}$/, "Use 2–63 lowercase letters, numbers, or hyphens.");

function errorMessage(error: unknown) {
  return browserAPIErrorMessage(error, "Unable to create the project.");
}

export function ProjectCreateForm({ organizationID, onCreated }: { organizationID: string; onCreated?: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = projectNameSchema.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Use a valid project name.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await browserAPI.createProject(organizationID, { name: parsed.data });
      setName("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects(organizationID) });
      onCreated?.();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={(event) => void submit(event)} className="mt-6 flex flex-wrap gap-2" noValidate>
    <label htmlFor="new-vite-project" className="sr-only">Project name</label>
    <input id="new-vite-project" value={name} onChange={(event) => setName(event.target.value)} disabled={pending} placeholder="new-project" className="h-10 min-w-56 flex-1 rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm outline-none focus:border-[var(--projects-accent)]" />
    <button type="submit" disabled={pending} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-4 text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)] disabled:opacity-60"><Plus size={16} aria-hidden="true" />{pending ? "Creating…" : "New project"}</button>
    {error ? <p className="basis-full m-0 text-sm text-[var(--projects-danger)]" role="alert">{error}</p> : null}
  </form>;
}
