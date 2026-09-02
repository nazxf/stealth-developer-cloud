"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Account, Organization, Project } from "@/lib/stealth-api";

const projectNamePattern = /^[a-z0-9][a-z0-9-]{1,62}$/;
type ErrorPayload = { error?: { message?: string } };

function responseError(payload: ErrorPayload | null, fallback: string) {
  return payload?.error?.message ?? fallback;
}

export function ConnectedProjectsPage({
  account,
  organizations,
  activeOrganization,
  projects,
}: {
  account: Account;
  organizations: Organization[];
  activeOrganization: Organization;
  projects: Project[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [createPending, setCreatePending] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [error, setError] = useState("");

  function switchOrganization(organizationID: string) {
    router.push(`/?organization=${encodeURIComponent(organizationID)}`);
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createPending) return;

    const normalizedName = name.trim().toLowerCase();
    if (!projectNamePattern.test(normalizedName)) {
      setError("Use 2–63 lowercase letters, numbers, or hyphens; start with a letter or number.");
      return;
    }

    setCreatePending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/stealth/organizations/${encodeURIComponent(activeOrganization.id)}/projects`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: normalizedName }),
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ErrorPayload | null;
        setError(responseError(payload, "Unable to create the project. Please try again."));
        return;
      }
      setName("");
      router.refresh();
    } catch {
      setError("Unable to reach Stealth. Check your connection and try again.");
    } finally {
      setCreatePending(false);
    }
  }

  async function logout() {
    if (logoutPending) return;
    setLogoutPending(true);
    setError("");
    try {
      const response = await fetch("/api/stealth/session", { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ErrorPayload | null;
        setError(responseError(payload, "Unable to log out. Please try again."));
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Unable to reach Stealth. Check your connection and try again.");
    } finally {
      setLogoutPending(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[var(--projects-bg)] px-4 py-8 text-[var(--projects-text)] sm:px-8">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-b border-[var(--projects-border)] pb-6">
        <div>
          <p className="m-0 text-sm text-[var(--projects-muted)]">Signed in as {account.email}</p>
          <h1 className="m-0 mt-2 text-3xl font-semibold">Projects</h1>
        </div>
        <button type="button" onClick={logout} disabled={logoutPending} aria-busy={logoutPending} className="rounded-md border border-[var(--projects-border)] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60">
          {logoutPending ? "Logging out…" : "Log out"}
        </button>
      </header>

      <section className="mx-auto mt-7 max-w-6xl">
        <label htmlFor="organization" className="block max-w-sm text-sm">
          Organization
          <select id="organization" value={activeOrganization.id} onChange={(event) => switchOrganization(event.target.value)} className="mt-1 block w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-2">
            {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
          </select>
        </label>

        <form onSubmit={createProject} className="mt-5 flex max-w-lg flex-wrap gap-2" noValidate>
          <label className="sr-only" htmlFor="project-name">Project name</label>
          <input id="project-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="project-name" autoComplete="off" aria-describedby="project-name-help" disabled={createPending} className="min-w-0 flex-1 rounded-md border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-2 disabled:cursor-not-allowed disabled:opacity-60" />
          <button type="submit" disabled={createPending} aria-busy={createPending} className="rounded-md bg-[var(--projects-accent-strong)] px-4 text-white disabled:cursor-not-allowed disabled:opacity-60">
            {createPending ? "Creating…" : "Create project"}
          </button>
          <p id="project-name-help" className="basis-full text-xs text-[var(--projects-muted)]">2–63 lowercase letters, numbers, or hyphens.</p>
        </form>

        <p aria-live="polite" className="sr-only">{createPending ? "Creating project" : logoutPending ? "Logging out" : ""}</p>
        {error ? <p role="alert" className="mt-2 text-sm text-red-300">{error}</p> : null}

        {projects.length > 0 ? (
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${encodeURIComponent(project.id)}`} className="rounded-lg border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5 outline-none hover:border-[var(--projects-border-hover)] focus-visible:ring-2 focus-visible:ring-[var(--projects-accent)]">
                <h2 className="m-0 text-base font-semibold">{project.name}</h2>
                <p className="mt-2 break-all font-mono text-xs text-[var(--projects-muted)]">{project.id}</p>
                <p className="mt-1 text-xs text-[var(--projects-muted)]">Created {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(project.created_at))}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-8 rounded-lg border border-dashed border-[var(--projects-border)] p-8 text-center text-[var(--projects-muted)]">No projects in this organization yet.</p>
        )}
      </section>
    </main>
  );
}
