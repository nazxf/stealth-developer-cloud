"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, X } from "lucide-react";
import type { ApplicationUser } from "@/lib/stealth-api";

type ProjectAuthUsersProps = {
  projectId: string;
  initialUsers: ApplicationUser[];
  initialNextCursor: string | null;
  initialCanManage: boolean;
  initialRegistrationEnabled: boolean;
  initialCORSOrigins: string[];
};

type BridgeErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

const dialogFocusableSelector = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");
const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

class ProjectUsersBridgeError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function bridgeJSON<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      accept: "application/json",
      ...init.headers,
    },
  });
  const payload = (await response.json().catch(() => null)) as T | BridgeErrorPayload | null;
  if (!response.ok) {
    const error = payload as BridgeErrorPayload | null;
    throw new ProjectUsersBridgeError(response.status, error?.error?.message ?? "The request could not be completed.");
  }
  return payload as T;
}

function usersPath(projectId: string, suffix = "") {
  return `/api/stealth/projects/${encodeURIComponent(projectId)}/users${suffix}`;
}

function settingsPath(projectId: string) {
  return `/api/stealth/projects/${encodeURIComponent(projectId)}/auth/settings`;
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function permissionError(reason: unknown, fallback: string) {
  if (reason instanceof ProjectUsersBridgeError && reason.status === 403) {
    return "Only project owners and admins can create or change project users.";
  }
  return reason instanceof Error ? reason.message : fallback;
}

function settingsPermissionError(reason: unknown, fallback: string) {
  if (reason instanceof ProjectUsersBridgeError && reason.status === 403) {
    return "Only project owners and admins can change project Auth settings.";
  }
  return reason instanceof Error ? reason.message : fallback;
}

function statusClass(status: ApplicationUser["status"]) {
  return status === "active"
    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
    : "border-amber-500/25 bg-amber-500/10 text-amber-200";
}

export function ProjectAuthUsers({ projectId, initialUsers, initialNextCursor, initialCanManage, initialRegistrationEnabled, initialCORSOrigins }: ProjectAuthUsersProps) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [canManage, setCanManage] = useState(initialCanManage);
  const [registrationEnabled, setRegistrationEnabled] = useState(initialRegistrationEnabled);
  const [corsOrigins, setCORSOrigins] = useState(initialCORSOrigins);
  const [corsDraft, setCORSDraft] = useState(initialCORSOrigins.join("\n"));
  const [settingsPending, setSettingsPending] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [loadPending, setLoadPending] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!createOpen) return;
    const opener = openerRef.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    openerRef.current = opener;
    const body = document.body;
    const scrollY = window.scrollY;
    const previousBodyStyles = {
      left: body.style.left,
      overflow: body.style.overflow,
      position: body.style.position,
      right: body.style.right,
      top: body.style.top,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.overflow = "hidden";
    const focusFrame = requestAnimationFrame(() => {
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>("#project-user-email") ?? dialogRef.current?.querySelector<HTMLElement>(dialogFocusableSelector);
      firstFocusable?.focus({ preventScroll: true });
    });
    const closeOnEscapeAndTrapFocus = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setCreateOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(dialogFocusableSelector) ?? []);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscapeAndTrapFocus);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", closeOnEscapeAndTrapFocus);
      body.style.position = previousBodyStyles.position;
      body.style.top = previousBodyStyles.top;
      body.style.left = previousBodyStyles.left;
      body.style.right = previousBodyStyles.right;
      body.style.overflow = previousBodyStyles.overflow;
      window.scrollTo(0, scrollY);
      opener?.focus({ preventScroll: true });
      openerRef.current = null;
    };
  }, [createOpen]);

  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatePending(true);
    setFormError(null);
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();
    if (!normalizedEmail) {
      setFormError("Email is required.");
      setCreatePending(false);
      return;
    }
    if (normalizedName.length === 1 || normalizedName.length > 120) {
      setFormError("Name must be between 2 and 120 characters when provided.");
      setCreatePending(false);
      return;
    }
    try {
      const result = await bridgeJSON<{ user: ApplicationUser }>(usersPath(projectId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password, name: normalizedName }),
      });
      setUsers((current) => [...current, result.user]);
      setEmail("");
      setPassword("");
      setName("");
      setCreateOpen(false);
    } catch (reason) {
      if (reason instanceof ProjectUsersBridgeError && reason.status === 401) {
        router.push("/login");
        return;
      }
      setFormError(permissionError(reason, "The user could not be created."));
    } finally {
      setCreatePending(false);
    }
  }

  async function updateStatus(user: ApplicationUser) {
    const nextStatus = user.status === "active" ? "blocked" : "active";
    setBusyUserId(user.id);
    setError(null);
    try {
      const result = await bridgeJSON<{ user: ApplicationUser }>(usersPath(projectId, `/${encodeURIComponent(user.id)}/status`), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      setUsers((current) => current.map((item) => (item.id === result.user.id ? result.user : item)));
    } catch (reason) {
      if (reason instanceof ProjectUsersBridgeError && reason.status === 401) {
        router.push("/login");
        return;
      }
      setError(permissionError(reason, "The user status could not be updated."));
    } finally {
      setBusyUserId(null);
    }
  }

  async function loadMore() {
    if (!nextCursor || loadPending) return;
    setLoadPending(true);
    setError(null);
    try {
      const result = await bridgeJSON<{ users: ApplicationUser[]; pagination: { next_cursor: string | null }; can_manage: boolean }>(
        `${usersPath(projectId)}?limit=20&cursor=${encodeURIComponent(nextCursor)}`,
      );
      setUsers((current) => [...current, ...result.users]);
      setNextCursor(result.pagination.next_cursor);
      setCanManage(result.can_manage);
    } catch (reason) {
      if (reason instanceof ProjectUsersBridgeError && reason.status === 401) {
        router.push("/login");
        return;
      }
      setError(reason instanceof Error ? reason.message : "More users could not be loaded.");
    } finally {
      setLoadPending(false);
    }
  }

  async function updateRegistrationSetting() {
    if (!canManage || settingsPending) return;
    setSettingsPending(true);
    setError(null);
    try {
      const result = await bridgeJSON<{ settings: { registration_enabled: boolean }; can_manage: boolean }>(settingsPath(projectId), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ registration_enabled: !registrationEnabled }),
      });
      setRegistrationEnabled(result.settings.registration_enabled);
      setCanManage(result.can_manage);
    } catch (reason) {
      if (reason instanceof ProjectUsersBridgeError && reason.status === 401) {
        router.push("/login");
        return;
      }
      setError(settingsPermissionError(reason, "The Auth registration setting could not be updated."));
    } finally {
      setSettingsPending(false);
    }
  }

  async function updateCORSOrigins() {
    if (!canManage || settingsPending) return;
    setSettingsPending(true);
    setError(null);
    const origins = corsDraft.split(/[\n,]/).map((value) => value.trim()).filter(Boolean);
    try {
      const result = await bridgeJSON<{ settings: { cors_origins: string[] }; can_manage: boolean }>(settingsPath(projectId), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cors_origins: origins }),
      });
      setCORSOrigins(result.settings.cors_origins);
      setCORSDraft(result.settings.cors_origins.join("\n"));
      setCanManage(result.can_manage);
    } catch (reason) {
      if (reason instanceof ProjectUsersBridgeError && reason.status === 401) {
        router.push("/login");
        return;
      }
      setError(settingsPermissionError(reason, "The browser origin allowlist could not be updated."));
    } finally {
      setSettingsPending(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--projects-border)] pb-6">
        <div>
          <p className="m-0 font-mono text-[12px] text-[var(--projects-muted)]">project: {projectId}</p>
          <h1 className="m-0 mt-2 text-[28px] font-semibold tracking-[-0.035em] text-[var(--projects-text)]">Auth</h1>
          <p className="m-0 mt-2 max-w-2xl text-[14px] leading-6 text-[var(--projects-muted)]">Manage project identities and email/password sessions for your application. Registration and the browser origin allowlist are controlled below. Custom Site domains are managed from Sites.</p>
        </div>
        {canManage ? <button
          type="button"
          onClick={() => {
            setFormError(null);
            setError(null);
            setCreateOpen(true);
          }}
          className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[var(--projects-accent-border)] bg-[var(--projects-accent-strong)] px-4 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-colors hover:bg-[var(--projects-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--projects-accent)]/70"
        >
          <Plus size={15} aria-hidden="true" />
          Create user
        </button> : null}
      </header>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-5 py-4">
        <div>
          <h2 className="m-0 text-[14px] font-semibold text-[var(--projects-text)]">Application registration</h2>
          <p className="m-0 mt-1 max-w-xl text-[13px] leading-5 text-[var(--projects-muted)]">Allow the project application to register new identities. Existing Console-created identities are not affected.</p>
        </div>
        {canManage ? <button
          type="button"
          role="switch"
          aria-checked={registrationEnabled}
          aria-busy={settingsPending}
          disabled={settingsPending}
          onClick={updateRegistrationSetting}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--projects-accent)] disabled:cursor-not-allowed disabled:opacity-60 ${registrationEnabled ? "border-[var(--projects-accent-border)] bg-[var(--projects-accent-strong)]" : "border-[var(--projects-border-hover)] bg-[var(--projects-control)]"}`}
        >
          <span className={`block size-5 rounded-full bg-white shadow-sm transition-transform ${registrationEnabled ? "translate-x-5" : "translate-x-0"}`} />
          <span className="sr-only">{registrationEnabled ? "Disable application registration" : "Enable application registration"}</span>
        </button> : <span className="rounded-full border border-[var(--projects-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--projects-muted)]">{registrationEnabled ? "Enabled" : "Disabled"}</span>}
      </div>

      <div className="mt-4 rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="m-0 text-[14px] font-semibold text-[var(--projects-text)]">Browser origins (CORS)</h2>
            <p className="m-0 mt-1 max-w-2xl text-[13px] leading-5 text-[var(--projects-muted)]">Allow deployed browser applications to use the SDK with credentials. Enter one HTTP(S) origin per line; paths, wildcards, and blank origins are rejected.</p>
          </div>
          {canManage ? <button type="button" onClick={() => void updateCORSOrigins()} disabled={settingsPending} aria-busy={settingsPending} className="inline-flex h-9 shrink-0 items-center rounded-md border border-[var(--projects-border)] px-3 text-[12px] font-semibold text-[var(--projects-text)] hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60">{settingsPending ? "Saving…" : "Save origins"}</button> : <span className="rounded-full border border-[var(--projects-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--projects-muted)]">Read only</span>}
        </div>
        <textarea value={corsDraft} onChange={(event) => setCORSDraft(event.target.value)} disabled={!canManage || settingsPending} rows={3} placeholder="https://app.example.com\nhttp://localhost:3000" className="mt-4 block w-full resize-y rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 font-mono text-[12px] text-[var(--projects-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--projects-accent)] disabled:cursor-not-allowed disabled:opacity-60" aria-label="Allowed browser origins" />
        <p className="m-0 mt-2 text-[11px] text-[var(--projects-muted)]">{corsOrigins.length ? `${corsOrigins.length} origin${corsOrigins.length === 1 ? "" : "s"} configured.` : "No browser origins configured; cross-origin browser requests are blocked."}</p>
      </div>

      {error ? <p role="alert" className="mt-5 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">{error}</p> : null}

      {users.length === 0 ? (
        <div className="mt-8 grid min-h-[320px] place-items-center rounded-xl border border-dashed border-[var(--projects-border)] bg-[var(--projects-card-bg)] px-6 py-12 text-center">
          <div className="max-w-md">
            <span className="mx-auto flex size-11 items-center justify-center rounded-xl border border-[var(--projects-border)] bg-[var(--projects-control)] text-[var(--projects-accent)]">@</span>
            <h2 className="m-0 mt-4 text-[16px] font-semibold text-[var(--projects-text)]">No application users yet</h2>
            <p className="m-0 mt-2 text-[14px] leading-6 text-[var(--projects-muted)]">Create a project identity now, or enable public registration for application sign-ups.</p>
            {canManage ? <button type="button" onClick={() => setCreateOpen(true)} className="mt-5 inline-flex h-9 items-center gap-2 rounded-md border border-[var(--projects-border-hover)] bg-[var(--projects-control)] px-3 text-[13px] font-semibold text-[var(--projects-text)] hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-[var(--projects-accent)]">
              <Plus size={14} aria-hidden="true" />
              Create first user
            </button> : <p className="m-0 mt-5 text-[12px] text-[var(--projects-muted)]">Read-only project membership</p>}
          </div>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)]">
          <table className="w-full min-w-[680px] border-collapse text-left">
            <caption className="sr-only">Project application users</caption>
            <thead>
              <tr className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--projects-muted)]">
                <th scope="col" className="px-5 py-3">User</th>
                <th scope="col" className="px-5 py-3">Status</th>
                <th scope="col" className="px-5 py-3">Email verified</th>
                <th scope="col" className="px-5 py-3">Created</th>
                <th scope="col" className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const pending = busyUserId === user.id;
                return (
                  <tr key={user.id} className="border-b border-[var(--projects-divider)] last:border-b-0">
                    <td className="px-5 py-4">
                      <p className="m-0 text-[13px] font-semibold text-[var(--projects-text)]">{user.name || "Unnamed user"}</p>
                      <p className="m-0 mt-1 text-[12px] text-[var(--projects-muted)]">{user.email}</p>
                      <p className="m-0 mt-1 font-mono text-[10px] text-[var(--projects-muted)]">{user.id}</p>
                    </td>
                    <td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium ${statusClass(user.status)}`}>{user.status}</span></td>
                    <td className="px-5 py-4 text-[13px] text-[var(--projects-muted)]">{user.email_verified ? "Yes" : "No"}</td>
                    <td className="px-5 py-4 text-[13px] text-[var(--projects-muted)]">{formatDate(user.created_at)}</td>
                    <td className="px-5 py-4 text-right">
                      {canManage ? <button type="button" onClick={() => updateStatus(user)} disabled={pending} aria-busy={pending} className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--projects-border)] px-3 text-[12px] font-semibold text-[var(--projects-text)] transition-colors hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[var(--projects-accent)]">
                        {pending ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}
                        <span className={pending ? "sr-only" : ""}>{user.status === "active" ? "Block" : "Unblock"}</span>
                      </button> : <span className="text-[12px] text-[var(--projects-muted)]">Read only</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {nextCursor ? <div className="flex justify-center border-t border-[var(--projects-divider)] px-5 py-3"><button type="button" onClick={loadMore} disabled={loadPending} aria-busy={loadPending} className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--projects-border)] px-3 text-[12px] font-semibold text-[var(--projects-text)] hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60">{loadPending ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}{loadPending ? "Loading…" : "Load more"}</button></div> : null}
        </div>
      )}

      {createOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4" role="presentation">
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="create-project-user-title" tabIndex={-1} className="w-full max-w-md rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="create-project-user-title" className="m-0 text-[17px] font-semibold text-[var(--projects-text)]">Create application user</h2>
                <p className="m-0 mt-1 text-[13px] leading-5 text-[var(--projects-muted)]">Credentials are stored as a one-way Argon2id hash.</p>
              </div>
              <button type="button" onClick={() => setCreateOpen(false)} disabled={createPending} aria-label="Close create user dialog" className="inline-flex size-8 items-center justify-center rounded-md text-[var(--projects-muted)] hover:bg-white/[0.05] hover:text-[var(--projects-text)] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[var(--projects-accent)]"><X size={17} aria-hidden="true" /></button>
            </div>
            <form onSubmit={createUser} className="mt-5 space-y-4">
              <div>
                <label htmlFor="project-user-email" className="mb-1.5 block text-[12px] font-medium text-[var(--projects-muted)]">Email</label>
                <input id="project-user-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={createPending} className="h-10 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-[13px] text-[var(--projects-text)] outline-none focus:border-[var(--projects-border-hover)] focus-visible:ring-2 focus-visible:ring-[var(--projects-accent)] disabled:opacity-60" />
              </div>
              <div>
                <label htmlFor="project-user-password" className="mb-1.5 block text-[12px] font-medium text-[var(--projects-muted)]">Password</label>
                <input id="project-user-password" type="password" required minLength={12} maxLength={256} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={createPending} aria-describedby="project-user-password-help" className="h-10 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-[13px] text-[var(--projects-text)] outline-none focus:border-[var(--projects-border-hover)] focus-visible:ring-2 focus-visible:ring-[var(--projects-accent)] disabled:opacity-60" />
                <p id="project-user-password-help" className="m-0 mt-1 text-[11px] text-[var(--projects-muted)]">Use 12–256 characters.</p>
              </div>
              <div>
                <label htmlFor="project-user-name" className="mb-1.5 block text-[12px] font-medium text-[var(--projects-muted)]">Name <span className="font-normal text-[var(--projects-muted)]/75">(optional)</span></label>
                <input id="project-user-name" type="text" maxLength={120} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} disabled={createPending} className="h-10 w-full rounded-md border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-[13px] text-[var(--projects-text)] outline-none focus:border-[var(--projects-border-hover)] focus-visible:ring-2 focus-visible:ring-[var(--projects-accent)] disabled:opacity-60" />
              </div>
              {formError ? <p role="alert" className="m-0 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] leading-5 text-rose-200">{formError}</p> : null}
              <div className="flex justify-end gap-2 border-t border-[var(--projects-divider)] pt-4">
                <button type="button" onClick={() => setCreateOpen(false)} disabled={createPending} className="inline-flex h-9 items-center rounded-md border border-[var(--projects-border)] px-3 text-[12px] font-semibold text-[var(--projects-text)] hover:bg-white/[0.05] disabled:opacity-60">Cancel</button>
                <button type="submit" disabled={createPending} aria-busy={createPending} className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--projects-accent-strong)] px-3 text-[12px] font-semibold text-white hover:bg-[var(--projects-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60">{createPending ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}{createPending ? "Creating…" : "Create user"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
