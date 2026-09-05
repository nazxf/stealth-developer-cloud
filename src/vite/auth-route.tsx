import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle, Plus, ShieldCheck, UserCheck, UserX, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { browserAPI, browserAPIErrorMessage, type BrowserApplicationUser } from "@/lib/browser-api";
import { queryClient } from "./query-client";
import { ErrorState as AsyncErrorState } from "./error-state";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function LoadingState() {
  return <div className="grid min-h-[18rem] place-items-center rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] text-sm text-[var(--projects-muted)]" aria-live="polite">Loading Auth…</div>;
}

function ErrorState({ error }: { error: unknown }) {
  return <AsyncErrorState error={error} fallback="Unable to load Auth." />;
}

function userStatusClass(status: BrowserApplicationUser["status"]) {
  return status === "active" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-amber-500/25 bg-amber-500/10 text-amber-200";
}

export default function AuthRoute() {
  const { projectId } = useParams({ from: "/projects/$projectId/auth" });
  const usersQuery = useQuery({ queryKey: ["project-users", projectId], queryFn: () => browserAPI.projectUsers(projectId, { limit: 50 }) });
  const settingsQuery = useQuery({ queryKey: ["project-auth-settings", projectId], queryFn: () => browserAPI.projectAuthSettings(projectId) });
  const [additionalUsers, setAdditionalUsers] = useState<BrowserApplicationUser[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadPending, setLoadPending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [settingsPending, setSettingsPending] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [formError, setFormError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [corsDraft, setCorsDraft] = useState("");

  useEffect(() => {
    setAdditionalUsers([]);
    setNextCursor(usersQuery.data?.pagination.next_cursor ?? null);
  }, [usersQuery.data]);
  useEffect(() => {
    if (settingsQuery.data) setCorsDraft(settingsQuery.data.settings.cors_origins.join("\n"));
  }, [settingsQuery.data]);

  const users = [...(usersQuery.data?.users ?? []), ...additionalUsers];
  const canManage = Boolean(usersQuery.data?.can_manage && settingsQuery.data?.can_manage);

  async function invalidateUsers() {
    await queryClient.invalidateQueries({ queryKey: ["project-users", projectId] });
  }

  async function loadMore() {
    if (!nextCursor || loadPending) return;
    setLoadPending(true);
    setLoadError("");
    try {
      const response = await browserAPI.projectUsers(projectId, { limit: 50, cursor: nextCursor });
      setAdditionalUsers((current) => [...current, ...response.users]);
      setNextCursor(response.pagination.next_cursor);
    } catch (error) {
      setLoadError(browserAPIErrorMessage(error, "Unable to load more users."));
    } finally {
      setLoadPending(false);
    }
  }

  async function updateRegistration() {
    const settings = settingsQuery.data?.settings;
    if (!settings || !canManage || settingsPending) return;
    setSettingsPending(true);
    setActionError("");
    try {
      await browserAPI.updateProjectAuthSettings(projectId, { registration_enabled: !settings.registration_enabled });
      await queryClient.invalidateQueries({ queryKey: ["project-auth-settings", projectId] });
    } catch (error) {
      setActionError(browserAPIErrorMessage(error, "The registration setting could not be updated."));
    } finally {
      setSettingsPending(false);
    }
  }

  async function updateCORSOrigins() {
    if (!canManage || settingsPending) return;
    setSettingsPending(true);
    setActionError("");
    const origins = corsDraft.split(/[\n,]/).map((value) => value.trim()).filter(Boolean);
    try {
      await browserAPI.updateProjectAuthSettings(projectId, { cors_origins: origins });
      await queryClient.invalidateQueries({ queryKey: ["project-auth-settings", projectId] });
    } catch (error) {
      setActionError(browserAPIErrorMessage(error, "The browser origin allowlist could not be updated."));
    } finally {
      setSettingsPending(false);
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createPending) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || password.length < 12) {
      setFormError("Use a valid email and a password of at least 12 characters.");
      return;
    }
    if (name.trim().length === 1 || name.trim().length > 120) {
      setFormError("Name must be empty or between 2 and 120 characters.");
      return;
    }
    setCreatePending(true);
    setFormError("");
    setActionError("");
    try {
      await browserAPI.createProjectUser(projectId, { email: normalizedEmail, password, name: name.trim() || undefined });
      setEmail("");
      setPassword("");
      setName("");
      setCreateOpen(false);
      await invalidateUsers();
    } catch (error) {
      setFormError(browserAPIErrorMessage(error, "The application user could not be created."));
    } finally {
      setCreatePending(false);
    }
  }

  async function toggleUser(user: BrowserApplicationUser) {
    if (busyUserId) return;
    setBusyUserId(user.id);
    setActionError("");
    try {
      await browserAPI.updateProjectUserStatus(projectId, user.id, user.status === "active" ? "blocked" : "active");
      await invalidateUsers();
    } catch (error) {
      setActionError(browserAPIErrorMessage(error, "The user status could not be updated."));
    } finally {
      setBusyUserId(null);
    }
  }

  if (usersQuery.isPending || settingsQuery.isPending) return <LoadingState />;
  if (usersQuery.error || settingsQuery.error) return <ErrorState error={usersQuery.error ?? settingsQuery.error} />;
  const settings = settingsQuery.data.settings;

  return <section>
    <Link to="/projects/$projectId" params={{ projectId }} className="text-sm text-[var(--projects-accent)] hover:underline">← Project overview</Link>
    <header className="mt-5 flex flex-wrap items-end justify-between gap-5 border-b border-[var(--projects-border)] pb-6"><div><p className="m-0 text-xs uppercase tracking-[0.12em] text-[var(--projects-muted)]">Project identity</p><h1 className="m-0 mt-2 text-3xl font-semibold tracking-[-0.04em]">Auth</h1><p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-[var(--projects-muted)]">Manage application identities, registration, and browser origins for this project.</p></div>{canManage ? <button type="button" onClick={() => { setFormError(""); setCreateOpen(true); }} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-4 text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)]"><Plus size={15} aria-hidden="true" />Create user</button> : null}</header>

    <div className="mt-6 grid gap-4 lg:grid-cols-2"><div className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="m-0 flex items-center gap-2 text-base font-semibold"><ShieldCheck size={17} className="text-[var(--projects-accent)]" aria-hidden="true" />Application registration</h2><p className="m-0 mt-2 text-sm leading-6 text-[var(--projects-muted)]">Allow the application to create new identities. Console-created users are not affected.</p></div>{canManage ? <button type="button" role="switch" aria-checked={settings.registration_enabled} aria-busy={settingsPending} disabled={settingsPending} onClick={() => void updateRegistration()} className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border p-0.5 transition-colors disabled:opacity-60 ${settings.registration_enabled ? "border-[var(--projects-accent-border)] bg-[var(--projects-accent-strong)]" : "border-[var(--projects-border-hover)] bg-[var(--projects-control)]"}`}><span className={`block size-5 rounded-full bg-white shadow-sm transition-transform ${settings.registration_enabled ? "translate-x-5" : "translate-x-0"}`} /><span className="sr-only">{settings.registration_enabled ? "Disable application registration" : "Enable application registration"}</span></button> : <span className="rounded-full border border-[var(--projects-border)] px-2.5 py-1 text-xs text-[var(--projects-muted)]">{settings.registration_enabled ? "Enabled" : "Disabled"}</span>}</div></div><div className="rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="m-0 text-base font-semibold">Browser origins (CORS)</h2><p className="m-0 mt-2 text-sm leading-6 text-[var(--projects-muted)]">One HTTP(S) origin per line. Paths and wildcards are rejected.</p></div>{canManage ? <button type="button" onClick={() => void updateCORSOrigins()} disabled={settingsPending} className="h-9 rounded-lg border border-[var(--projects-border)] px-3 text-xs font-semibold hover:bg-[var(--projects-control)] disabled:opacity-60">{settingsPending ? "Saving…" : "Save origins"}</button> : null}</div><textarea value={corsDraft} onChange={(event) => setCorsDraft(event.target.value)} disabled={!canManage || settingsPending} rows={3} placeholder="https://app.example.com\nhttp://localhost:3000" className="mt-4 block w-full resize-y rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--projects-accent)] disabled:opacity-60" aria-label="Allowed browser origins" /><p className="m-0 mt-2 text-xs text-[var(--projects-muted)]">{settings.cors_origins.length ? `${settings.cors_origins.length} origin${settings.cors_origins.length === 1 ? "" : "s"} configured.` : "No browser origins configured."}</p></div></div>
    {actionError ? <p role="alert" className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{actionError}</p> : null}

    <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)]"><table className="w-full min-w-[760px] text-left text-sm"><caption className="sr-only">Application users</caption><thead className="border-b border-[var(--projects-divider)] bg-[var(--projects-control)] text-xs uppercase tracking-[0.08em] text-[var(--projects-muted)]"><tr><th scope="col" className="px-5 py-3">User</th><th scope="col" className="px-5 py-3">Status</th><th scope="col" className="px-5 py-3">Email verified</th><th scope="col" className="px-5 py-3">Created</th>{canManage ? <th scope="col" className="px-5 py-3 text-right">Action</th> : null}</tr></thead><tbody className="divide-y divide-[var(--projects-divider)]">{users.map((user) => <tr key={user.id}><td className="px-5 py-4"><p className="m-0 font-medium">{user.name || "Unnamed user"}</p><p className="m-0 mt-1 text-xs text-[var(--projects-muted)]">{user.email}</p><p className="m-0 mt-1 font-mono text-[10px] text-[var(--projects-muted)]">{user.id}</p></td><td className="px-5 py-4"><span className={`rounded-full border px-2 py-1 text-xs font-medium ${userStatusClass(user.status)}`}>{user.status}</span></td><td className="px-5 py-4 text-xs text-[var(--projects-muted)]">{user.email_verified ? "Verified" : "Pending"}</td><td className="px-5 py-4 text-xs text-[var(--projects-muted)]">{formatDate(user.created_at)}</td>{canManage ? <td className="px-5 py-4 text-right"><button type="button" onClick={() => void toggleUser(user)} disabled={busyUserId !== null} className="inline-flex h-8 items-center gap-2 rounded-md border border-[var(--projects-border)] px-3 text-xs font-semibold hover:bg-[var(--projects-control)] disabled:opacity-60">{busyUserId === user.id ? <LoaderCircle size={13} className="animate-spin" aria-hidden="true" /> : user.status === "active" ? <UserX size={13} aria-hidden="true" /> : <UserCheck size={13} aria-hidden="true" />}{user.status === "active" ? "Block" : "Activate"}</button></td> : null}</tr>)}</tbody></table>{users.length === 0 ? <p className="m-0 p-10 text-center text-sm text-[var(--projects-muted)]">No application users yet. Create the first identity for testing.</p> : null}{loadError ? <p role="alert" className="m-0 border-t border-[var(--projects-divider)] px-5 py-3 text-sm text-rose-200">{loadError}</p> : null}{nextCursor ? <div className="flex justify-center border-t border-[var(--projects-divider)] px-5 py-3"><button type="button" onClick={() => void loadMore()} disabled={loadPending} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--projects-border)] px-3 text-xs font-semibold hover:bg-[var(--projects-control)] disabled:opacity-60">{loadPending ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}{loadPending ? "Loading…" : "Load more"}</button></div> : null}</div>

    {createOpen ? <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/65 p-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="vite-create-user-title" className="my-8 w-full max-w-md rounded-xl border border-[var(--projects-border)] bg-[var(--projects-card-bg)] p-5 shadow-2xl shadow-black/40"><div className="flex items-start justify-between gap-4"><div><h2 id="vite-create-user-title" className="m-0 text-lg font-semibold">Create application user</h2><p className="m-0 mt-1 text-sm text-[var(--projects-muted)]">This identity can sign in through the project Auth API.</p></div><button type="button" onClick={() => { if (!createPending) setCreateOpen(false); }} aria-label="Close create user dialog" className="inline-flex size-8 items-center justify-center rounded-md text-[var(--projects-muted)] hover:bg-[var(--projects-control)]"><X size={17} aria-hidden="true" /></button></div><form onSubmit={(event) => void createUser(event)} className="mt-5 space-y-4" noValidate><div><label htmlFor="vite-auth-user-email" className="mb-1.5 block text-xs font-medium text-[var(--projects-muted)]">Email</label><input id="vite-auth-user-email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={createPending} className="h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm outline-none focus:border-[var(--projects-accent)]" /></div><div><label htmlFor="vite-auth-user-password" className="mb-1.5 block text-xs font-medium text-[var(--projects-muted)]">Temporary password</label><input id="vite-auth-user-password" required minLength={12} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={createPending} className="h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm outline-none focus:border-[var(--projects-accent)]" /></div><div><label htmlFor="vite-auth-user-name" className="mb-1.5 block text-xs font-medium text-[var(--projects-muted)]">Display name <span className="font-normal text-[var(--projects-muted)]">(optional)</span></label><input id="vite-auth-user-name" value={name} onChange={(event) => setName(event.target.value)} disabled={createPending} className="h-10 w-full rounded-lg border border-[var(--projects-border)] bg-[var(--projects-control)] px-3 text-sm outline-none focus:border-[var(--projects-accent)]" /></div>{formError ? <p role="alert" className="m-0 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{formError}</p> : null}<div className="flex justify-end gap-2 border-t border-[var(--projects-divider)] pt-4"><button type="button" onClick={() => setCreateOpen(false)} disabled={createPending} className="h-9 rounded-lg border border-[var(--projects-border)] px-3 text-sm">Cancel</button><button type="submit" disabled={createPending} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--projects-accent-strong)] px-3 text-sm font-semibold text-white hover:bg-[var(--projects-accent-hover)] disabled:opacity-60">{createPending ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : null}{createPending ? "Creating…" : "Create user"}</button></div></form></div></div> : null}
  </section>;
}
